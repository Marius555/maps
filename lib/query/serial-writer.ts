/**
 * Whole-value writes, one at a time, latest wins.
 *
 * **The bug this exists for (2026-11-07).** The Publish designer saves
 * `maps.settings` as one JSON blob, 400ms after each change. Two presses a
 * second apart were two PATCHes in flight at once, and nothing ordered them: a
 * slow first reply landing after the second wrote the *older* settings into the
 * query cache, and the server could commit them in that order too. The owner's
 * report was that switches "sometimes do the exact opposite" — the switch, the
 * preview and the stored row had all walked back to the previous press.
 *
 * So a write never overlaps another. A value written while one is in flight
 * waits, and any later value replaces it — only the newest is worth sending,
 * because each one is the whole blob. The replies then arrive in the order the
 * presses were made, which is the only order a whole-value write can be read in.
 *
 * Pure and framework-free so the ordering can be tested without React.
 */
export type SerialWriter<T> = {
  /** Send `value` now, or as soon as the write in flight settles. */
  write: (value: T) => Promise<void>;
  /** Resolves once nothing is in flight and nothing is waiting. */
  idle: () => Promise<void>;
  /** Something is in flight or waiting. */
  readonly isBusy: boolean;
};

export function createSerialWriter<T>(
  send: (value: T) => Promise<unknown>,
): SerialWriter<T> {
  let queued: { value: T } | null = null;
  let running: Promise<void> | null = null;

  const pump = (): Promise<void> => {
    if (running) return running;

    running = (async () => {
      while (queued) {
        const { value } = queued;
        queued = null;

        try {
          await send(value);
        } catch {
          // The caller reports its own errors (the mutation holds them). A
          // failure must not strand the value pressed after it.
        }
      }

      running = null;
    })();

    return running;
  };

  return {
    write: (value) => {
      queued = { value };
      return pump();
    },
    idle: () => running ?? Promise.resolve(),
    get isBusy() {
      return running !== null || queued !== null;
    },
  };
}
