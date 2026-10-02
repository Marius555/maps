/**
 * What the map reads off the host page once it is running, and how it reports.
 *
 * Split from `config.ts`, which belongs to the loader (`boot.ts`, shipped as
 * `map.js`) alone. The two halves are separate files on purpose: a module both
 * of them imported would be hoisted into `map.js`, and the app chunk would then
 * import it back from `./map.js` — a second copy of the loader, evaluated
 * again, on any page whose CMS adds `?ver=` to the script URL.
 */

/**
 * The location to open on, from the host page's own URL: `?place=<id>`.
 *
 * Read from `window.location` rather than an attribute, which is only possible
 * because the embed is a module script on the page itself and not an iframe —
 * so a customer can link to one of their stockists with a normal URL on their
 * own domain, and it survives being copied out of the address bar.
 *
 * Read-only, deliberately. Writing back to a stranger's address bar when a popup
 * opens would rewrite history on a page we are a guest on.
 *
 * An id belonging to a different map on the same page simply won't be found in
 * this snapshot, which is what makes several maps per page work with no config.
 */
export function readFocusPlaceId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("place");
  } catch {
    return null;
  }
}

/**
 * Problems are reported to the console and nowhere else. This code runs on
 * someone else's website — it must never paint an error message into their page.
 */
export function warn(message: string): void {
  console.warn(`[map embed] ${message}`);
}
