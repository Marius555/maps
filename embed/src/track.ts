import type { MapSnapshot } from "@/packages/shared/snapshot";

/**
 * What the visitor did, reported once.
 *
 * This is the only thing in the embed that talks to a server of ours at runtime,
 * and CLAUDE.md §2 is the reason it is shaped the way it is: **one request per
 * session, not one per event.** Everything is queued in memory and flushed once,
 * when the page goes away. A visitor who opens four locations, searches twice
 * and presses Directions is one `sendBeacon` and one row — not seven. That ratio
 * is the whole argument for letting a beacon exist at all; the arithmetic is in
 * docs/notes/analytics.md.
 *
 * Absent `snapshot.analytics` means **nothing happens**: no endpoint, no session
 * id, no listeners, no timer. `createTracker` hands back a no-op and the call
 * sites cost one function call each. That is what makes it safe to leave the
 * calls unconditional, and it is what every map published before this shipped
 * gets forever.
 *
 * Three rules this file must keep:
 *
 * - **`sendBeacon`, never `fetch`.** embed/dev/dev.html:174-182 says a Directions
 *   press must open instantly and must never be intercepted. `sendBeacon` hands
 *   the payload to the browser and returns synchronously; an awaited `fetch` in
 *   a click handler is exactly the thing that rule forbids.
 * - **`text/plain`, not `application/json`.** `text/plain` is CORS-safelisted, so
 *   there is no preflight. JSON would double the request count — two requests per
 *   session instead of one — which is half the cost argument gone for a header.
 * - **No cookie and no storage.** The session id lives in a closure and dies with
 *   the page. Nothing here follows a visitor between page loads or between sites,
 *   which is what keeps this out of consent-banner territory. Do not "improve"
 *   it by remembering the id.
 */

export type Track = (type: string, data?: Record<string, string | number>) => void;

/** Cheaper than checking for a tracker at every call site. */
const NOOP: Track = () => {};

/**
 * Caps, all of them deliberate.
 *
 * The queue cap bounds a page left open all day, or a bot clicking in a loop.
 * The string cap bounds a search box someone pasted a novel into. The payload
 * cap is the backstop: `sendBeacon` silently returns false past the browser's own
 * quota, and a dropped beacon is worse than a truncated one. The server clamps
 * all three again — these are for our bandwidth, not for its trust.
 */
const MAX_EVENTS = 60;
const MAX_STRING = 80;
const MAX_BODY = 8000;

/**
 * How long a session may sit unflushed.
 *
 * `pagehide` is the normal flush and covers a closed tab, a navigation and a
 * backgrounded mobile browser. This timer covers the case it does not: a map
 * left open in a foreground tab for an hour, where the visitor's whole session
 * would otherwise be lost to a crash or a killed process.
 */
const IDLE_MS = 30_000;

export function createTracker(snapshot: MapSnapshot): Track {
  const config = snapshot.analytics;

  // No endpoint, or a browser without the one API this is allowed to use. Either
  // way the answer is the same: measure nothing.
  if (!config || typeof navigator.sendBeacon !== "function") return NOOP;

  const started = Date.now();
  // Enough to separate two visitors in the same second; deliberately not enough
  // to identify anybody. It never leaves this closure.
  const session = Math.random().toString(36).slice(2) + started.toString(36);

  let queue: Record<string, string | number>[] = [];
  let timer = 0;

  const flush = () => {
    if (queue.length === 0) return;

    const body = JSON.stringify({
      v: 1,
      m: snapshot.mapId,
      s: session,
      // No client timestamp. The server dates a session from its own clock and
      // the session's own longest offset, because a browser's clock can be
      // years out and a row dated from one would land in the wrong month.
      // The customer's own page. `h` is which site the map is on and `p` is
      // which of its pages — the second is worth sending because the default
      // referrer policy strips the path from cross-origin requests, so the
      // server cannot recover it from a header.
      h: location.hostname,
      p: location.pathname,
      // Where the visitor came from *before* the customer's page. A different
      // question from the two above, and the one that answers "is this map
      // getting traffic from search".
      r: document.referrer,
      e: queue,
    });

    // Cleared before the send, not after: a beacon the browser refuses must not
    // be retried on the next flush, or one oversized session poisons the rest.
    queue = [];
    clearTimeout(timer);
    timer = 0;

    if (body.length <= MAX_BODY) {
      navigator.sendBeacon(config.url, new Blob([body], { type: "text/plain" }));
    }
  };

  addEventListener("pagehide", flush);
  // On `document`, which is where `visibilitychange` is dispatched. It reaches
  // window too, but only because the event bubbles — and binding to the thing
  // that fires it is one word longer and cannot be broken by that changing.
  //
  // Not `pagehide`'s twin: on mobile a backgrounded tab fires this and may never
  // fire `pagehide` at all before being discarded.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  return (type, data) => {
    if (queue.length >= MAX_EVENTS) return;

    // `o` is milliseconds since the map booted. It is what lets the dashboard
    // say how long a session lasted without a second timestamp per event.
    const event: Record<string, string | number> = { t: type, o: Date.now() - started };

    if (data) {
      for (const key in data) {
        const value = data[key];
        event[key] = typeof value === "string" ? value.slice(0, MAX_STRING) : value;
      }
    }

    queue.push(event);

    if (queue.length >= MAX_EVENTS) flush();
    // One-shot, armed by the first event of a session rather than reset by every
    // one — a visitor clicking steadily for ten minutes should still be recorded
    // if their browser dies at minute eleven.
    else if (!timer) timer = window.setTimeout(flush, IDLE_MS);
  };
}

/**
 * Everything a visitor presses inside a card or a results row, from one
 * listener: phone, email, website, an owner's own call-to-action, the photo
 * gallery, and the folds that hide the description and the opening hours.
 *
 * Delegated on the root for the same reason `installDirectionsAsk` is: a card is
 * rebuilt on every pin click and the list on every keystroke, so a handler per
 * control is a subscription per row per redraw. One listener is also what keeps
 * this inside the embed's size budget — six call sites of `track(...)` would
 * cost more than the whole function.
 *
 * Only our own controls: `[class^="lm-"]` is what keeps MapLibre's attribution
 * links and its zoom buttons out of the numbers.
 */
export function trackLinks(root: HTMLElement, track: Track): void {
  /*
   * **Capture, not bubble.** The gallery's own step buttons call
   * `stopPropagation` — a click that reaches the canvas pans the map underneath
   * the card — so a bubble-phase listener on the root never sees them. Capture
   * visits the root on the way *down*, before any handler can stop anything,
   * which also means nothing added to a card later can silently drop out of the
   * numbers.
   */
  root.addEventListener(
    "click",
    (event) => {
      const hit = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        'a[class^="lm-"], .lm-popup__step, summary[class^="lm-popup__"]',
      );

      // Directions is excluded because ./directions.ts already reports it, off
      // the same marker it needs for its own reasons.
      if (!hit || hit.dataset.lmDir) return;

      const id = hit.closest<HTMLElement>("[data-lm-place]")?.dataset.lmPlace ?? "";

      if (hit.tagName === "SUMMARY") {
        /*
         * Opens only. A `<summary>` press fires for both directions, and
         * "opened the hours 200 times" is a fact about what visitors wanted;
         * "opened and closed it 400 times" is the same fact counted twice. Read
         * before the toggle, which capture guarantees — so `open` false here
         * means this press is about to open it.
         */
        if ((hit.parentElement as HTMLDetailsElement | null)?.open) return;

        // The class, unmapped. Which fold it was is copy, and copy belongs in
        // the dashboard, not in bytes every visitor downloads.
        return track("fold", { k: hit.className, id });
      }

      if (hit.tagName !== "A") return track("gallery", { id });

      /*
       * The scheme is the category. `tel:` and `mailto:` are the two presses a
       * store locator exists to produce; everything else our card draws — the
       * website row, an owner's custom call-to-action — is somebody leaving for
       * the customer's own site, which is the third thing worth counting.
       */
      const href = hit.getAttribute("href") ?? "";

      track(
        href.startsWith("tel:") ? "tel" : href.startsWith("mailto:") ? "email" : "site",
        { id },
      );
    },
    true,
  );
}
