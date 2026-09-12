import type { NextConfig } from "next";

/**
 * The embed is served from here in development and from a CDN in production.
 * Either way it is fetched by pages on domains that are not ours, and two things
 * about it require CORS headers:
 *
 * - `<script type="module">` is always fetched in CORS mode, unlike a classic
 *   script tag. MapLibre v6 is ESM only, so the embed has to be a module.
 * - MapLibre loads a cross-origin worker by creating a blob that imports the
 *   worker's absolute URL, which is another cross-origin module fetch.
 *
 * Without these headers the embed fails on every customer site while working
 * perfectly on ours — the kind of bug that only shows up in production.
 *
 * `*` is correct here: these are public static files, served with no session and
 * no credentials. Nothing behind them is user-specific.
 */
const embedCorsHeaders = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
 
];

const nextConfig: NextConfig = {
  // Allow your local network IP to access the HMR/dev resources
  allowedDevOrigins: ["192.168.1.212"],

  async headers() {
    return [
      { source: "/embed/:path*", headers: embedCorsHeaders },
      { source: "/maplibre/:path*", headers: embedCorsHeaders },
      // The gazetteer the embed's search fetches, on the same argument: static
      // public files, read by pages on domains that are not ours.
      { source: "/gazetteer/:path*", headers: embedCorsHeaders },
      // Our own basemap styles, fonts, sprites and raster tiles, once
      // NEXT_PUBLIC_TILES_URL points here rather than at a CDN. Same argument
      // again, and the failure without it is the same shape: labels and icons
      // that render perfectly on our domain and nowhere else.
      { source: "/tiles/:path*", headers: embedCorsHeaders },
      /*
       * The analytics collector, and the one place `/api` is opened up.
       *
       * Everything above is a static public file. This is a route handler that
       * writes to the database, so the reasoning has to be made separately
       * rather than inherited:
       *
       * - `*` is still correct, because *any* domain may legitimately post here.
       *   A published map can be embedded anywhere its owner allows, and the
       *   allowlist that decides which is checked inside the handler against the
       *   browser-set `Origin` — not by refusing the response.
       * - It grants nothing. The route reads no cookie, returns no body, and
       *   answers 204 to everything it drops, so a permissive header lets a
       *   stranger's page learn exactly what it could learn by getting no
       *   response at all.
       * - Without it the write still happens — a `sendBeacon` is delivered
       *   whatever the response says — but the browser logs a CORS error on the
       *   customer's own site, and a stranger's site must never sprout our
       *   diagnostics (embed/src/index.ts).
       *
       * Scoped to the exact path. `/api/:path*` would open every authenticated
       * route in the app to cross-origin reads.
       */
      { source: "/api/collect", headers: embedCorsHeaders },
    ];
  },

  async redirects() {
    return [
      /*
       * `/dashboard` is what most people type, and what every generic
       * integration recipe assumes. This app's dashboard is `/maps`.
       *
       * A redirect rather than a page, so there is no second signed-in screen to
       * keep in step with the real one. It needs no guard of its own: a
       * signed-out visitor lands on `/maps`, which *is* in `proxy.ts`'s matcher,
       * and gets `/login?next=/maps` from there.
       *
       * Not permanent. A 308 is cached by the browser essentially forever, and
       * this is a convenience alias rather than a decision we want to be unable
       * to reverse.
       */
      { source: "/dashboard", destination: "/maps", permanent: false },
    ];
  },
};

export default nextConfig;