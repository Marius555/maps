import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

import { maplibreDir } from "./channel.mjs";

/**
 * The installed MapLibre's folder, e.g. 'maplibre-6.11.2'. A new version gets a
 * new folder rather than overwriting the old files, so a cached map.js from the
 * last release keeps loading the MapLibre it was built against (embed/channel.mjs).
 */
const MAPLIBRE_DIR = maplibreDir(
  JSON.parse(
    readFileSync(createRequire(import.meta.url).resolve("maplibre-gl/package.json"), "utf8"),
  ).version,
);

/**
 * The embed build target (CLAUDE.md §4).
 *
 * Separate from the dashboard on purpose: this bundle loads on strangers'
 * websites, so it gets MapLibre, pmtiles and our own code — no React, HeroUI,
 * Motion, TanStack Query, Zustand or Appwrite SDK.
 *
 * ES module output, because MapLibre v6 ships ESM only — there is no UMD or CSP
 * build to fall back to. That is why the snippet uses `type="module"`, and why
 * the code finds its own script tag by attribute rather than through
 * `document.currentScript`, which is always null in a module.
 *
 * MapLibre is deliberately NOT bundled
 * ------------------------------------
 * Bundling it inlines `maplibre-gl-shared.mjs` (131KB gzipped) into map.js —
 * and the worker then fetches its own copy of that same chunk, because a worker
 * cannot share the main thread's module graph. The visitor downloads it twice:
 * 424KB gzipped in total.
 *
 * Shipping MapLibre's own dist files side by side instead means both the main
 * thread and the worker import the *same* ./maplibre-gl-shared.mjs URL, so the
 * browser fetches it once. That is 136KB saved for every visitor, and the
 * reason for the `external` + `output.paths` pair below.
 *
 * PostCSS is pinned to an empty plugin list so Vite doesn't discover the
 * dashboard's postcss.config.mjs and run Tailwind over the embed's stylesheet.
 */
export default defineConfig({
  root: resolve(import.meta.dirname),
  // Read by boot.ts and worker.ts, which name the other two MapLibre files.
  define: { __MAPLIBRE_DIR__: JSON.stringify(MAPLIBRE_DIR) },
  /**
   * The manual test harness (embed/dev/) is copied into the build output, so it
   * sits next to map.js: /embed/live.html points the real bundle at a real
   * published snapshot, and /embed/dev-legacy.html at a pre-merge one (§7).
   * (/embed/dev.html, against a hand-written fixture, was deleted on 2026-10-02
   * once the fixture had drifted from anything a publish writes.)
   *
   * It lands in public/embed/, which is gitignored, so the harness is committed
   * as source and never checked in at its served path. **That is not the same as
   * never deployed, and this comment used to claim it was.** `prebuild` runs
   * `build:embed`, so a production build regenerates public/embed/ on the host
   * and both pages are reachable there.
   *
   * Which is now deliberate rather than merely true: the Publish page's "Open
   * test page" button links to /embed/live.html, so an owner can see what they
   * published. Both pages are `noindex`, and live.html only loads a snapshot that
   * is already a public file.
   */
  publicDir: resolve(import.meta.dirname, "dev"),
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "..") },
  },
  css: { postcss: { plugins: [] } },
  build: {
    outDir: resolve(import.meta.dirname, "..", "public", "embed"),
    // The MapLibre dist files are copied in after this build, not before.
    emptyOutDir: true,
    // Broad enough for anything that can run MapLibre at all.
    target: "es2020",
    cssTarget: ["chrome111", "safari16.4", "firefox128", "edge111"],
    sourcemap: true,
    lib: {
      // The loader; it imports the map itself (src/index.ts) as a second chunk.
      // See the head of src/boot.ts for why that split is the fast path.
      entry: resolve(import.meta.dirname, "src", "boot.ts"),
      formats: ["es"],
      fileName: () => "map.js",
    },
    rollupOptions: {
      // pmtiles stays bundled — it is small, and it has no worker of its own to
      // share a chunk with.
      external: ["maplibre-gl"],
      output: {
        // Rewrites the bare specifier to a file in the versioned folder beside
        // map.js on our origin. scripts/copy-maplibre-worker.mjs puts it there.
        paths: { "maplibre-gl": `./${MAPLIBRE_DIR}/maplibre-gl.mjs` },
        /*
         * The map chunk the loader imports. Hashed, so a new build never meets a
         * cached copy of the old one, and old ones stay valid for any visitor
         * still holding an old map.js. Never "maplibre-gl*": that prefix is how
         * check-embed-size.mjs tells MapLibre from our own code.
         */
        chunkFileNames: "map-[hash].js",
        /*
         * Here rather than `build.minify`, which library mode deliberately
         * weakens for ES output — Vite keeps the whitespace so a consumer's
         * bundler can still tree-shake it. Nobody bundles this file; it is
         * loaded as-is on strangers' pages, so every space and full local name
         * was shipped for nothing. Measured on 2026-09-25: ours went from 49.1KB
         * to 45.6KB gzipped. The source map still maps a stack trace to real
         * names. `output` is spread after Vite's own choice, so this wins.
         */
        minify: true,
      },
    },
  },
});
