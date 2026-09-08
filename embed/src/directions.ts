/**
 * The Directions link, and the one moment the embed asks where the visitor is.
 *
 * **A press never waits for anything.** The link opens immediately, every time,
 * carrying whatever origin is known at that moment. That is the whole shape of
 * this file and it is written from a bug: the version before it intercepted the
 * click, opened a tab and held it blank while it waited up to three seconds for
 * a sharper reading. On a machine with no GPS a sharper reading never comes, so
 * the wait always ran to the end — five seconds of nothing, for an answer that
 * was no better.
 *
 * **But a link already on screen learns.** Reading the position at draw time and
 * stopping there is what made the origin plumbing look like it did nothing: the
 * results panel is drawn once, synchronously, while every source of a position
 * is asynchronous — so **every row a visitor sees was built before anything knew
 * where they were**, and the panel is redrawn only by a keystroke, a filter or
 * the crosshair. A visitor could press the map's own locate control, watch it
 * draw an accuracy circle around their street, press Directions in the sidebar
 * and still be routed from their ISP's address. `refreshDirections` is the half
 * that was missing.
 *
 * **And the origin is sent even when it is vague.** There was an accuracy gate
 * here that dropped anything coarser than 50m, on the reasoning that Google with
 * no `origin` uses the visitor's own live location and snaps it to a road, which
 * would beat a coarse coordinate of ours. That is true only where Google has
 * been given a location of its own; where it has not, it falls back to the IP
 * address and starts the route in another town. Measured against a real
 * reporter: a coarse origin was a street off, and dropping it was kilometres
 * off. **A coarse origin beats no origin**, so the gate is gone and the only
 * thing we decline to send is nothing at all.
 *
 * What `accuracy` is still for is `me` in ./index.ts, which keeps the *sharpest*
 * reading of a session rather than the latest.
 *
 * One delegated listener rather than a handler per link: a card is rebuilt on
 * every pin click and the results list is rebuilt on every keystroke, so
 * per-link handlers are a subscription per row per redraw.
 */

import { bestPosition, locationFailure, type Fix } from "./search";
import {
  directionsUrl,
  type DirectionsTarget,
} from "@/packages/shared/directions";
import { link } from "./dom";
import type { Track } from "./track";

/**
 * What each link we built is a route *to*.
 *
 * A `WeakMap` and not a `Map`: the results list is rebuilt on every keystroke,
 * so a strong map would retain every anchor of every redraw of a 3,000-place map
 * — a leak that grows with typing. The key is the anchor, so an entry dies with
 * the row that held it, and the value is the snapshot's own place object, which
 * the snapshot retains for the life of the page anyway. Net retention is zero.
 *
 * Not a `data-` payload, because the target needs the place *name* for Apple's
 * `q=`, and a name is customer-authored text with commas and quotes in it.
 * Encoding it into an attribute costs more bytes than this and starts exactly
 * the habit ./dom.ts's header exists to prevent.
 */
const targets = new WeakMap<HTMLAnchorElement, DirectionsTarget>();

/**
 * A Directions link.
 *
 * Every renderer goes through this rather than calling `directionsUrl` itself —
 * three of them draw one (the card's links row, its Button block and the results
 * rows), and the rule about what a route may start from belongs in one place
 * rather than three.
 *
 * It takes a whole `Fix` rather than a bare origin so callers cannot be tempted
 * to strip the accuracy on the way here; `directionsUrl` reads the two fields it
 * wants and ignores the rest.
 */
export function directionsLink(
  className: string,
  label: string,
  /**
   * A whole `SnapshotPlace` at all three call sites; typed as the narrower
   * target plus an optional id because the routing rule genuinely needs only
   * three fields, and the id is carried for one reason: the marker attribute
   * below doubles as what the delegated listener reports.
   */
  place: DirectionsTarget & { id?: string },
  from: Fix | null,
): HTMLElement {
  const node = link(className, label, directionsUrl(place, from));

  // `link()` answers a <span> for an unsafe scheme. Ours is always https, so
  // this cannot currently miss — but the marker is what the delegated listener
  // below and `refreshDirections` recognise, and a span cannot carry a route.
  if (node instanceof HTMLAnchorElement) {
    /*
     * The marker carries the place id rather than a bare "1".
     *
     * Both selectors that read it are `[data-lm-dir]` with no value test, so
     * this changes nothing about who matches — and it is what lets the press
     * listener report *which* location a visitor asked directions to without a
     * second attribute, a second lookup or a wider `targets` value.
     */
    node.dataset.lmDir = place.id ?? "1";
    targets.set(node, place);
  }

  return node;
}

/**
 * Re-point every Directions link already on screen, now that we know better.
 *
 * **This is the half the origin plumbing was missing.** Every renderer reads the
 * visitor's position at the moment it draws — ./list.ts in `buildRow`, ./map.ts
 * at `buildPopup` — which is correct for anything drawn *after* an answer lands
 * and useless for everything drawn before one. The results panel is drawn once
 * at boot, synchronously, while all four things that learn a position are
 * asynchronous; so without this a visitor presses Directions on a link that was
 * frozen before the answer existed, and Google falls back to their IP address —
 * the exact bug `directionsUrl`'s `from` parameter was added to fix.
 *
 * Only `href`. Not the distances, not the order: `me` is where the visitor *is*
 * and the list's `origin` is what the panel measures from, and re-sorting the
 * whole list because somebody wanted directions to one shop is the map answering
 * a question nobody asked. See `installDirectionsAsk` below, and `me` in
 * ./index.ts.
 *
 * `root` is the whole `.lm-root`, which is what reaches the open pin card as
 * well: MapLibre appends a popup to the map's own container, which is inside it.
 *
 * Takes a `Fix` rather than `Fix | null` deliberately — there is no un-knowing
 * where somebody is, and `directionsUrl` already declines to emit an empty
 * origin.
 */
export function refreshDirections(root: ParentNode, from: Fix): void {
  root.querySelectorAll<HTMLAnchorElement>("a[data-lm-dir]").forEach((node) => {
    const place = targets.get(node);

    // Anything wearing the marker that we did not build — a host page's own
    // markup, a node cloned out from under us — is left exactly as it is.
    if (place) node.href = directionsUrl(place, from);
  });
}

/**
 * How long the ask keeps the browser's request open.
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
 */
const PROMPT_WINDOW_MS = 30_000;

/**
 * Learn where the visitor is, starting from the first Directions press.
 *
 * **This handler does not touch the navigation.** It does not `preventDefault`,
 * open a tab, or read the href — the browser opens the link exactly as it would
 * with no script on the page, and the lookup runs behind it. So the first press
 * is the one that pays: it goes out with whatever origin was already known
 * (often none), and `refreshDirections` re-points every link on screen the
 * moment an answer lands. That is a deliberate trade against the alternative,
 * which is holding a blank tab open while a permission prompt is answered.
 *
 * The press is a reasonable moment to ask, because it is the one gesture on the
 * map that is *about* the visitor's own position.
 */
export function installDirectionsAsk(
  root: HTMLElement,
  getMe: () => Fix | null,
  onLocated: (at: Fix) => void,
  track: Track,
): void {
  /** A lookup is in flight. Guards concurrency, not a second question. */
  let asking = false;
  /**
   * The visitor decided, and the decision was no.
   *
   * **Separate from `asking` on purpose, and that separation is a bug fixed.**
   * One `asked` flag, set before the lookup and never cleared, meant a window
   * that closed having produced *nothing* permanently prevented a second ask —
   * so a visitor whose prompt was withdrawn by the timer above got one chance
   * they never saw, and every Directions link for the rest of the session went
   * out with no origin. "Ask at most once" is a rule about a refusal, which is
   * something the visitor did. Silence is not a refusal.
   *
   * `unsupported` latches too: no `navigator.geolocation` at all is not a
   * decision, but it is permanent, and re-asking a browser with no API is pure
   * waste. A timeout or an unavailable fix is neither, so those retry.
   */
  let refused = false;

  const ask = () => {
    // Already asking, already refused, or somebody already knows — the
    // crosshair, the map's own geolocate control, or the warm-up at boot.
    if (asking || refused || getMe()) return;

    asking = true;

    /*
     * Reported per reading rather than once at the end — a visitor who presses a
     * second link inside the window should not be told nothing while an answer
     * is being sat on — and now with a real consequence: `remember` in
     * ./index.ts calls `refreshDirections`, so each reading re-points every link
     * already drawn rather than only the ones drawn after it.
     */
    void bestPosition(PROMPT_WINDOW_MS, undefined, onLocated).then(
      () => {
        asking = false;
      },
      (error: unknown) => {
        asking = false;

        const reason = locationFailure(error);
        refused = reason === "denied" || reason === "unsupported";
      },
    );
  };

  const press = (event: Event) => {
    const anchor = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "a[data-lm-dir]",
    );
    if (!anchor) return;

    /*
     * Reported on `click` only, though this handler runs for both events below.
     *
     * A mouse press fires `pointerdown` then `click`, so reporting on the first
     * would count every directions press twice; and a `pointerdown` the visitor
     * drags away from is not a press at all. `click` is the one event that fires
     * exactly once per activation and fires for the keyboard too.
     *
     * `sendBeacon` inside a click handler is safe — it hands the payload to the
     * browser and returns. Nothing here calls `preventDefault`, opens a window,
     * or awaits anything, which is the rule embed/dev/dev.html:174-182 states.
     */
    if (event.type === "click") track("directions", { id: anchor.dataset.lmDir ?? "" });

    ask();
  };

  /*
   * **`pointerdown` first, and `click` as well.**
   *
   * `pointerdown` fires before the browser starts opening the tab, so the
   * request is raised while this document is still the visible one — which is
   * the state a browser requires before it will paint a permission prompt at
   * all. By `click` the tab is already going and this page is on its way to
   * hidden.
   *
   * `click` stays for the keyboard: Enter on a focused link fires it and no
   * pointer event at all, and a control that works only with a mouse fails the
   * quality floor. Both funnel through one guard, so two events are one ask.
   *
   * Not `pointerenter`. Asking for somebody's location because a pointer crossed
   * a link is precisely how a prompt becomes something people block at the
   * browser level.
   */
  root.addEventListener("pointerdown", press);
  root.addEventListener("click", press);
}
