import { isAutoMapStyle, type MapStyleKey } from "@/lib/map/style";

/**
 * When a cached preview is still the right picture.
 *
 * Two halves, decided in two places. The server knows what is *on* the map — a
 * count and the newest edit per table — and composes `contentVersion` from them.
 * The browser knows who is *looking*, which matters for exactly one style: Auto
 * resolves against the dashboard's theme, so an Auto map has a light picture and
 * a dark one. `previewKey` joins the two.
 */

/**
 * Bump when the renderer changes what it draws — pin size, framing, the credit —
 * so every cached preview is redrawn once rather than kept forever.
 */
export const RENDER_VERSION = 1;

export type TableActivity = {
  /** Rows on this map. A delete changes it; nothing else has to. */
  count: number;
  /** The newest row's `$updatedAt`, or null for an empty table. */
  last: string | null;
};

export function contentVersion({
  mapUpdatedAt,
  places,
  shapes,
  groups,
}: {
  mapUpdatedAt: string;
  places: TableActivity;
  shapes: TableActivity;
  groups: TableActivity;
}): string {
  const part = (activity: TableActivity) => `${activity.count}@${activity.last ?? "-"}`;

  return [mapUpdatedAt, part(places), part(shapes), part(groups)].join("|");
}

export function previewKey({
  contentVersion,
  style,
  prefersDark,
}: {
  contentVersion: string;
  style: MapStyleKey;
  prefersDark: boolean;
}): string {
  // Only Auto changes with the dashboard's theme. Keying every other style on it
  // would redraw fifteen previews on a theme toggle for nothing.
  const theme = isAutoMapStyle(style) ? (prefersDark ? "dark" : "light") : "fixed";

  return `v${RENDER_VERSION}|${style}|${theme}|${contentVersion}`;
}

/** The newest of several ISO timestamps. Nulls are skipped. */
export function latestOf(first: string, ...rest: (string | null)[]): string {
  let latest = first;

  for (const candidate of rest) {
    if (candidate && Date.parse(candidate) > Date.parse(latest)) latest = candidate;
  }

  return latest;
}
