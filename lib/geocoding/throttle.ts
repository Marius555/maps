/**
 * A single-file queue that spaces outbound requests.
 *
 * Public geocoders are shared infrastructure and rate-limit hard; a 500-row CSV
 * fired off in parallel gets us blocked and the customer a half-imported map.
 * Every provider call goes through here, so the pace is set in one place.
 *
 * Process-local, therefore per-instance. Good enough while imports are a handful
 * of concurrent users; when it isn't, this is where a shared limiter goes.
 */
export function createThrottle(minIntervalMs: number) {
  let tail: Promise<void> = Promise.resolve();

  return function throttle<T>(task: () => Promise<T>): Promise<T> {
    // Each call chains onto the previous one, so the gap is enforced between
    // starts even when callers arrive all at once.
    const result = tail.then(task);

    tail = result.then(
      () => sleep(minIntervalMs),
      // A rejection must not break the chain, or one failed row would stall
      // every row queued behind it.
      () => sleep(minIntervalMs),
    );

    return result;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
