/**
 * A timeout that only counts time the page is visible.
 *
 * A hidden tab stops `requestAnimationFrame`, and MapLibre fires both `load` and
 * `idle` from inside its frame — so a map that was halfway through loading when
 * the owner switched tabs makes no progress at all until they come back. A plain
 * `setTimeout` keeps counting through that, and a render that would have finished
 * a second after the tab returned is failed as "didn't load in time" instead.
 *
 * Returns a function that cancels it.
 */
export function visibleDeadline(ms: number, onExpire: () => void): () => void {
  let remaining = ms;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    startedAt = performance.now();
    timer = setTimeout(expire, remaining);
  };

  const pause = () => {
    clearTimeout(timer);
    timer = undefined;
    remaining -= performance.now() - startedAt;
  };

  const onChange = () => {
    if (document.visibilityState === "visible") {
      if (timer === undefined) run();
    } else if (timer !== undefined) {
      pause();
    }
  };

  function expire() {
    cancel();
    onExpire();
  }

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
    document.removeEventListener("visibilitychange", onChange);
  }

  document.addEventListener("visibilitychange", onChange);
  if (document.visibilityState === "visible") run();

  return cancel;
}
