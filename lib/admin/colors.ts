/**
 * The operator console's colours — one hue per *thing*, and it follows the
 * thing onto every chart it appears in: Geoapify is blue on the stacked bars,
 * the donut and its KPI card alike.
 *
 * **No new hues.** Every value is one of the Analytics tab's `--an-*` tokens
 * (`app/globals.css`), used only in the orders that palette was validated in:
 *
 * - three-way splits take the slice order (blue, accent, aqua), validated
 *   all-pairs in both modes;
 * - four-way splits take the engagement-stack order (aqua, yellow, violet,
 *   magenta), validated adjacent in both modes;
 * - ok/failed take green/red, the pair the outcomes ring validated with
 *   secondary encoding — the legend names both and every slice has a gap.
 *
 * A plain module, not `"use client"`: the loaders and the server-rendered cards
 * read these, and a constant read through a client reference is not the
 * constant (CLAUDE.md §0).
 */

const BLUE = "var(--an-visitors)";
const ACCENT = "var(--an-visits)";
const AQUA = "var(--an-opens)";
const YELLOW = "var(--an-searches)";
const VIOLET = "var(--an-directions)";
const MAGENTA = "var(--an-calls)";
const GREEN = "var(--an-site)";
const RED = "var(--an-email)";
export const GREY = "var(--an-other)";

/** The headline figures, each its own colour on every page. */
export const KPI_COLOR = {
  signups: BLUE,
  sessions: ACCENT,
  apiCalls: AQUA,
  emails: VIOLET,
  maps: YELLOW,
  lookups: MAGENTA,
} as const;

export const PROVIDER_COLOR: Record<string, string> = {
  geoapify: BLUE,
  photon: ACCENT,
  osrm: AQUA,
};

export const TEMPLATE_COLOR: Record<string, string> = {
  verify: AQUA,
  welcome: YELLOW,
  reset: VIOLET,
  support: MAGENTA,
};

export const PLAN_COLOR: Record<string, string> = {
  free: GREY,
  starter: BLUE,
  pro: ACCENT,
};

export const CADENCE_COLOR: Record<string, string> = {
  monthly: BLUE,
  yearly: ACCENT,
};

export const OUTCOME_COLOR = { ok: GREEN, failed: RED } as const;

/** The slice order for anything else split three ways, then "Other". */
export const SPLIT_COLORS = [BLUE, ACCENT, AQUA, GREY] as const;
