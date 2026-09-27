"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Whether a write has happened since the client router cache was last trusted.
 *
 * `next.config.ts` keeps a visited page for 30 seconds (`staleTimes.dynamic`),
 * so going back to one replays its server render instead of asking again. Most
 * pages do not care, because they draw from TanStack Query's cache, which every
 * mutation already updates. Some props exist *only* in the server render — the
 * counts and "edited" time on each map card, Usage's figures, the Import page's
 * headroom — and after adding a location in the editor, Maps showed the old
 * count for up to half a minute.
 *
 * So every successful mutation raises this flag (the `MutationCache` in
 * `client.ts`), and the next navigation lowers it with a `router.refresh()`:
 * the page arrives instantly from the cache and then updates in place, and the
 * refresh empties the rest of the router cache so nothing else is replayed stale
 * either. One cross-cutting rule rather than a refresh in each hook, for the
 * same reason the unverified-email toast lives there: it covers the mutations
 * nobody has written yet.
 */
let stale = false;

export function markServerRenderStale(): void {
  stale = true;
}

/**
 * Refreshes the page just navigated to when a write happened since the last
 * navigation. Mounted once, in the dashboard shell.
 *
 * Not on first mount: that render came from the server a moment ago. A
 * navigation that did go to the server pays one redundant refresh after a
 * write, which is the price of not being able to tell which ones did.
 */
export function useRefreshStaleRoute(): void {
  const router = useRouter();
  const pathname = usePathname();
  const shownPath = useRef(pathname);

  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;

    if (!stale) return;
    stale = false;
    router.refresh();
  }, [pathname, router]);
}
