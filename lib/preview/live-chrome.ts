import { chromeAttrs, chromeVars } from "@/packages/shared/embed-chrome";
import type { SnapshotSettings } from "@/packages/shared/snapshot";

/**
 * Talking to a running embed instead of building a new one.
 *
 * The publish preview renders the real embed bundle in an iframe, and every
 * setting used to be a fresh `srcdoc`: a new document, a new MapLibre instance,
 * a new WebGL context, a new tile fetch, and the camera back at the map's saved
 * view. Dragging a colour did that thirty times a second, which is what
 * "everything starts lagging" was — browsers cap live WebGL contexts, so the
 * cost grew with the length of the session rather than staying flat.
 *
 * The frame is `srcdoc`, so it inherits this document's origin and its DOM is
 * simply reachable. Everything the embed expresses as a CSS custom property can
 * therefore be written straight onto the running map's root, with no rebuild at
 * all — which covers every control a pointer drags.
 *
 * **The table is `chromeVars`, shared with the embed itself**, so the preview
 * cannot recolour one set of tokens while publishing writes another. See
 * packages/shared/embed-chrome.ts.
 */

/**
 * What the embed hangs off its own root for a parent document to find.
 *
 * Declared structurally rather than imported from `/embed`: the dashboard must
 * not pull the embed's modules into its own bundle (CLAUDE.md §4), and the two
 * fields it actually needs are the whole contract.
 */
type EmbeddedMap = {
  getView: () => { lng: number; lat: number; zoom: number };
  resize: () => void;
  destroy: () => void;
};

function rootOf(doc: Document | null | undefined): HTMLElement | null {
  return doc?.querySelector<HTMLElement>(".lm-root") ?? null;
}

function mapOf(doc: Document | null | undefined): EmbeddedMap | null {
  const root = rootOf(doc) as (HTMLElement & { lmMap?: EmbeddedMap }) | null;

  return root?.lmMap ?? null;
}

/**
 * Repaint a mounted embed's chrome in place.
 *
 * Returns whether it found one — the caller uses that to know a frame is still
 * loading and the properties will arrive with the document instead.
 *
 * A property that has become undefined is *removed* rather than skipped:
 * clearing a colour has to hand the token back to the stylesheet, and leaving
 * the last value written would make the clear button do nothing.
 */
export function applyLiveChrome(
  doc: Document | null | undefined,
  settings: SnapshotSettings,
): boolean {
  const root = rootOf(doc);
  if (!root) return false;

  for (const [name, value] of Object.entries(chromeVars(settings))) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }

  /*
   * The layout's own state — which edge the panel sits against, and whether it
   * floats. Same table-shared-with-the-embed argument as the properties above,
   * and the same rule about absence: an attribute that has become undefined is
   * *removed*, because absent is what says "left" and "docked".
   *
   * These two used to cost a whole new document. The side was real DOM order and
   * the placement a class applied once at boot, so the preview could only answer
   * a press by rebuilding — new MapLibre, new WebGL context, new tiles. As
   * attributes the stylesheet does the work, and the map never notices.
   */
  for (const [name, value] of Object.entries(chromeAttrs(settings))) {
    if (value) root.setAttribute(name, value);
    else root.removeAttribute(name);
  }

  return true;
}

/**
 * Whether the embed in this frame has drawn anything yet.
 *
 * `mount()` in the embed is async — a snapshot fetch and a style fetch after the
 * module is evaluated — so an iframe's own `load` event fires while the document
 * is still empty. Swapping a frame to the front on that signal is what made the
 * preview blink: it revealed a blank page and the map arrived afterwards. The
 * embed sets this attribute on its own root from MapLibre's `load`, which is the
 * first moment there is a map to look at.
 */
export function isFrameReady(doc: Document | null | undefined): boolean {
  return rootOf(doc)?.hasAttribute("data-lm-ready") ?? false;
}

/**
 * Where the map in this frame is looking, or null if there isn't one yet.
 *
 * Read just before a rebuild so the replacement document can open on the same
 * view. Without it every structural press — a switch, a corner — snapped the
 * owner back to the map's saved default, which reads as the page fighting them.
 */
export function readFrameView(
  doc: Document | null | undefined,
): { lng: number; lat: number; zoom: number } | null {
  try {
    return mapOf(doc)?.getView() ?? null;
  } catch {
    // A frame mid-navigation can have a root without a live map behind it. A
    // missing camera is a preview that opens where it always did, not an error.
    return null;
  }
}

/**
 * Remeasure and repaint the map in this frame.
 *
 * Called the instant a frame is swapped to the front. A browser gives no
 * animation frames to a document it is not rendering, so a map that finished
 * loading behind another one can be holding a partly-drawn canvas — and MapLibre
 * paints on demand rather than in a loop, so nothing would ever correct it.
 * Cheap, idempotent, and the difference between a map and a smear.
 */
export function repaintFrame(doc: Document | null | undefined): void {
  try {
    mapOf(doc)?.resize();
  } catch {
    // Nothing mounted yet: the document's own load will paint it.
  }
}

/**
 * Free the GPU context behind a frame that is no longer on screen.
 *
 * The preview keeps two documents so a rebuild can be swapped in rather than
 * flashed in, and two live WebGL contexts is a bounded cost where the old churn
 * was not — but the one that has just been hidden has no reason to keep one.
 */
export function releaseFrame(doc: Document | null | undefined): void {
  try {
    mapOf(doc)?.destroy();
  } catch {
    // Already gone, or never built. Either way there is nothing to release.
  }
}
