/**
 * The maps list's shape: one full-width row per map, the theme's picture on the
 * left half and what the map is on the right, split by a 45° diagonal.
 *
 * **The angle is exact because of one variable.** The row is `--row-h` tall and
 * the picture's cut runs `--row-h` sideways, so rise equals run. The picture is
 * `50% + --row-h/2` wide, which puts the cut's midpoint on the row's centre line:
 * each half owns half. The info pane starts at 50% and is padded a further
 * `--row-h/2`, so no text ever sits under the slanted part of the picture.
 *
 * Physical `left`/`ml` rather than logical `start`/`ms`, deliberately: a
 * clip-path polygon does not mirror in a right-to-left layout, so the box it cuts
 * must not either.
 *
 * Below `sm` the row stacks — a 45° cut across a phone-wide row would eat half
 * of it — and every rule that draws the diagonal is `sm:`-prefixed.
 *
 * Its own module because the page and its loading skeleton both lay out on it,
 * and the skeleton is a server component: a constant exported from the
 * `"use client"` card would reach it as a client reference, not as a string.
 */
export const MAP_LIST_CLASS = "flex flex-col gap-4";

export const MAP_ROW_CLASS =
  "relative gap-0 overflow-hidden p-0 [--row-h:11rem] sm:h-[var(--row-h)]";

export const MAP_PANE_CLASS =
  "relative h-32 w-full shrink-0 overflow-hidden bg-surface-secondary " +
  "sm:absolute sm:inset-y-0 sm:left-0 sm:h-auto sm:w-[calc(50%_+_var(--row-h)/2)] " +
  "sm:[clip-path:polygon(0_0,100%_0,calc(100%_-_var(--row-h))_100%,0_100%)]";

export const MAP_INFO_CLASS =
  "flex flex-1 flex-col gap-3 p-4 " +
  "sm:ml-[50%] sm:h-full sm:py-5 sm:pr-5 sm:pl-[calc(var(--row-h)/2_+_1rem)]";
