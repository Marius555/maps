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

export type GeocodeSend = (input: {
  rows: { key: string; address: string }[];
}) => Promise<{ results: BatchGeocodeResult[]; paceMs?: number }>;

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
 */
export function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;

  return status === 408 || status === 429 || status >= 500;
}

export async function runGeocode({
  lookups,
  batchSize,
  send,
  onProgress,
  onResult,
  shouldStop,
  sleep = defaultSleep,
  jitter = Math.random,
}: {
  lookups: GeocodeLookup[];
  batchSize: number;
  send: GeocodeSend;
  /**
   * After each chunk settles, however it settled. `paceMs` is the server's own
   * reported spacing, so the caller's time estimate can stop being a guess after
   * the first chunk.
   */
  onProgress: (done: number, paceMs?: number) => void;
  /**
   * One lookup's answer. `null` means the chunk was abandoned and the lookup's
   * rows should be marked failed — the caller owns what "failed" writes, because
   * only it can run the store's own issue derivation.
   */
  onResult: (lookup: GeocodeLookup, result: BatchGeocodeResult | null) => void;
  /** Polled between chunks. The Skip button, and nothing else. */
  shouldStop: () => boolean;
  /** Injected for tests; the real one is `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests. Returns 0..1. */
  jitter?: () => number;
}): Promise<GeocodeRunSummary> {
  let completed = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  for (let start = 0; start < lookups.length; start += batchSize) {
    if (shouldStop()) {
      return { completed, failed, wasStopped: true, error: null };
    }

    const chunk = lookups.slice(start, start + batchSize);
    const outcome = await sendWithRetry({ chunk, send, sleep, jitter });

    if (outcome.results) {
      const byKey = new Map(
        outcome.results.map((result) => [result.key, result] as const),
      );

      for (const lookup of chunk) {
        // Keyed on the lookup's first row, which is what `chunkRows` sends.
        const result = byKey.get(lookup.keys[0] as string);
        onResult(lookup, result ?? null);
      }

      completed += chunk.length;
      consecutiveFailures = 0;
      onProgress(completed + failed, outcome.paceMs);
      continue;
    }

    /*
     * The chunk is being skipped, not retried again. Its rows are told so now
     * rather than left `pending`, because "pending" in the review step means an
     * answer is still coming and no answer is coming for these.
     */
    for (const lookup of chunk) onResult(lookup, null);

    failed += chunk.length;
    consecutiveFailures += 1;
    onProgress(completed + failed, undefined);

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
  results: BatchGeocodeResult[] | null;
  paceMs?: number;
  error?: string;
};

async function sendWithRetry({
  chunk,
  send,
  sleep,
  jitter,
}: {
  chunk: GeocodeLookup[];
  send: GeocodeSend;
  sleep: (ms: number) => Promise<void>;
  jitter: () => number;
}): Promise<ChunkOutcome> {
  const rows = chunk.map((lookup) => ({
    // One row per distinct address. `key` is the first draft wearing it, and the
    // caller fans the answer back out to the rest — see `geocode-plan.ts`.
    key: lookup.keys[0] as string,
    address: lookup.address,
  }));

  let lastMessage: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const { results, paceMs } = await send({ rows });
      return { results, paceMs };
    } catch (error) {
      const status = statusOf(error);
      lastMessage = messageOf(error);

      if (!isRetryableStatus(status)) return { results: null, error: lastMessage };

      const backoff = BACKOFF_MS[attempt];
      if (backoff === undefined) break;

      await sleep(waitFor(backoff, retryAfterOf(error), jitter));
    }
  }

  return { results: null, error: lastMessage };
}

/**
 * How long to wait before the next attempt.
 *
 * The server's own `Retry-After` wins outright when it sent one — it knows when
 * its limiter resets and we are guessing. Otherwise the backoff is spread across
 * ±25%, so two browsers that hit the same limit in the same second do not come
 * back in the same second as well and trip it again together.
 */
export function waitFor(
  backoffMs: number,
  retryAfterMs: number | undefined,
  jitter: () => number,
): number {
  if (retryAfterMs !== undefined) return retryAfterMs;

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
