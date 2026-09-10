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
 * **Auto is the one style that has to ask somebody, and asking the wrong
 * somebody is the second bug this file has had.** This used to read
 * `window.matchMedia("(prefers-color-scheme: dark)")` directly, which is the
 * *operating system's* preference — and the dashboard's theme is not that. HeroUI
 * resolves localStorage first (`components/providers/theme-script.tsx`), so an
 * owner whose OS is dark and who picked **Light** in the account menu got
 * `<html class="light">`, a light basemap, and a card wearing `.dark` on top of
 * it: `bg-surface` at `oklch(19% 0 0)`, a near-black card and a near-black dashed
 * border on the gallery, in light mode. Worse, being a `typeof window` branch
 * read *during render*, it made the server emit `light` and the client `dark` on
 * the same element — the hydration mismatch React reported against
 * `card-frame.tsx`.
 *
 * The answer therefore arrives as an argument, from `usePrefersDark()`, which
 * reads the `.dark` class off `<html>` through `useSyncExternalStore`. That is
 * the same source the basemap itself uses (`components/map/use-maplibre.ts`), so
 * the card and the map under it can no longer disagree; it honours an explicit
 * Light or Dark choice as well as "system"; it re-renders when the theme is
 * toggled, which `matchMedia`-at-render never did; and it has a server snapshot,
 * so there is nothing left to mismatch.
 *
 * This deliberately mirrors `basemapFields` in lib/snapshot/build.ts and
 * `resolveTheme` in embed/src/index.ts rather than sharing code with either.
 * `basemapFields` is a snapshot writer and answers `autoDark: true` with no
 * theme at all, because Auto's answer belongs to a visitor's browser and not to
 * a publish; `resolveTheme` is the embed's, and /lib is closed to the embed
 * (CLAUDE.md §4). What is shared is the *rule*, and it is one line long: Auto
 * asks the viewer, everything else asks the basemap.
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
 * `prefersDark` is only consulted for Auto, and the caller reads it from
 * `usePrefersDark()`. Everything else is what its owner pinned and looks the
 * same for every viewer — an owner working in light mode on a map pinned to the
 * Dark basemap must still see the dark card their visitors get, which is the
 * whole difference between a pinned style and Auto.
 *
 * The same two arguments in the same order as `shouldDarkenStyle`
 * (lib/map/style.ts), which answers the neighbouring question about the basemap
 * itself, on purpose.
 */
export function cardThemeClass(
  style: MapStyleKey,
  prefersDark: boolean,
): "light" | "dark" {
  if (isAutoMapStyle(style)) return prefersDark ? "dark" : "light";

  return isDarkMapStyle(resolveMapStyle(style)) ? "dark" : "light";
}
