"use client";

import dynamic from "next/dynamic";

import { MapSkeleton } from "./map-skeleton";

/**
 * The Europe map, loaded in the browser only.
 *
 * `ssr: false` because the server has nothing useful to send: thousands of dot
 * circles, and pins whose Motion `initial` would be written into the HTML as
 * invisible for anyone whose script never ran. The skeleton is the same box, so
 * the screen does not jump when the map arrives. It lives in a client module
 * because `next/dynamic` with `ssr: false` is refused in a server component.
 */
export const EuropeMapLoader = dynamic(() => import("./europe-map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});
