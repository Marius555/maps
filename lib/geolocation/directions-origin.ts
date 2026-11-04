/**
 * Where the person pressing Directions on a *dashboard* card is — the start of
 * the route the link hands to Google or Apple.
 *
 * **The bug this exists for:** the editor's pin card built its Directions link
 * with no origin at all, on the reasoning that the dashboard "has no visitor to
 * locate". It has one — the owner, pressing it to check the card. With no
 * `origin`, Google fills its start box with "Your location" and resolves that
 * itself, and where google.com has no location permission of its own (measured:
 * denied, on the reporting owner's desktop) it falls back to the IP address. The
 * route started in another district, while the published embed — which has
 * sent `&origin=` for a long time — routed the same person correctly.
 *
 * So this is the embed's rule, held on the dashboard's side of the seam:
 *
 * - **The press is never intercepted.** Nothing here touches the navigation;
 *   the link opens with whatever is known, and the lookup runs behind it.
 *   embed/src/directions.ts has the history of why holding a tab open for a
 *   position was reverted.
 * - **A grant already given is used without asking** (`warmOrigin`), and a
 *   grant given later — in answer to the first press — is picked up by the
 *   permission's `change` event.
 * - **The sharpest *recent* reading wins**, through the same `betterFix` the
 *   embed uses (@/packages/shared/position.ts), so the two sides cannot drift.
 * - **Only a refusal latches.** Silence or a timeout asks again on the next
 *   press.
 *
 * A module-level store rather than React state, because every open card reads
 * the same answer and a card already on screen has to learn it when it lands —
 * the dashboard's version of the embed's `refreshDirections`. React reads it
 * through `useDirectionsOrigin` in components/card/directions/.
 *
 * Browser-only at call time, and guarded: a card can be rendered on the server,
 * where there is no `navigator` and the answer is simply "nobody knows".
 */

import {
  betterFix,
  bestPosition,
  locationFailure,
  PROMPT_WINDOW_MS,
  type Fix,
} from "@/packages/shared/position";

let origin: Fix | null = null;
const listeners = new Set<() => void>();

/** A lookup is in flight. Guards concurrency, not a second question. */
let asking = false;
/**
 * The browser said no, or cannot answer at all.
 *
 * Kept in step with the permission's own state as well as with a failed ask:
 * inside the Shopify admin the frame's permissions policy blocks geolocation,
 * the permission reads `denied` from the start, and asking anyway only logs a
 * policy violation on every press. A grant made later clears it.
 */
let refused = false;
let warmed = false;

export function getOrigin(): Fix | null {
  return origin;
}

export function subscribeOrigin(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * The one writer of `origin`.
 *
 * Identity, as in the embed's `remember`: `betterFix` hands back one of the two
 * objects it was given, so `best === origin` means the answer did not move and
 * nothing needs to redraw.
 */
function remember(at: Fix): void {
  const best = betterFix(origin, at);
  if (best === origin) return;

  origin = best;
  listeners.forEach((listener) => {
    listener();
  });
}

/**
 * Learn the position without asking, when this origin has already been allowed.
 *
 * Once per page load, however many cards mount. `permissions.query` is a read
 * of a decision already taken and never raises a prompt; a browser without it
 * (Safari rejects the `geolocation` name) keeps today's behaviour, which is a
 * link with no origin until a press asks.
 */
export function warmOrigin(): void {
  if (warmed || typeof navigator === "undefined") return;
  warmed = true;

  void navigator.permissions
    ?.query({ name: "geolocation" })
    .then((permission) => {
      const read = () => {
        refused = permission.state === "denied";
        if (permission.state !== "granted") return;

        // Per reading, so a card on screen gets an origin from the first fix
        // rather than after the whole settle window.
        void bestPosition(undefined, undefined, remember).catch(() => {
          // Nothing within the window, or the grant withdrawn in between. The
          // link keeps whatever it had.
        });
      };

      permission.addEventListener("change", read);
      read();
    })
    .catch(() => {
      // No Permissions API for geolocation. A press still asks.
    });
}

/**
 * Ask where this person is, because they just pressed Directions.
 *
 * Bound to `pointerdown` as well as `click` on the link, for the embed's
 * reason: `pointerdown` fires while this tab is still the visible one, which a
 * browser requires before it will paint a permission prompt, and `click` is
 * what Enter on a focused link fires. One guard makes the two events one ask.
 *
 * Returns nothing and never throws, so it can sit on an anchor's handlers with
 * nothing awaited and nothing prevented.
 */
export function askForOrigin(): void {
  if (asking || refused || origin || typeof navigator === "undefined") return;

  asking = true;

  void bestPosition(PROMPT_WINDOW_MS, undefined, remember).then(
    () => {
      asking = false;
    },
    (error: unknown) => {
      asking = false;

      const reason = locationFailure(error);
      refused = reason === "denied" || reason === "unsupported";
    },
  );
}
