/**
 * How nearby locations gather into one numbered bubble, and what that bubble
 * looks like.
 *
 * Here rather than in either renderer because both draw it: the embed clusters
 * its GeoJSON source (embed/src/map.ts) and the editor clusters a source of its
 * own beside its DOM markers (components/map/clusters/). The Publish tab puts the
 * real embed bundle next to the editor's canvas, so two sets of numbers that agree
 * today would be two different-looking maps the day one of them moves.
 *
 * Zero dependencies, vanilla TS — the condition for runtime in this directory
 * (CLAUDE.md §4).
 */

/** Past this zoom, show individual pins rather than bubbles. */
export const CLUSTER_MAX_ZOOM = 14;
export const CLUSTER_RADIUS = 50;

/** Neutral, so a bubble never looks like it belongs to one tag. */
export const CLUSTER_COLOR = "#3f4756";

/** A bubble grows in two steps, at 25 and at 100 locations. */
export const CLUSTER_BUBBLE_RADIUS: [
  "step",
  ["get", string],
  number,
  number,
  number,
  number,
  number,
] = ["step", ["get", "point_count"], 16, 25, 21, 100, 27];

/**
 * The count's font. It has to exist in the style's glyph set; Noto Sans is the
 * one every OpenFreeMap style ships, and our own style documents mirror it.
 */
export const CLUSTER_FONT = "Noto Sans Regular";
