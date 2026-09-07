# Basemaps, themes and tiles — design notes

Moved out of CLAUDE.md on 2026-09-05 so that file stays cheap to load. Nothing here is
rewritten; it is the record of why this area is shaped as it is.

## Invariants

- Sixteen looks come from five OpenFreeMap style documents plus recolouring. A theme is
  about fifteen numbers in a `StyleTint` (`packages/shared/style-tint.ts`), so adding one
  costs no new origin, no CORS surface and no money.
- `darken-style.ts` is now `MIDNIGHT_TINT` plus a one-line `darkenStyle`.
  `packages/shared/darken-style.test.ts` must keep passing **unmodified** — that is the
  proof the refactor moved no pixel of Auto's dark half.
- A `Band`'s `exponent` applies to the *normalised* value after inversion. `hue` replaces
  the hue outright at an absolute `hueChroma`, never scaling the colour's own. Light
  themes must leave the figure band near identity or the street grid disappears.
- `lib/map/themes.test.ts` holds every theme to label/ground/figure contrast. Do not add
  a theme without it — nobody will open sixteen maps by hand after touching a number.
- Labels and layers are **visibility, not colour**, and match on `source-layer` plus what
  the filter names — **never on layer ids**, which differ across all five documents.
- Cycle paths are the exception: OpenMapTiles files a cycleway as `class: "path"` with
  `subclass: "cycleway"`, so the toggle *adds* a layer, before the tint runs.
- No traffic and no satellite. Both are metered third-party feeds in the visitor's path
  (§2). The UI says so rather than greying out a control.
- `map-appearance.ts` composes layers → labels → tint in that fixed order.
  `loadMapStyle(url, appearance)` is the single seam both build targets go through.
  **The embed may never `setStyle`; the editor may.**
- The style cache holds the **raw** fetched style, never the result — one URL feeds a
  dozen looks.
- A published snapshot carries the resolved tint, never the theme's name. `appearance` is
  omitted entirely when it would change nothing.
- Appearance controls PATCH on click, which is why `useUpdateMap` is optimistic.
- Tailwind's `sr-only` is `position: absolute`. A `<label>` wrapping a `peer sr-only`
  radio **needs `relative` on it**, or the page jumps to blank space and the next click
  lands on a different tile. Both `theme-gallery.tsx` and `labels-field.tsx`.
- `STYLE_URLS` derives from `NEXT_PUBLIC_TILES_URL`, and the attribution moves with it.
  Both pmtiles registrations must set `{ metadata: true }` or the OpenStreetMap credit
  silently disappears (§12).
- `lib/map/tile-style.test.ts` is the only thing holding the app's constants equal to
  `scripts/tile-style.mjs`. Each drift is silent in production.

## Notes

**Sixteen basemap looks out of five style documents.** OpenFreeMap publishes five
style URLs and no more, so the other eleven are recolourings. `packages/shared/style-tint.ts`
is `darken-style.ts` generalised: the same walk over every layer's `paint`, bucketing each
colour property into ground / figure / text and rewriting it in OKLab, but with the constants
lifted out into a `StyleTint`. `darken-style.ts` keeps its header and is now `MIDNIGHT_TINT`
plus a one-line `darkenStyle`; `packages/shared/darken-style.test.ts` passes **unmodified**,
which is the proof the refactor moved no pixel of Auto's dark half. A theme is therefore
about fifteen numbers, and adding a sixteenth costs no new origin, no CORS surface and no
money — which is the whole reason there can be sixteen rather than five (§2, §4).

Three things about a `Band` are worth knowing before you write a theme. `exponent` applies to
the *normalised* value after inversion, and it is what stops a band collapsing: Liberty's
fills all sit above L 0.80, so a dark theme needs an exponent below 1 to spread them apart
and a light theme needs one above 1 to spread the same sliver from the other end. `hue`
replaces the hue outright at an absolute `hueChroma` (`withHue` in color.ts) rather than
scaling the colour's own — a coral road cannot be reached by scaling a white one. And light
themes leave the figure band near identity, because a light basemap draws white roads on
near-white land and separates them with a *casing*: compress that range and the street grid
disappears. `lib/map/themes.test.ts` holds every theme to those claims — label clear of the
road it sits on, ground features told apart, labels on the opposite side of the scale from
the ground — because nobody is going to open sixteen maps by hand after touching a number.

**Labels and layers are visibility, not colour, and they match on schema rather than on ids.**
`style-labels.ts` is All / Fewer / None: `none` hides every symbol layer, `some` keeps only
the source-layers that orient you (`place`, `aerodrome_label`) and drops street names, water
names and POIs, and `all` returns the input **by reference** so the untouched path can still
hand MapLibre a plain URL. `style-layers.ts` toggles POIs, transit, buildings, 3D buildings
and paths by flipping `layout.visibility` on layers the style already has, matched on
`source-layer` plus what their filter names — never on layer ids, which are each style
author's private business and differ across all five documents. Cycle paths are the one
exception: OpenMapTiles files a cycleway as `class: "path"` with `subclass: "cycleway"`, so
there is no layer to reveal and the toggle *adds* one, before the tint runs so a theme
recolours it like any other line. That `subclass` is populated was verified against a real
planet tile before the switch was built; a switch that does nothing is worse than no switch.
No traffic and no satellite, and the UI says so rather than greying out a control: both are
metered third-party feeds in the visitor's path, which §2 forbids and §12 rules out at source.

`map-appearance.ts` composes the three in a fixed order — layers, then labels, then tint —
and `loadMapStyle(url, appearance)` is the single seam both build targets go through, because
it is the only moment before `createMap` that they share. The embed may never `setStyle`; the
editor may. Its cache now holds the **raw** fetched style rather than the result, since one
URL feeds a dozen looks and caching the output would serve the first map's theme to the
second.

**A published snapshot carries the resolved tint, never the theme's name.** A key is a promise
that the key will still exist and still mean the same thing years from now, and snapshots are
read forever by sites we do not control (§7); fifteen numbers promise nothing and cannot be
broken by renaming a theme. It also keeps the theme table out of the embed bundle — the embed
needs the transform, never the catalogue. `appearance` is omitted entirely when it would
change nothing, so a map whose owner never opened the menu publishes the bytes it always did.

**The appearance controls live on the canvas, and save on click.** `components/appearance/`
holds one panel that both the editor toolbar's Palette button and the Settings tab render, so
a new theme is added in one place. Its swatches are inline SVG mini-maps painted from each
style's own sampled colours run through that theme's own tint — the same function the map
runs, so a tile cannot promise a map that does not exist, and zero requests unlike the
competition's raster thumbnails. Every change PATCHes immediately, which is why `useUpdateMap`
became optimistic (`lib/query/maps.ts`): a theme is a thing you try, and a round trip of
latency on a swatch reads as a broken control rather than a slow one. It also forced splitting
`map-details-form.tsx` — a Save-button form and an instant control in one panel leaves the
button meaning "save some of this".

One gotcha cost real debugging and will again. The gallery's tiles are `<label>`s wrapping a
`peer sr-only` radio, and Tailwind's `sr-only` is `position: absolute` — so without `relative`
on the label the hidden input lays itself out against whatever is positioned further up, which
inside a portalled popover is somewhere else entirely. Clicking a tile focuses that input, the
browser scrolls it into view, and **the whole page jumps to blank space below the app** — then
the next click lands on a different tile than the one under the cursor, so the map quietly
changes to a theme nobody picked. `relative` on the row is the fix, in both `theme-gallery.tsx`
and `labels-field.tsx`.

**The tile host is one variable, and the credit follows it.** `STYLE_URLS` is derived
from `NEXT_PUBLIC_TILES_URL` rather than five literals; unset it is OpenFreeMap and
every URL is byte-identical to what it always was, which `lib/map/tile-style.test.ts`
spells out in full as the canary. The reason to do this before the tiles exist is a
trap: the embed deliberately does **not** pass `snapshot.attribution` to MapLibre
(`embed/src/map.ts`) because the tile source's own TileJSON renders the credit — and
`new Protocol()` without `{ metadata: true }` answers from the archive header alone,
with no `attribution` field at all. So the first map pointed at a pmtiles style would
have silently lost its OpenStreetMap credit, which §12 makes non-negotiable. Both
registrations now set the flag, and our own style documents also name the attribution
on the vector source, which wins over the TileJSON (`extend(tileJSON, options)` in
MapLibre's `loadTileJson`). Two guards, because a credit that disappears does so
quietly.

`scripts/tile-style.mjs` holds the transform and is imported by both the build script
and a vitest file — the thing the gazetteer could not manage, where `fold` has a
hand-kept twin in `scripts/build-gazetteer.mjs`. What it cannot share are constants
the app also owns (the basemap list, the URL shape, the two credits), so
`lib/map/tile-style.test.ts` is the only thing holding those equal; each drift is
silent in production. `scripts/mirror-tile-assets.mjs` copies the three asset classes
the styles pull besides tiles — fonts, sprites and the Natural Earth raster, which is
a **second source** in all five styles and easy to miss. Measured, not guessed: 768
glyph ranges (102MB), 4 sprite files, 5,461 raster tiles (312MB). The runbook for the
day it matters is `docs/self-hosting-tiles.md`.
