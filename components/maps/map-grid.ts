/**
 * Cards fill the width at whatever the window is: as many 19rem-or-wider columns
 * as fit, then share out the rest. One column on a phone, four or five on a wide
 * monitor, and never a card stretched across a 2560px screen on its own — with
 * two maps, the empty tracks keep them at a sensible size.
 *
 * Its own module because the page and its loading skeleton both lay out on it,
 * and the skeleton is a server component: a constant exported from the
 * `"use client"` list would reach it as a client reference, not as a string.
 */
export const MAP_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-5";
