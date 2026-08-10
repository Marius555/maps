/**
 * A pacer that spaces outbound requests.
 *
 * Public geocoders are shared infrastructure and rate-limit hard; a 500-row CSV
 * fired off in parallel gets us blocked and the customer a half-imported map.
 * Every provider call goes through here, so the pace is set in one place.
 *
 * What is spaced is request *starts*, not round trips. This used to be a promise
 * chain — each task waited for the previous one to settle and *then* slept the
 * interval — so the real gap was latency plus the interval, and every caller
 * behind it paid that cumulatively. A pin dropped during a ten-row import waited
 * about thirteen seconds for a lookup that takes three hundred milliseconds,
 * which was the whole of "the address sometimes takes forever". Handing out timed
 * slots instead makes the wait the interval and nothing else, and a slow or hung
 * request can no longer hold the line behind it.
 *
 * Process-local, therefore per-instance. Good enough while imports are a handful
 * of concurrent users; when it isn't, this is where a shared limiter goes.
 */
export function createThrottle(minIntervalMs: number) {
  /**
   * The earliest the next task may start.
   *
   * Claimed synchronously, before anything is awaited: callers arriving in the
   * same tick must each take their own slot, and a value only advanced after the
   * sleep would hand every one of them the same one.
   */
  let nextStartAt = 0;

  return function throttle<T>(task: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Clamped to now, so an idle minute banks no credit for a later burst and a
    // slot left in the past cannot release several tasks at once.
    const startAt = Math.max(now, nextStartAt);
    nextStartAt = startAt + minIntervalMs;

    const wait = startAt - now;

    /*
     * The slot is already claimed, so a rejected task cannot stall the ones
     * behind it and needs no handling here — the caller gets its own error,
     * unwrapped.
     *
     * The zero-wait path still goes through a resolved promise rather than
     * calling `task` directly: a task that throws on its first line must reject
     * this promise rather than the caller's stack frame.
     */
    return (wait > 0 ? sleep(wait) : Promise.resolve()).then(task);
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
