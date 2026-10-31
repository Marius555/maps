"use client";

import { DEFAULT_MAP_STYLE, resolveStyleUrl } from "@/lib/map/style";
import { preloadMapStyle } from "@/packages/shared/load-style";

/**
 * Starts downloading what the editor's first map needs while the owner is still
 * typing its name in the Create map dialog.
 *
 * A brand-new map is always the same map — the default style, framed on the
 * whole world — so everything it waits for after the redirect is known before
 * the redirect: MapLibre's chunk (the same `import()` `map-canvas.tsx` lazy-loads,
 * so the bundler hands the editor the cached module), its worker script, and
 * the style document. Seconds of typing cover all three.
 *
 * Once per page load, fire-and-forget, every failure swallowed: the editor
 * loads each of these itself anyway, so a warm-up that fails costs nothing.
 * Dashboard only, and nothing here is metered (§2).
 */
let warmed = false;

export function warmFirstMap(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;

  void import("@/components/map/map-canvas-impl").catch(() => {});

  // Same URL lib/map/worker.ts hands MapLibre, so this fills the HTTP cache the
  // worker is then loaded from.
  void fetch("/maplibre/maplibre-gl-worker.mjs", { priority: "low" }).catch(() => {});

  preloadMapStyle(resolveStyleUrl(DEFAULT_MAP_STYLE));
}
