import type { SnapshotSettings } from "./snapshot";

/**
 * Everything the owner designed about the embed's chrome, as CSS custom
 * properties.
 *
 * One table, in `/packages/shared`, because **two renderers write it**. The
 * embed writes it onto its own root at boot (`applyChrome` in
 * embed/src/index.ts), and the dashboard's publish preview writes it into the
 * running preview frame on every pointer move of a colour drag — without
 * rebuilding the document, which is the whole reason that page stopped blinking
 * (lib/preview/live-chrome.ts).
 *
 * A second copy of this table in the dashboard would be a preview that recolours
 * one set of tokens and a publish that writes another, and the drift would show
 * up as "the preview lied" months later. Same argument `shapes.ts` and
 * `darken-style.ts` already make, and it costs the embed nothing: the code moved
 * here rather than being duplicated.
 *
 * **`undefined` is a real answer and is never written.** An absent property
 * leaves the stylesheet's own value in charge, which is what keeps an undesigned
 * embed theme-aware — `.lm-root--dark` redefines exactly these tokens, and a
 * stored `#ffffff` could not follow it. That is also the CLAUDE.md §7 half: a
 * snapshot published before any of these fields existed produces an empty table
 * and renders precisely what it always rendered.
 */
export function chromeVars(
  settings: SnapshotSettings,
): Record<string, string | undefined> {
  const c = settings.colors;

  return {
    "--lm-panel-w":
      settings.panelWidth === undefined ? undefined : `${settings.panelWidth}%`,
    "--lm-panel-opacity":
      settings.panelOpacity === undefined
        ? undefined
        : `${settings.panelOpacity}%`,
    // Zero is not "a blur of none" but "no backdrop-filter at all": the property
    // is expensive enough on a scrolling panel that a `blur(0)` nobody asked for
    // is worth not writing.
    "--lm-panel-blur": settings.panelBlur ? `${settings.panelBlur}px` : undefined,
    "--lm-panel-radius":
      settings.panelRadius === undefined
        ? undefined
        : `${settings.panelRadius}px`,
    "--lm-row-pin":
      settings.rowPinSize === undefined ? undefined : `${settings.rowPinSize}px`,
    /*
     * The corner on a results row's Directions and phone links.
     *
     * A property rather than a fifth `data-lm-link` value, because a corner is a
     * *length* every one of those treatments reads — the stylesheet's default is
     * the 999px pill every published row already draws, so absent is that pill
     * and nothing here writes one.
     */
    "--lm-link-radius":
      settings.rowLinkRadius === undefined
        ? undefined
        : `${settings.rowLinkRadius}px`,
    "--lm-surface": c?.surface,
    "--lm-foreground": c?.foreground,
    "--lm-muted": c?.muted,
    "--lm-border": c?.border,
    "--lm-focus": c?.accent,
  };
}

/**
 * The rest of the chrome, as data attributes on the same root.
 *
 * Where a colour or a width is a *value* CSS can interpolate, these two are
 * *state* the layout branches on — which edge the panel sits against, and whether
 * it floats over the map or sits beside it. They used to be neither: the side was
 * real DOM source order (`layout.append(canvas, panel)`) and the placement was a
 * class, both decided once at boot and unreachable afterwards. So flipping either
 * one cost the publish preview a whole new document — a new MapLibre, a new WebGL
 * context and a fresh tile fetch for a change that moves one box.
 *
 * As attributes they are the same kind of thing `chromeVars` writes: one table,
 * two renderers, applied to a map that is already running. The stylesheet does
 * the layout from them (`order` for the docked case, a `translateX` for the
 * floating one), which is also what makes the move animatable — you cannot
 * transition source order.
 *
 * **`undefined` is never written, and absent is the older behaviour**, exactly as
 * above. No `data-lm-side` is the left column and no `data-lm-float` is the
 * docked panel, which is what every snapshot published before these fields
 * existed already renders (§7).
 */
export function chromeAttrs(
  settings: SnapshotSettings,
): Record<string, string | undefined> {
  return {
    "data-lm-side": settings.panelSide === "right" ? "right" : undefined,
    "data-lm-float": settings.panelFloat ? "1" : undefined,
    /*
     * An attribute rather than a custom property, and for once that is forced
     * rather than merely consistent: hiding a bar takes `scrollbar-width` *and*
     * a `::-webkit-scrollbar` rule, and a pseudo-element cannot be switched on
     * by a variable. So the stylesheet branches, exactly as it does for the side
     * and the placement.
     *
     * Only `false` writes anything. Absent is the bar, which is what every
     * snapshot published before this field existed already draws (§7).
     */
    "data-lm-bar": settings.panelScrollbar === false ? "0" : undefined,
    /*
     * The floating toolbar's glass, and an attribute for `data-lm-bar`'s reason
     * rather than for its own: what it switches on is a *set* of custom
     * properties on the toolbar — the panel's opacity, blur and corner, read
     * through one indirection so that every existing override of a control's
     * background still wins on its own terms. A variable cannot turn a block of
     * variables on.
     *
     * Only `true` writes anything. Absent is the solid control every published
     * map draws (§7).
     */
    "data-lm-glass": settings.toolbarGlass ? "1" : undefined,
    /*
     * How a results row's two links are painted, and only when it is not the
     * outlined pill they have always been — so an owner who has not touched the
     * control writes no attribute and the stylesheet's own rule stands.
     */
    "data-lm-link":
      settings.rowLinkStyle && settings.rowLinkStyle !== "outline"
        ? settings.rowLinkStyle
        : undefined,
  };
}

/**
 * The keys `chromeVars` and `chromeAttrs` answer, so a caller can tell a live
 * repaint from a rebuild without listing them again.
 *
 * The publish preview reads this to strip the live fields out of the key it
 * rebuilds its iframe on: changing one of these is a property or attribute write
 * on a running map, and only the rest are worth tearing a document down for.
 */
export const CHROME_SETTING_KEYS = [
  "panelSide",
  "panelFloat",
  "panelWidth",
  "panelOpacity",
  "panelBlur",
  "panelRadius",
  "panelScrollbar",
  "toolbarGlass",
  "rowPinSize",
  "rowLinkStyle",
  "rowLinkRadius",
  "colors",
] as const satisfies readonly (keyof SnapshotSettings)[];
