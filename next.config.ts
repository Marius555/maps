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
    ];
  },
};

export default nextConfig;