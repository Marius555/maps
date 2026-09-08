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
  panelSide: "right",
  panelFloat: true,
  panelWidth: 34,
  panelOpacity: 88,
  panelBlur: 10,
  panelRadius: 12,
  // The native bar stays on by default: it is the only thing telling a visitor
  // there are more locations below the fold, and a list is not a card whose
  // every pixel its owner chose. Turning it off is a decision, not a tidy-up.
  panelScrollbar: true,

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
 * Only the colours that parse, and nothing at all when none do.
 *
 * An empty object would be a key in every snapshot saying nothing, and the
 * embed reads a missing token and a missing `colors` identically.
 */
function readColors(value: unknown): SnapshotColors | undefined {
  if (!value || typeof value !== "object") return undefined;

  const parsed = embedColorsSchema.safeParse(value);
  if (!parsed.success) return undefined;

  const colors: SnapshotColors = {};

  for (const [key, hex] of Object.entries(parsed.data)) {
    if (hex) colors[key as keyof SnapshotColors] = hex;
  }

  return Object.keys(colors).length > 0 ? colors : undefined;
}
