import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import type { GeocodeLookup } from "./geocode-plan";

/**
 * Walking a whole file past the geocoder, once, without losing it to one bad
 * minute.
 *
 * This is `lib/` rather than the step component for the reason
 * `lib/map/edge-autoscroll.ts` is: it is the part of the job that is decidable
 * without a DOM, and therefore the part worth testing. The component owns a
 * progress bar and a Skip button; everything about *when to give up* is here.
 *
 * **The failure it exists to remove.** The loop used to be a plain `for` with a
 * `try/catch` that returned on the first error. A three-thousand-row import is
 * around a hundred and twenty round trips against a shared, rate-limited
 * upstream, so a single 429 anywhere in that sequence — the most ordinary thing
 * that can happen to it — ended the run and left the user with a review step
 * full of unplaced rows and no way to ask again except by re-importing the file
 * and re-spending everything already resolved.
 *
 * So a chunk now gets three attempts with a widening gap between them, and a
 * chunk that still will not land is *skipped*: its rows are marked failed, they
 * turn up in the review step flagged, and the run carries on to the next chunk.
 * Only a sustained run of failures — `MAX_CONSECUTIVE_FAILURES` chunks with
 * nothing landing between them — is treated as an outage worth stopping for,
 * because at that point every further attempt is spending requests against a
 * service that is plainly not answering.
 *
 * What is *not* retried is anything the server has already decided: a plan
 * limit, a validation failure, an unauthorised call. Those return the same
 * answer however many times they are asked, and retrying them is three times
 * the requests for the same refusal.
 */

/** Attempts per chunk, including the first. */
export const MAX_ATTEMPTS = 3;

/**
 * Chunks that may fail back to back before the run gives up.
 *
 * Five rather than one, because a single failure is ordinary and five in a row
 * is a service that is down; and five rather than fifty, because each one costs
 * three attempts and up to fifteen seconds of backoff before it is counted.
 */
export const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * The gap before attempt 2 and attempt 3.
 *
 * One second is long enough for a per-second limiter to have forgotten us; four
 * is long enough for a brief upstream wobble. A `Retry-After` from the server
 * beats both — see `waitFor`.
 */
export const BACKOFF_MS = [1000, 4000] as const;

/**
 * The longest a `Retry-After` is obeyed for.
 *
 * The server's number wins over our backoff, but not without limit: a header
 * that said an hour would leave the bar sitting still for an hour with nothing
 * on screen saying why. Thirty seconds is the host's own request ceiling, so no
 * limiter of ours has a reason to ask for longer.
 */
export const MAX_RETRY_AFTER_MS = 30_000;

/**
 * One request for a chunk's rows.
 *
 * `onResult` is called per answer as it arrives, when the transport streams
 * (`lib/import/geocode-stream.ts`), and that is what moves the bar per address.
 * A transport that does not stream returns them as `results` instead, and they
 * are handed over then; an answer given both ways counts once.
 */
export type GeocodeSend = (input: {
  rows: { key: string; address: string }[];
  onResult: (result: BatchGeocodeResult) => void;
}) => Promise<{ results?: BatchGeocodeResult[]; paceMs?: number }>;

export type GeocodeRunSummary = {
  /** Lookups that came back with an answer, good or "not found". */
  completed: number;
  /** Lookups abandoned after `MAX_ATTEMPTS`. Their rows are marked failed. */
  failed: number;
  /** True when the caller's `shouldStop` ended the run. */
  wasStopped: boolean;
  /**
   * The message to show, or null on a clean run. A run that skipped a chunk or
   * two still returns null — the rows say so themselves, in the review step.
   */
  error: string | null;
};

/**
 * Requests a caller may abandon a chunk over. Everything else is a decision the
 * server has already made and will make again.
 *
 * `undefined` covers a fetch that never got a response at all — a dropped
 * connection, a sleeping laptop — which is the case most worth retrying.
 *
 * **503 is excluded, and it is the only 5xx that is.** It is the one status this
 * API sends to mean "the day's shared lookup budget is spent"
 * (`DailyBudgetError`), and that is not a wobble a second's backoff outlasts — it
 * clears when the day turns. Retrying it twice per chunk buys nothing, delays the
 * honest message by fifteen seconds, and turns a clear refusal into what looks
 * like an outage. Everything else in the 500s — 500 from us, 502 from a geocoder
 * we could not reach, 504 from one that timed out — is exactly the transient
 * failure this retry exists for.
 */
export function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 503) return false;

  return status === 408 || status === 429 || status >= 500;
}

export async function runGeocode({
  lookups,
  batchSize,
  firstBatchSize = batchSize,
  send,
  onChunkStart,
  onProgress,
  onResult,
  shouldStop,
  sleep = defaultSleep,
  jitter = Math.random,
}: {
  lookups: GeocodeLookup[];
  batchSize: number;
  /**
   * The size of the first chunk only. Kept small so the bar moves early even
   * where a host buffers the stream and a chunk only lands whole. It costs one
   * more round trip and no extra lookups.
   */
  firstBatchSize?: number;
  send: GeocodeSend;
  /**
   * Before each chunk is sent, as the index range `[from, to)` into `lookups`,
   * so the caller can say which addresses are being looked up right now.
   */
  onChunkStart?: (from: number, to: number) => void;
  /**
   * After every answer — as each one streams in — and once more when a chunk
   * settles, carrying the server's reported `paceMs` if it sent one. `done` is
   * lookups answered or abandoned so far.
   */
  onProgress: (done: number, paceMs?: number) => void;
  /**
   * One lookup's answer. `null` means the chunk was abandoned and the lookup's
   * rows should be marked failed — the caller owns what "failed" writes, because
   * only it can run the store's own issue derivation.
   */
  onResult: (lookup: GeocodeLookup, result: BatchGeocodeResult | null) => void;
  /**
   * Polled between chunks, and again when a chunk's request fails, so a Skip
   * that aborted the in-flight request ends the run rather than being retried.
   * The Skip button, and nothing else.
   */
  shouldStop: () => boolean;
  /** Injected for tests; the real one is `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests. Returns 0..1. */
  jitter?: () => number;
}): Promise<GeocodeRunSummary> {
  let completed = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  let size = Math.max(1, Math.min(firstBatchSize, batchSize));

  for (let start = 0; start < lookups.length; start += size, size = batchSize) {
    if (shouldStop()) {
      return { completed, failed, wasStopped: true, error: null };
    }

    const chunk = lookups.slice(start, start + size);
    onChunkStart?.(start, start + chunk.length);

    /*
     * Answers are handed over one at a time, as they arrive, and each lookup
     * only once — keyed on its first row, which is what `sendWithRetry` sends.
     * Whatever is answered here is never asked again, so a chunk that fails
     * halfway is retried for the rest of its addresses, not all of them.
     */
    const byKey = new Map(chunk.map((lookup) => [lookup.keys[0] as string, lookup]));
    const answered = new Set<GeocodeLookup>();

    const deliver = (result: BatchGeocodeResult | null, lookup?: GeocodeLookup) => {
      const target = lookup ?? (result ? byKey.get(result.key) : undefined);
      if (!target || answered.has(target)) return;

      answered.add(target);
      onResult(target, result);
      completed += 1;
      onProgress(completed + failed);
    };

    const unanswered = () => chunk.filter((lookup) => !answered.has(lookup));

    const outcome = await sendWithRetry({
      unanswered,
      deliver,
      send,
      sleep,
      jitter,
      shouldStop,
    });

    /*
     * Whatever is still unanswered gets no answer. Its rows are told so now
     * rather than left `pending`, because "pending" in the review step means an
     * answer is still coming and none is coming for these.
     */
    const abandon = () => {
      const left = unanswered();

      for (const lookup of left) {
        answered.add(lookup);
        onResult(lookup, null);
      }

      failed += left.length;
      if (left.length > 0) onProgress(completed + failed);
    };

    if (outcome.wasStopped) {
      abandon();
      return { completed, failed, wasStopped: true, error: null };
    }

    if (outcome.ok) {
      // A lookup the server answered the chunk without mentioning: its rows
      // are flagged as before, and the run goes on.
      for (const lookup of unanswered()) deliver(null, lookup);

      consecutiveFailures = 0;
      onProgress(completed + failed, outcome.paceMs);
      continue;
    }

    // Anything landing in this chunk means the service is answering, if
    // unevenly — so the count of failures in a row starts again at this one.
    const landedAny = unanswered().length < chunk.length;
    abandon();
    consecutiveFailures = landedAny ? 1 : consecutiveFailures + 1;

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      return {
        completed,
        failed,
        wasStopped: false,
        error:
          outcome.error ??
          "The address lookup stopped answering. The addresses already found are kept.",
      };
    }
  }

  return { completed, failed, wasStopped: false, error: null };
}

type ChunkOutcome = {
  ok: boolean;
  paceMs?: number;
  error?: string;
  wasStopped?: boolean;
};

async function sendWithRetry({
  unanswered,
  deliver,
  send,
  sleep,
  jitter,
  shouldStop,
}: {
  /** The chunk's lookups still without an answer, asked fresh each attempt. */
  unanswered: () => GeocodeLookup[];
  deliver: (result: BatchGeocodeResult) => void;
  send: GeocodeSend;
  sleep: (ms: number) => Promise<void>;
  jitter: () => number;
  shouldStop: () => boolean;
}): Promise<ChunkOutcome> {
  let lastMessage: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const rows = unanswered().map((lookup) => ({
      // One row per distinct address. `key` is the first draft wearing it, and
      // the caller fans the answer back out to the rest — see `geocode-plan.ts`.
      key: lookup.keys[0] as string,
      address: lookup.address,
    }));

    // Everything landed before a failure; there is nothing left to ask.
    if (rows.length === 0) return { ok: true };

    try {
      const { results, paceMs } = await send({ rows, onResult: deliver });

      for (const result of results ?? []) deliver(result);

      return { ok: true, paceMs };
    } catch (error) {
      // An aborted request carries no status, so it would otherwise read as a
      // dropped connection and be sent again.
      if (shouldStop()) return { ok: false, wasStopped: true };

      const status = statusOf(error);
      lastMessage = messageOf(error);

      if (!isRetryableStatus(status)) return { ok: false, error: lastMessage };

      const backoff = BACKOFF_MS[attempt];
      if (backoff === undefined) break;

      await sleep(waitFor(backoff, retryAfterOf(error), jitter));

      if (shouldStop()) return { ok: false, wasStopped: true };
    }
  }

  return { ok: false, error: lastMessage };
}

/**
 * How long to wait before the next attempt.
 *
 * The server's own `Retry-After` wins when it sent one — it knows when its
 * limiter resets and we are guessing — up to `MAX_RETRY_AFTER_MS`. Otherwise
 * the backoff is spread across ±25%, so two browsers that hit the same limit in
 * the same second do not come back in the same second as well and trip it again
 * together.
 */
export function waitFor(
  backoffMs: number,
  retryAfterMs: number | undefined,
  jitter: () => number,
): number {
  if (retryAfterMs !== undefined) return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);

  return Math.round(backoffMs * (0.75 + jitter() * 0.5));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * Read structurally rather than with `instanceof ApiError`.
 *
 * This module is imported by a test that never builds a real `ApiError`, and by
 * a component that gets whatever `apiFetch` threw — including a `TypeError` from
 * a fetch that never reached the server, which carries no status at all and is
 * exactly the case `isRetryableStatus(undefined)` is written for.
 */
function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

function retryAfterOf(error: unknown): number | undefined {
  const value = (error as { retryAfterMs?: unknown })?.retryAfterMs;
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "The address lookup stopped unexpectedly.";
}
