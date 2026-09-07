/**
 * Which light/dark the card is drawn in — the *map's* answer, not the app's.
 *
 * **The bug this exists for.** A card's ground is a colour its owner picked
 * (`CardLayout.background`, a stored `#ffffff` at 60% on the default design)
 * while every word on it is drawn from the app's theme tokens — `--foreground`,
 * `--muted`, `--default` for a chip. On the dashboard those tokens follow the
 * *dashboard's* theme, and in the embed they follow the map's own
 * (`resolveTheme` in embed/src/index.ts). With the dashboard in dark mode and a
 * light basemap the two disagree completely, and it is not subtle: measured on
 * one design, `/card` drew the address `lab(62.88)` and the tag chip
 * `oklab(0.27 / 0.5)` with near-white text, where `/publish` drew
 * `rgb(101,107,118)` and `oklab(0.23 / 0.08)` with near-black. The studio is
 * meant to be a preview of a customer's site, and it was previewing something
 * nobody would ever see.
 *
 * So the card is its own colour context. `app/globals.css` already declares both
 * token sets under class selectors — `:root, .light, [data-theme="light"]` and
 * `.dark, [data-theme="dark"]` — so putting the right class on the card's own
 * wrapper re-declares every token for that subtree and nothing else has to
 * change. No new tokens, no component edits, and the card's own chrome (the
 * pencil, the close X, `.card-slot`'s dashed boxes) flips with it, which is
 * correct: those sit *on* the card.
 *
 * This deliberately mirrors `basemapFields` in lib/snapshot/build.ts and
 * `resolveTheme` in embed/src/index.ts rather than sharing code with either.
 * `basemapFields` is a snapshot writer and answers `autoDark: true` with no
 * theme at all, because Auto's answer belongs to a visitor's browser and not to
 * a publish; `resolveTheme` is the embed's, and /lib is closed to the embed
 * (CLAUDE.md §4). What is shared is the *rule*, and it is one line long: Auto
 * asks the browser, everything else asks the basemap.
 */

import {
  isAutoMapStyle,
  isDarkMapStyle,
  resolveMapStyle,
  type MapStyleKey,
} from "@/lib/map/style";

/**
 * `"light"` or `"dark"`, to be put on the element wrapping a card.
 *
 * For an Auto map this reads the *browser's* colour scheme and not the
 * dashboard's chosen theme, and that difference is the whole point: an owner
 * working in dark mode on a map pinned to a light basemap must still see the
 * light card their visitors get. Auto is the one style where a visitor's own
 * preference decides, so it is the one style where the dashboard's window is a
 * fair stand-in for one.
 *
 * Guarded on `matchMedia`, which a server render does not have — this runs
 * during the first client render of components that are already `"use client"`,
 * and light is the answer every card had before this existed.
 */
export function cardThemeClass(style: MapStyleKey): "light" | "dark" {
  if (isAutoMapStyle(style)) {
    return typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return isDarkMapStyle(resolveMapStyle(style)) ? "dark" : "light";
}
