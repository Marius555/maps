/**
 * Where somebody is, as the browser tells it — the start of a Directions link.
 *
 * Moved here out of embed/src/search.ts, for the reason ./directions.ts is here
 * (CLAUDE.md §4): two things now route a person from their own position — the
 * embed's card and results list, and the dashboard's own pin card
 * (lib/geolocation/directions-origin.ts) — and every rule in this file is a bug
 * that shipped once. A second copy of `betterFix` or `bestPosition` on the
 * dashboard side would be those bugs waiting to ship again on one side only.
 * The embed still imports all of it from ./search, which re-exports it.
 *
 * Zero dependencies and vanilla TS, as that rule requires. Browser-only at call
 * time: nothing here touches `navigator` until a function is called.
 */

/**
 * Why a location lookup didn't produce one.
 *
 * Kept as a reason rather than flattened into a message, because the three the
 * browser reports need different things from the visitor: a blocked permission
 * has to be turned back on, a timeout is worth another try, and an unavailable
 * fix is nobody's fault. Collapsing them into one sentence — which is what the
 * bare `catch` here used to do — is wrong two times out of three.
 */
export type LocationFailure =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

export type LocationError = Error & { reason: LocationFailure };

export function locationError(
  reason: LocationFailure,
  message: string,
): LocationError {
  return Object.assign(new Error(message), { reason });
}

/** The reason off a rejection, for anything that reaches the catch some other way. */
export function locationFailure(error: unknown): LocationFailure {
  return (error as Partial<LocationError> | null)?.reason ?? "unavailable";
}

/**
 * Where the browser says the visitor is, and how sure it is.
 *
 * `accuracy` is the radius in metres the browser claims, and it is carried
 * because the two things that ask for a position want different answers about a
 * vague one. Sorting a list by distance is useful from a city-level fix — the
 * nearest of eight shops does not change over a kilometre — while a route's
 * start wants the sharpest reading of the session, which is what `betterFix`
 * below picks and `me` in embed/src/index.ts holds (and, on the dashboard,
 * lib/geolocation/directions-origin.ts).
 *
 * `timestamp` is the browser's own, straight off `GeolocationPosition`, and it
 * is here because **a reading can be sharp and still be wrong**: the embed's
 * `currentPosition` (embed/src/search.ts) accepts a cached fix up to five
 * minutes old, and without an age to compare
 * against, one of those permanently outranks every fresh reading that follows it
 * purely by claiming a smaller radius. See `betterFix`.
 */
export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

/**
 * Past this, a reading is describing where somebody *was*.
 *
 * It only has to be shorter than the embed's `currentPosition`'s `maximumAge`
 * of five minutes, which is the one thing that can hand back a fix old enough
 * to be somewhere else entirely.
 */
const STALE_AFTER_MS = 60_000;

/**
 * Which of two readings a route should start from — the session's answer to
 * "where is the visitor", decided one arrival at a time.
 *
 * **Fresh beats sharp, and that ordering is the whole point of this function.**
 * Comparing on `accuracy` alone is what it used to do, and it has a failure that
 * looks exactly like a correct answer: the embed's crosshair takes a deliberately
 * cheap cached fix (`currentPosition`, `maximumAge: 300_000`), so a reading taken five
 * minutes and one commute ago can arrive claiming a tighter radius than the
 * warm-up's live one — and then hold `me` for the rest of the session, sending
 * every Directions link to a confidently wrong street.
 *
 * Among readings of comparable age the sharper one wins, and **ties go to the
 * newcomer** so a visitor who has actually moved is followed.
 */
export function betterFix(current: Fix | null, next: Fix): Fix {
  if (!current) return next;

  const now = Date.now();
  const nextIsFresh = now - next.timestamp <= STALE_AFTER_MS;
  const currentIsFresh = now - current.timestamp <= STALE_AFTER_MS;

  // Only when exactly one of them is fresh; if both are stale there is nothing
  // better to be had and accuracy is still the best question to ask.
  if (nextIsFresh !== currentIsFresh) return nextIsFresh ? next : current;

  return next.accuracy <= current.accuracy ? next : current;
}

/**
 * How long to keep listening for a sharper reading.
 *
 * Nobody is ever blocked on this — both callers are fire-and-forget, which is
 * the correction this number's whole existence came out of. It was once spent
 * with a visitor watching an open blank tab, and three seconds of that is five
 * seconds of a broken-looking product.
 */
const SETTLE_MS = 3000;

/**
 * Sharp enough that a better reading would change nothing anyone can see, so
 * the watch stops rather than running out its window. A GPS fix is 5–20m.
 */
const SHARP_ENOUGH_M = 20;

/**
 * How long an ask raised by a Directions press keeps the browser's request open.
 *
 * Not `bestPosition`'s own three seconds, and the difference is a bug. That
 * number measures how long to keep *refining* a reading while somebody watches;
 * this one measures how long a visitor might take to answer a permission prompt
 * — and they are answering it on a different tab, because the Directions link
 * has already opened one in front of it.
 *
 * Three seconds is not merely too short, it is destructive: the settle timer
 * fires in the backgrounded tab, `bestPosition` clears its watch, and clearing
 * the only outstanding geolocation request is what **withdraws the prompt**. The
 * visitor comes back from Google Maps to nothing left to answer.
 *
 * Nothing is blocked on this and nobody is watching it, so the length costs
 * battery rather than time — and `bestPosition` stops the moment a reading is
 * sharp enough to use, which on anything with a GPS is a second or two. The only
 * session that runs this to the end is one on a device that never produces a
 * sharp fix, which is a desktop with no radio to spend.
 *
 * Shared because both asks use it: `installDirectionsAsk` in
 * embed/src/directions.ts and `askForOrigin` in
 * lib/geolocation/directions-origin.ts.
 */
export const PROMPT_WINDOW_MS = 30_000;

/**
 * The *best* reading the browser can give within a window — the route's start.
 *
 * **`getCurrentPosition` resolves on the first reading that satisfies the
 * options, and on a phone the first reading is the network fix.** The GPS one
 * lands a second or two later and is ten times better, and nothing that calls
 * `getCurrentPosition` ever sees it. That is the whole reason this exists:
 * `watchPosition` is handed every refinement, so keeping the sharpest one for a
 * couple of seconds is the one change that actually improves the number a
 * visitor is routed from.
 *
 * Resolves early the moment a reading is good enough to be used as-is
 * (`goodEnough`), because past that a better one changes nothing downstream and
 * the caller is sitting on an open, blank tab while it waits.
 *
 * Two rules about failure, and both are the difference between this and a
 * promisified `watchPosition`:
 *
 * - **A refusal ends it immediately.** Sitting out the window after a
 *   `PERMISSION_DENIED` is three seconds of a blank tab for an answer already
 *   given.
 * - **Any other error is one failed reading, not the outcome.** A later reading
 *   may still succeed, and one already taken is not undone by it — so it only
 *   decides anything if the window closes with nothing to show.
 */
export function bestPosition(
  withinMs = SETTLE_MS,
  goodEnough = SHARP_ENOUGH_M,
  /**
   * Told about every reading the moment it arrives, sharp or not.
   *
   * Without it the caller learns nothing until the window closes, so a
   * visitor pressing a second Directions link two seconds after the first
   * still has no origin — the warm-up is running and has an answer it is
   * sitting on. Safe to hand every reading to, because both things that
   * consume this (`remember` in embed/src/index.ts, and its dashboard twin in
   * lib/geolocation/directions-origin.ts) keep the sharpest of them through
   * `betterFix`, and a worse one arriving later changes nothing.
   */
  onReading?: (at: Fix) => void,
): Promise<Fix> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;

    if (!geo) {
      reject(
        locationError("unsupported", "This browser can't share a location."),
      );
      return;
    }

    let best: Fix | null = null;
    let failure: LocationError | null = null;
    let watch: number | null = null;

    const stop = () => {
      if (watch !== null) geo.clearWatch(watch);
      // Null rather than left set: `settle` can run from the timer and from a
      // reading in the same tick, and clearing a watch id twice is a browser
      // clearing somebody else's watch.
      watch = null;
      clearTimeout(timer);
    };

    const settle = () => {
      stop();

      if (best) resolve(best);
      else reject(failure ?? locationError("timeout", "Locating timed out."));
    };

    // Below `stop`, which closes over it: the closure is only ever *called*
    // after this line has run, so the reference resolves fine.
    const timer = setTimeout(settle, withinMs);

    watch = geo.watchPosition(
      (position) => {
        const fix = toFix(position);
        onReading?.(fix);
        if (!best || fix.accuracy < best.accuracy) best = fix;

        if (best.accuracy <= goodEnough) settle();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stop();
          reject(fromPositionError(error));
          return;
        }

        failure ??= fromPositionError(error);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

export function toFix(position: GeolocationPosition): Fix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    // The browser's own, never `Date.now()`: a cached reading is handed back
    // with the time it was *taken*, and that gap is the entire signal
    // `betterFix` exists to read.
    timestamp: position.timestamp,
  };
}

export function fromPositionError(
  error: GeolocationPositionError,
): LocationError {
  return locationError(
    error.code === error.PERMISSION_DENIED
      ? "denied"
      : error.code === error.TIMEOUT
        ? "timeout"
        : "unavailable",
    error.message,
  );
}
