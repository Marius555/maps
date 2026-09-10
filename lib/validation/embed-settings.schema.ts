import { z } from "zod";

import type { SnapshotColors } from "@/packages/shared/snapshot";
import { hexColorSchema } from "./common";

/**
 * What the visitor's map looks like, and which of its controls exist.
 *
 * This started as four booleans that gated real behaviour in the published embed
 * but had no way in — `settings` was written once as `{}` at map creation and
 * never again. It is now the whole of the map designer: the results panel's
 * side, shape and transparency, what a results row draws, which of MapLibre's
 * own controls are on the map and in which corner, and the embed's own colour
 * tokens.
 *
 * The defaults and the reader live here rather than beside the snapshot
 * generator because the designer needs exactly the same two, and a second copy
 * of "what does absent mean" is how the panel and the published map start
 * disagreeing.
 *
 * **Absent is not the same question in both directions**, and that asymmetry is
 * CLAUDE.md §7 written as code:
 *
 * - This file resolves a *stored* map's settings, so a field the owner has never
 *   touched reads as the table below — the current design.
 * - The **embed** resolves a *published snapshot's*, where a missing field means
 *   the file predates it, so absent has to mean what the embed did before that
 *   field existed (`packages/shared/snapshot.ts`).
 *
 * The two answers differ on purpose. Changing a default here changes what the
 * next publish writes; it can never change what a live customer site is already
 * rendering, because that file was written whole and is read as it was written.
 */

/**
 * The closed sets, declared once.
 *
 * Exported because the designer's own choice controls render from these — a
 * second list of corners in a component is how a control ends up offering an
 * option the schema rejects as a 400.
 */
export const PANEL_SIDES = ["left", "right"] as const;
export const CONTROL_CORNERS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

/** 0–100, whole numbers. The panel's width and opacity are both percentages. */
const percentSchema = z.number().int().min(0).max(100);

/**
 * The accent a map wears until its owner picks another one.
 *
 * This is the app's own `--accent` (`app/globals.css`, oklch(64.37% 0.2195
 * 36.18)) resolved to sRGB, and it lives here rather than in the embed's
 * stylesheet on purpose. `--lm-focus` stays `#1c7ed6`, because that is what
 * every snapshot already sitting on a customer's site was published against and
 * §7 says a missing token has to keep meaning what it meant. Seeding the
 * *default settings* instead changes only what the next publish writes: a map
 * republished from here on carries the accent explicitly and renders orange, and
 * one that is never republished keeps rendering exactly what it renders today.
 *
 * A single value rather than the stylesheet's light/dark pair
 * (`#1c7ed6`/`#4dabf7`), because a stored colour cannot follow
 * `.lm-root--dark` — the trade `ColorsGroup` already documents for the other
 * four tokens. Orange carries on both grounds, which is what makes the accent
 * the one token worth spending that trade on.
 */
export const DEFAULT_EMBED_ACCENT = "#f54600";

export const embedColorsSchema = z.object({
  surface: hexColorSchema.optional(),
  foreground: hexColorSchema.optional(),
  muted: hexColorSchema.optional(),
  border: hexColorSchema.optional(),
  accent: hexColorSchema.optional(),
});

export const embedSettingsSchema = z.object({
  clustering: z.boolean(),
  search: z.boolean(),
  nearest: z.boolean(),
  list: z.boolean(),

  panelSide: z.enum(PANEL_SIDES),
  panelFloat: z.boolean(),
  /** Floored well above the stylesheet's `min-width`, capped so the map lives. */
  panelWidth: z.number().int().min(20).max(60),
  panelOpacity: percentSchema,
  panelBlur: z.number().int().min(0).max(24),
  panelRadius: z.number().int().min(0).max(24),
  /**
   * Whether the results list draws its own scrollbar.
   *
   * `true` is the bar every published panel has drawn, so this is spelled as the
   * shown state and not as `panelHideScrollbar` — absent has to mean the older
   * behaviour on the way out (`packages/shared/snapshot.ts`), and a flag whose
   * absence means "hidden" would rewrite every live map.
   */
  panelScrollbar: z.boolean(),
  /**
   * Whether a narrow map opens its list in a drawer instead of stacking it.
   *
   * Only ever read below the embed's own 768px drawer query — above it the
   * panel is the panel and this changes nothing. That is a wider width than the
   * 640px the stacked layout answers at, deliberately: stacking is what live
   * snapshots draw and its breakpoint cannot move, while a drawer is opt-in and
   * free to cover a portrait tablet too. Spelled as the drawer being on rather
   * than as `panelStack`, because absent has to keep meaning the stacked layout
   * every published map draws today (`packages/shared/snapshot.ts`).
   */
  panelDrawer: z.boolean(),

  rowPin: z.boolean(),
  rowPinSize: z.number().int().min(16).max(48),
  rowAddress: z.boolean(),
  rowDistance: z.boolean(),
  rowActions: z.boolean(),

  controlsCorner: z.enum(CONTROL_CORNERS),
  compass: z.boolean(),
  geolocate: z.boolean(),
  fullscreen: z.boolean(),
  scale: z.boolean(),
  scrollZoom: z.boolean(),

  /*
   * Whether this map reports what its visitors do.
   *
   * Required in the resolved shape like every other flag, and `false` in the
   * defaults below — the one setting whose default must never flip, because
   * turning it on starts collecting personal data belonging to somebody else's
   * visitors. It reaches a customer's site only when its owner switches it on
   * and republishes.
   */
  analytics: z.boolean(),

  /*
   * The one that stays optional in the resolved shape too, because absent is a
   * real answer here rather than a missing one: no colour override means the
   * stylesheet's own token, which is what follows `.lm-root--dark`.
   *
   * There were two text fields beside it — the search placeholder and the
   * find-nearest label — and they are gone rather than hidden. Wording is not
   * what anybody opens this panel to change, and the pair cost two full-width
   * text boxes in a column where every other control is one line.
   */
  colors: embedColorsSchema.optional(),

  /*
   * What a location with no tag and no pin of its own is drawn in.
   *
   * Required in the resolved shape, unlike `colors` — absent in a *snapshot*
   * means the flat grey the embed has always drawn, but a stored map always has
   * an answer, and the answer is a colour rather than "the stylesheet decides"
   * because a pin is a canvas raster with no stylesheet to ask.
   *
   * It sits beside `colors` rather than in it for a mechanical reason, not a
   * taxonomic one: every key in `colors` is a CSS custom property the preview
   * repaints live (`CHROME_SETTING_KEYS`), and a pin colour cannot be delivered
   * that way — the images are rasterised once and cached per
   * `pinImageId(icon, color)`, so only a rebuild recolours them.
   */
  pinColor: hexColorSchema,
});

export type EmbedSettings = z.output<typeof embedSettingsSchema>;

export const DEFAULT_EMBED_SETTINGS: EmbedSettings = {
  clustering: true,
  search: true,
  nearest: true,
  // On by default: a store locator without a results list is the thing the list
  // was added to fix, and a new map should be one out of the box. This changes
  // nothing for a map already published — its live snapshot keeps the shape it
  // was written with, and only a republish opts it in.
  list: true,

  // A see-through panel over the right of the map is the design. The embed still
  // reads absent as the docked left column it always drew, so this reaches a
  // customer's site only when its owner publishes.
  //
  // The width and the transparency are the Slim and Glass stops of the two
  // scales `PanelGroup` offers — the narrowest column a result row still reads
  // in, and the most of the map you can see through it. The subject of this
  // widget is the map, and the two settings that decide how much of it survives
  // the panel now start at the answer that leaves the most.
  panelSide: "right",
  panelFloat: true,
  panelWidth: 25,
  panelOpacity: 60,
  panelBlur: 10,
  panelRadius: 12,
  // The native bar stays on by default: it is the only thing telling a visitor
  // there are more locations below the fold, and a list is not a card whose
  // every pixel its owner chose. Turning it off is a decision, not a tidy-up.
  panelScrollbar: true,
  // On, so a narrow map is a map. Stacked, the list takes 40% of a box that is
  // already small and the thing the widget is for gets the rest; a drawer gives
  // the map all of it and puts the list one press away, beside the search box a
  // visitor is already looking at. Absent stays the stacked layout, so this
  // reaches a live site only on its owner's next publish.
  panelDrawer: true,

  rowPin: true,
  rowPinSize: 28,
  rowAddress: true,
  rowDistance: true,
  rowActions: true,

  // Left, so the controls are not underneath a right-hand panel.
  controlsCorner: "top-left",
  compass: false,
  geolocate: true,
  fullscreen: false,
  scale: false,
  // Held back deliberately: a map on someone's landing page must not swallow
  // the page scroll.
  scrollZoom: false,

  // Off, and this is the one default in this table that is not a design
  // opinion. Every other field here describes what a map looks like; this one
  // decides whether we start recording strangers. An owner asks for that
  // explicitly or it does not happen.
  analytics: false,

  // The one colour with a default. The other four stay absent so an undesigned
  // embed follows its basemap from light to dark on its own — see `readColors`.
  colors: { accent: DEFAULT_EMBED_ACCENT },

  // The same orange, and that is the point: the editor draws an untagged pin in
  // `var(--accent)` and a published map had no way to know what that was, so it
  // drew the flat grey instead and the Publish tab showed a different map from
  // the one next door. Publishing the colour is what closes that.
  pinColor: DEFAULT_EMBED_ACCENT,
};

/**
 * A stored map's settings, fully resolved.
 *
 * `settings` is a free-form JSON column that may have been written by an older
 * build or edited in the console, so every field falls back to its default
 * rather than trusting the stored shape. One resolved object feeds both the
 * designer's controls and `buildSnapshot`, which is what stops the panel and the
 * published map disagreeing about an unset field.
 *
 * The colours are parsed rather than read, because unlike everything else here
 * they end up as text in a stylesheet on a stranger's page — a bad value has to
 * be dropped, not passed through.
 */
export function readEmbedSettings(
  settings: Record<string, unknown>,
): EmbedSettings {
  const d = DEFAULT_EMBED_SETTINGS;

  return {
    clustering: readFlag(settings.clustering, d.clustering),
    search: readFlag(settings.search, d.search),
    nearest: readFlag(settings.nearest, d.nearest),
    list: readFlag(settings.list, d.list),

    panelSide: readChoice(settings.panelSide, PANEL_SIDES, d.panelSide),
    panelFloat: readFlag(settings.panelFloat, d.panelFloat),
    panelWidth: readNumber(settings.panelWidth, 20, 60, d.panelWidth),
    panelOpacity: readNumber(settings.panelOpacity, 0, 100, d.panelOpacity),
    panelBlur: readNumber(settings.panelBlur, 0, 24, d.panelBlur),
    panelRadius: readNumber(settings.panelRadius, 0, 24, d.panelRadius),
    panelScrollbar: readFlag(settings.panelScrollbar, d.panelScrollbar),
    panelDrawer: readFlag(settings.panelDrawer, d.panelDrawer),

    rowPin: readFlag(settings.rowPin, d.rowPin),
    rowPinSize: readNumber(settings.rowPinSize, 16, 48, d.rowPinSize),
    rowAddress: readFlag(settings.rowAddress, d.rowAddress),
    rowDistance: readFlag(settings.rowDistance, d.rowDistance),
    rowActions: readFlag(settings.rowActions, d.rowActions),

    controlsCorner: readChoice(
      settings.controlsCorner,
      CONTROL_CORNERS,
      d.controlsCorner,
    ),
    compass: readFlag(settings.compass, d.compass),
    geolocate: readFlag(settings.geolocate, d.geolocate),
    fullscreen: readFlag(settings.fullscreen, d.fullscreen),
    scale: readFlag(settings.scale, d.scale),
    scrollZoom: readFlag(settings.scrollZoom, d.scrollZoom),
    analytics: readFlag(settings.analytics, d.analytics),

    colors: readColors(settings.colors),
    pinColor: readHex(settings.pinColor, d.pinColor),
  };
}

function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return Math.min(max, Math.max(min, Math.round(value)));
}

function readChoice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * One `#rrggbb`, or the default.
 *
 * The single-value twin of `readColors` below, and it exists for the one colour
 * that is never absent. `hexColorSchema` rather than a regex here, so a stored
 * value is held to exactly what the designer is allowed to write — this column
 * is free-form JSON that an older build or a console edit may have put anything
 * in.
 */
function readHex(value: unknown, fallback: string): string {
  const parsed = hexColorSchema.safeParse(value);

  return parsed.success ? parsed.data : fallback;
}

/**
 * Only the colours that parse, laid over the one colour that has a default.
 *
 * The accent is seeded from `DEFAULT_EMBED_ACCENT` so a map nobody has coloured
 * still publishes the product's own orange instead of the embed stylesheet's
 * blue. The other four stay absent, because absent is what lets
 * `.lm-root--dark` redefine them and a stored `#ffffff` could not follow a
 * basemap into the dark.
 *
 * So this is the one key that is always written, and that is the intended price
 * of the default: a value in every *new* snapshot, in exchange for changing the
 * colour without touching what the embed reads a missing token as — which would
 * repaint maps that are already live (§7).
 *
 * A stored colour equal to the default is indistinguishable from an unset one,
 * deliberately: clearing the accent in the designer deletes the key and lands
 * back here, which is what "clear" should mean once the default is a colour
 * somebody chose rather than a library's blue.
 */
function readColors(value: unknown): SnapshotColors | undefined {
  const colors: SnapshotColors = { ...DEFAULT_EMBED_SETTINGS.colors };

  if (value && typeof value === "object") {
    const parsed = embedColorsSchema.safeParse(value);

    if (parsed.success) {
      for (const [key, hex] of Object.entries(parsed.data)) {
        if (hex) colors[key as keyof SnapshotColors] = hex;
      }
    }
  }

  return Object.keys(colors).length > 0 ? colors : undefined;
}
