/**
 * One preview render at a time, across the whole page.
 *
 * Each render builds a MapLibre map with its own WebGL context, and Chrome keeps
 * about sixteen of those per page before it starts dropping the oldest — which
 * shows up as a blank canvas with nothing logged. Rendering in series keeps it at
 * one, and it also keeps the tile requests of fifteen maps from all landing on
 * the tile host in the same second.
 *
 * `isCancelled` is asked when a job's turn comes, not when it is queued: a card
 * that unmounted while it waited — the owner navigated away, or deleted the map —
 * gives its turn up rather than rendering a picture nobody will see.
 */

let tail: Promise<unknown> = Promise.resolve();

export function enqueue<T>(
  job: () => Promise<T>,
  isCancelled: () => boolean,
): Promise<T | null> {
  const turn = tail.then(() => (isCancelled() ? null : job()));

  // The next job waits for this one whether it worked or not.
  tail = turn.catch(() => undefined);

  return turn;
}
