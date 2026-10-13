import { describe, expect, it, vi } from "vitest";

import type { BatchGeocodeResult } from "@/lib/geocoding/types";
import type { GeocodeLookup } from "./geocode-plan";
import {
  BACKOFF_MS,
  isRetryableStatus,
  MAX_ATTEMPTS,
  MAX_CONSECUTIVE_FAILURES,
  MAX_RETRY_AFTER_MS,
  runGeocode,
  waitFor,
} from "./geocode-run";

/**
 * No fake timers here, and that is the point of the injected `sleep`.
 *
 * The run is `await`-driven, so `vi.useFakeTimers()` would need every await
 * boundary advanced by hand to get through a hundred chunks. Handing it a
 * `sleep` that records its argument and resolves immediately tests the thing
 * that actually matters — *how long it decided to wait* — without waiting.
 */
function recordingSleep() {
  const waits: number[] = [];
  return {
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
}

function lookups(count: number): GeocodeLookup[] {
  return Array.from({ length: count }, (_, index) => ({
    address: `${index} High Street`,
    keys: [`k${index}`],
  }));
}

function resultsFor(rows: { key: string }[]): BatchGeocodeResult[] {
  return rows.map((row) => ({
    key: row.key,
    candidate: {
      lat: 54.6,
      lng: 25.2,
      label: "Somewhere",
      title: "Somewhere",
      confidence: 0.9,
    },
    alternatives: [],
    status: "ok" as const,
  }));
}

function httpError(status: number, retryAfterMs?: number): Error {
  return Object.assign(new Error("nope"), { status, retryAfterMs });
}

type RunOptions = Parameters<typeof runGeocode>[0];

/** Everything a run needs, with the parts a test does not care about filled in. */
function harness(overrides: Partial<RunOptions> = {}) {
  const answered: string[] = [];
  const abandoned: string[] = [];
  const { waits, sleep } = recordingSleep();

  return {
    answered,
    abandoned,
    waits,
    options: {
      lookups: lookups(1),
      batchSize: 25,
      send: async ({ rows }: { rows: { key: string; address: string }[] }) => ({
        results: resultsFor(rows),
      }),
      onResult: (lookup: GeocodeLookup, result: BatchGeocodeResult | null) => {
        (result ? answered : abandoned).push(lookup.keys[0] as string);
      },
      onProgress: () => {},
      shouldStop: () => false,
      sleep,
      // Fixed, so a jittered backoff is a number a test can assert on.
      jitter: () => 0.5,
      ...overrides,
    } as RunOptions,
  };
}

describe("isRetryableStatus", () => {
  it("retries the ones a second attempt can fix", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    // No response at all — a dropped connection, a sleeping laptop.
    expect(isRetryableStatus(undefined)).toBe(true);
  });

  it("does not spend three attempts on an answer that will not change", () => {
    // A plan limit, a validation failure, an unauthorised call: asking again is
    // three times the requests for the same refusal.
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(422)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  /*
   * The exception among the 5xx, and the one worth a test of its own because the
   * rule around it is "retry everything from 500 up". 503 is what this API sends
   * when the day's shared lookup budget is gone, and that clears when the day
   * turns, not in the four seconds a backoff waits.
   */
  it("does not retry the one 5xx a backoff cannot outlast", () => {
    expect(isRetryableStatus(503)).toBe(false);
    expect(isRetryableStatus(500)).toBe(true);
  });
});

describe("waitFor", () => {
  it("does what the server told it to, when the server said", () => {
    expect(waitFor(1000, 2000, () => 0.5)).toBe(2000);
  });

  it("does not sit still for longer than the host's own request ceiling", () => {
    expect(waitFor(1000, 3_600_000, () => 0.5)).toBe(MAX_RETRY_AFTER_MS);
  });

  it("spreads its own backoff so two clients do not return together", () => {
    expect(waitFor(1000, undefined, () => 0)).toBe(750);
    expect(waitFor(1000, undefined, () => 1)).toBe(1250);
    expect(waitFor(1000, undefined, () => 0.5)).toBe(1000);
  });
});

describe("runGeocode", () => {
  it("walks every lookup and reports them all completed", async () => {
    const { options, answered } = harness({
      lookups: lookups(5),
      batchSize: 2,
    });

    const summary = await runGeocode(options);

    expect(summary).toEqual({
      completed: 5,
      failed: 0,
      wasStopped: false,
      error: null,
    });
    expect(answered).toHaveLength(5);
  });

  it("gives one lookup's answer to every row sharing that address", async () => {
    // The dedupe's other half: `planGeocode` folds the rows, and the run has to
    // hand the answer back for all of them or the duplicates stay unplaced.
    const seen: string[][] = [];

    await runGeocode(
      harness({
        lookups: [{ address: "1 High Street", keys: ["a", "b", "c"] }],
        onResult: (lookup, result) => {
          expect(result).not.toBeNull();
          seen.push(lookup.keys);
        },
      }).options,
    );

    expect(seen).toEqual([["a", "b", "c"]]);
  });

  it("retries a failing chunk and carries on when it lands", async () => {
    let attempts = 0;
    const { options, waits, answered } = harness({
      send: async ({ rows }: { rows: { key: string; address: string }[] }) => {
        attempts += 1;
        if (attempts === 1) throw httpError(429);
        return { results: resultsFor(rows) };
      },
    });

    const summary = await runGeocode(options);

    expect(attempts).toBe(2);
    expect(waits).toEqual([BACKOFF_MS[0]]);
    expect(answered).toEqual(["k0"]);
    expect(summary.completed).toBe(1);
    expect(summary.error).toBeNull();
  });

  it("waits as long as the server's Retry-After said", async () => {
    let attempts = 0;
    const { options, waits } = harness({
      send: async ({ rows }: { rows: { key: string; address: string }[] }) => {
        attempts += 1;
        if (attempts === 1) throw httpError(429, 2000);
        return { results: resultsFor(rows) };
      },
    });

    await runGeocode(options);

    expect(waits).toEqual([2000]);
  });

  it("skips a chunk it cannot land and keeps going", async () => {
    /*
     * The whole reason this module exists. One bad chunk out of a hundred and
     * twenty used to end the run and lose every address still unresolved.
     */
    const send = vi.fn(
      async ({ rows }: { rows: { key: string; address: string }[] }) => {
        if (rows[0]?.key === "k0") throw httpError(502);
        return { results: resultsFor(rows) };
      },
    );

    const { options, answered, abandoned } = harness({
      lookups: lookups(3),
      batchSize: 1,
      send,
    });

    const summary = await runGeocode(options);

    expect(abandoned).toEqual(["k0"]);
    expect(answered).toEqual(["k1", "k2"]);
    expect(summary).toEqual({
      completed: 2,
      failed: 1,
      wasStopped: false,
      // A skipped chunk is not a failed run: those rows say so themselves in
      // the review step.
      error: null,
    });
    // Three attempts on the bad chunk, one each on the two good ones.
    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS + 2);
  });

  it("gives up once the service has plainly stopped answering", async () => {
    const { options, abandoned } = harness({
      lookups: lookups(20),
      batchSize: 1,
      send: async () => {
        throw httpError(503);
      },
    });

    const summary = await runGeocode(options);

    expect(summary.wasStopped).toBe(false);
    expect(summary.error).toBeTruthy();
    // It stops at the threshold rather than spending three attempts on each of
    // the remaining fifteen chunks.
    expect(summary.failed).toBe(MAX_CONSECUTIVE_FAILURES);
    expect(abandoned).toHaveLength(MAX_CONSECUTIVE_FAILURES);
  });

  it("counts consecutive failures, not total ones", async () => {
    // Four failures with a success between them is a flaky minute, not an
    // outage, and must not end a run.
    const failing = new Set(["k0", "k1", "k3", "k4"]);

    const { options, abandoned, answered } = harness({
      lookups: lookups(5),
      batchSize: 1,
      send: async ({ rows }: { rows: { key: string; address: string }[] }) => {
        if (failing.has(rows[0]?.key as string)) throw httpError(500);
        return { results: resultsFor(rows) };
      },
    });

    const summary = await runGeocode(options);

    expect(summary.error).toBeNull();
    expect(answered).toEqual(["k2"]);
    expect(abandoned).toEqual(["k0", "k1", "k3", "k4"]);
  });

  it("abandons a chunk at once when retrying cannot help", async () => {
    const send = vi.fn(async () => {
      throw httpError(403);
    });

    const { options } = harness({ lookups: lookups(1), send });

    const summary = await runGeocode(options);

    expect(send).toHaveBeenCalledTimes(1);
    expect(summary.failed).toBe(1);
  });

  it("stops between chunks when asked, keeping what already landed", async () => {
    let sent = 0;
    const { options, answered } = harness({
      lookups: lookups(4),
      batchSize: 1,
      send: async ({ rows }: { rows: { key: string; address: string }[] }) => {
        sent += 1;
        return { results: resultsFor(rows) };
      },
      // Skip pressed while the first chunk was in flight.
      shouldStop: () => sent >= 2,
    });

    const summary = await runGeocode(options);

    expect(summary.wasStopped).toBe(true);
    expect(summary.completed).toBe(2);
    expect(answered).toEqual(["k0", "k1"]);
  });

  it("stops mid-chunk when Skip aborted the request, without retrying it", async () => {
    // Skip aborts the in-flight fetch, which rejects with no status — the shape
    // a dropped connection has, and a dropped connection is retried.
    let stopped = false;
    const send = vi.fn(async () => {
      stopped = true;
      throw new Error("The operation was aborted.");
    });

    const { options, abandoned, waits } = harness({
      lookups: lookups(3),
      batchSize: 2,
      send,
      shouldStop: () => stopped,
    });

    const summary = await runGeocode(options);

    expect(send).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
    expect(abandoned).toEqual(["k0", "k1"]);
    expect(summary).toEqual({
      completed: 0,
      failed: 2,
      wasStopped: true,
      error: null,
    });
  });

  it("sends a smaller first chunk so the bar moves early", async () => {
    const sizes: number[] = [];
    const ranges: [number, number][] = [];

    await runGeocode(
      harness({
        lookups: lookups(12),
        batchSize: 5,
        firstBatchSize: 2,
        send: async ({ rows }: { rows: { key: string; address: string }[] }) => {
          sizes.push(rows.length);
          return { results: resultsFor(rows) };
        },
        onChunkStart: (from: number, to: number) => ranges.push([from, to]),
      }).options,
    );

    expect(sizes).toEqual([2, 5, 5]);
    expect(ranges).toEqual([
      [0, 2],
      [2, 7],
      [7, 12],
    ]);
  });

  it("moves the count per answer as a chunk streams in", async () => {
    const progress: number[] = [];
    const answeredAt: number[] = [];

    await runGeocode(
      harness({
        lookups: lookups(3),
        send: async ({ rows, onResult }) => {
          for (const result of resultsFor(rows)) onResult(result);
          return {};
        },
        onResult: () => answeredAt.push(progress.length),
        onProgress: (done: number) => progress.push(done),
      }).options,
    );

    // One step per address, inside the one request, then the chunk's close.
    expect(progress).toEqual([1, 2, 3, 3]);
    expect(answeredAt).toEqual([0, 1, 2]);
  });

  it("retries only the addresses a failed chunk had not answered yet", async () => {
    const asked: string[][] = [];

    const { options, answered, abandoned } = harness({
      lookups: lookups(4),
      send: async ({ rows, onResult }) => {
        asked.push(rows.map((row) => row.key));

        // The first attempt answers two, then the connection drops.
        if (asked.length === 1) {
          for (const result of resultsFor(rows.slice(0, 2))) onResult(result);
          throw httpError(502);
        }

        for (const result of resultsFor(rows)) onResult(result);
        return {};
      },
    });

    const summary = await runGeocode(options);

    expect(asked).toEqual([
      ["k0", "k1", "k2", "k3"],
      ["k2", "k3"],
    ]);
    expect(answered).toEqual(["k0", "k1", "k2", "k3"]);
    expect(abandoned).toEqual([]);
    expect(summary).toEqual({ completed: 4, failed: 0, wasStopped: false, error: null });
  });

  it("keeps what streamed in before Skip, and abandons only the rest", async () => {
    let stopped = false;

    const { options, answered, abandoned } = harness({
      lookups: lookups(3),
      send: async ({ rows, onResult }) => {
        onResult(resultsFor(rows)[0]!);
        stopped = true;
        throw new Error("The operation was aborted.");
      },
      shouldStop: () => stopped,
    });

    const summary = await runGeocode(options);

    expect(answered).toEqual(["k0"]);
    expect(abandoned).toEqual(["k1", "k2"]);
    expect(summary).toEqual({ completed: 1, failed: 2, wasStopped: true, error: null });
  });

  it("counts an answer once, however it arrives", async () => {
    // Streamed, and then returned again at the end by the same request.
    const { options, answered } = harness({
      lookups: lookups(2),
      send: async ({ rows, onResult }) => {
        const results = resultsFor(rows);
        for (const result of results) onResult(result);
        return { results };
      },
    });

    const summary = await runGeocode(options);

    expect(answered).toEqual(["k0", "k1"]);
    expect(summary.completed).toBe(2);
  });

  it("passes the server's reported pace back to the caller", async () => {
    const paces: (number | undefined)[] = [];

    await runGeocode(
      harness({
        send: async ({ rows }: { rows: { key: string; address: string }[] }) => ({
          results: resultsFor(rows),
          paceMs: 220,
        }),
        onProgress: (_done: number, pace?: number) => paces.push(pace),
      }).options,
    );

    // Progress is reported per answer too; only the chunk's close carries a pace.
    expect(paces.filter((pace) => pace !== undefined)).toEqual([220]);
  });

  it("has nothing to do with an empty plan", async () => {
    const summary = await runGeocode(harness({ lookups: [] }).options);

    expect(summary).toEqual({
      completed: 0,
      failed: 0,
      wasStopped: false,
      error: null,
    });
  });
});
