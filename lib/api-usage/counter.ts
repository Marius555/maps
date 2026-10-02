import "server-only";

import type { ApiCallCount, ApiKind, ApiProvider } from "@/lib/repositories/api-calls.repository";

/**
 * Counts upstream requests for the operator console, cheaply.
 *
 * **Batched, because the obvious version is expensive.** A write per request
 * would put an Appwrite read and write behind every geocode — 6,000 of them
 * for one 3,000-row import. Instead each call adds to an in-memory tally and a
 * timer flushes it, one write per (day, provider, kind) that moved, every
 * `FLUSH_MS`. An import is then a handful of writes.
 *
 * **Best effort, and it says so**, in the same words `lib/rate-limit/limiter.ts`
 * uses: the tally lives in this process, so a restart loses at most one flush
 * window and a second instance keeps its own. These are operator statistics,
 * not a bill — the plan allowance is `usage.repository.ts`, which is written
 * synchronously and is untouched by this file.
 *
 * **Never throws and never waits.** `countApiCall` is called from inside the
 * provider transports, on the path of a request somebody is waiting for.
 */

const FLUSH_MS = 15_000;

type Key = `${string}|${ApiProvider}|${ApiKind}`;

const pending = new Map<Key, ApiCallCount>();
let timer: ReturnType<typeof setTimeout> | null = null;

export type ApiCallEvent = { provider: ApiProvider; kind: ApiKind; ok: boolean };

export function countApiCall(event: ApiCallEvent, now: Date = new Date()): void {
  // Tests exercise the transports with a mocked fetch; there is nothing to
  // write to and the timer would outlive the test.
  if (process.env.NODE_ENV === "test") return;

  tally(event, now);

  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, FLUSH_MS);
    // Never the reason a process stays alive.
    timer.unref?.();
  }
}

/** Exported for tests: adds one event to the pending tally. */
export function tally(event: ApiCallEvent, now: Date = new Date()): void {
  const day = now.toISOString().slice(0, 10);
  const key: Key = `${day}|${event.provider}|${event.kind}`;
  const entry =
    pending.get(key) ??
    { day, provider: event.provider, kind: event.kind, ok: 0, failed: 0 };

  if (event.ok) entry.ok += 1;
  else entry.failed += 1;

  pending.set(key, entry);
}

/** Exported for tests: what the next flush would write, and clears it. */
export function drain(): ApiCallCount[] {
  const entries = [...pending.values()];
  pending.clear();
  return entries;
}

async function flush(): Promise<void> {
  const entries = drain();
  if (entries.length === 0) return;

  try {
    // Imported here rather than at the top so that importing a transport never
    // loads the Appwrite client — the provider tests import them freely.
    const { addApiCalls } = await import("@/lib/repositories/api-calls.repository");

    await Promise.all(
      entries.map((entry) =>
        addApiCalls(entry).catch((error: unknown) => {
          console.error("Couldn't record API calls:", error);
        }),
      ),
    );
  } catch (error) {
    console.error("Couldn't record API calls:", error);
  }
}
