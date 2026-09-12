import { resolve } from "node:path";
import { defineConfig } from "vite";

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
  /**
   * The manual test harness (embed/dev/) is copied into the build output, so it
   * sits next to map.js at /embed/dev.html and can exercise the real bundle
   * against a fixture snapshot — no Appwrite, no login, no publish.
   *
   * It lands in public/embed/, which is gitignored build output, so the harness
   * is committed as source but never deployed.
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
      entry: resolve(import.meta.dirname, "src", "index.ts"),
      formats: ["es"],
      fileName: () => "map.js",
    },
    rollupOptions: {
      // pmtiles stays bundled — it is small, and it has no worker of its own to
      // share a chunk with.
      external: ["maplibre-gl"],
      output: {
        // Rewrites the bare specifier to a sibling file, resolved relative to
        // map.js on our origin. scripts/copy-maplibre-worker.mjs puts it there.
        paths: { "maplibre-gl": "./maplibre-gl.mjs" },
      },
    },
  },
});
