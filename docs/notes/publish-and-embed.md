# Publish designer and embed chrome — design notes

Moved out of CLAUDE.md on 2026-09-05 so that file stays cheap to load. Nothing here is
rewritten; it is the record of why this area is shaped as it is.

## Invariants

- **`maps.settings` is one JSON blob with exactly one writer** (`useEmbedDesign`).
  `updateMap` serialises it whole, so two forms writing it is a lost update.
  `readEmbedSettings` resolves one fully-populated object feeding both the controls and
  `buildSnapshot`, so the panel and the published map cannot disagree about an unset field.
- **Everything the designer writes is optional on `SnapshotSettings`, and absent means what
  the embed did before that field existed.** Hence the asymmetry: `DEFAULT_EMBED_SETTINGS`
  is what a map *publishes* (panel right, floating, pins in rows, controls top-left); the
  **embed** reads a missing key as the *old* behaviour (panel docked left, no pins, controls
  top-right). Changing a default changes the next publish and can never change what a live
  customer site already renders.
- **A boolean the stylesheet branches on is an attribute, not a variable.** `panelScrollbar`
  hides the results list's own bar, and hiding one takes `scrollbar-width` *and* a
  `::-webkit-scrollbar` rule — a pseudo-element cannot be switched on by a custom property.
  So it rides in `chromeAttrs` as `data-lm-bar="0"`, written **only** when it is off, beside
  the side and the placement; `CHROME_SETTING_KEYS` carries it, so toggling it repaints the
  running preview instead of rebuilding the frame. Verified: same iframe, 17 network
  resources before and after.
- The Publish page **hides the app nav** (`hidesAppNav` in `lib/layout/app-nav.ts`), so the
  sidebar takes that 15rem and there is no `Container`. The back link in the sidebar header
  is the only way out — structure, not decoration.
- The two-pane breakpoint is `lg`, because the embed's own container query is 640px **of its
  own width** and 1024 − 320 leaves 704px. Below `lg` the page stacks.
- **This page must have no `loading.tsx`.** With one, a navigation produced two large grey
  states for one click (the nav unmounting, `main` jumping 240px, eight `animate-pulse`
  boxes, then a second commit 550ms later). With none, the router awaits the payload and the
  nav's removal lands in the same paint as the designer's arrival. `SidebarNavItem`'s
  `useLinkStatus()` spinner is what acknowledges the click.
- **Nothing in the panel is a checkbox** — everything repaints the map under the pointer,
  which is what a switch is. Multi-part questions are one `PropertyToggles` row, not four
  stacked controls. `PropertySwitch` is only for labels that cannot become a glyph.
- Five-tile scales are illegible at 20rem, so Width and Transparency are
  `PropertyNumberSelect` and Blur and Pin size drop to three stops. Controls whose **tile
  draws the thing it is choosing** stayed tiles. Narrowing is safe: `nearestStop` lights the
  closest remaining option and writes nothing.
- **The preview has two channels.** Live: a `srcdoc` frame inherits this document's origin,
  so `lib/preview/live-chrome.ts` writes custom properties straight onto the running map's
  root — covering every control a pointer drags. Drift is prevented by construction, since
  the table is `chromeVars` in `packages/shared/embed-chrome.ts`, which `applyChrome` in the
  embed also calls. A property that becomes `undefined` must be **removed**, not skipped.
- Rebuild: `rebuildKey` is the snapshot with `CHROME_SETTING_KEYS` stripped out. There are
  **two iframes** — the replacement is built in the standby one and revealed on its `load`,
  which also bounds live WebGL contexts at two — and the camera is carried over via
  `MapHandle.getView()` plus `root.lmMap = map`.
- **A frame's initial `about:blank` fires a `load` too.** A document we build always carries
  `script[data-snapshot]`, so `got === null` means "not ours" and must be ignored while a
  navigation is in the air, or the one-navigation-at-a-time invariant breaks on every mount.
- StrictMode: `builtFor` holds the `rebuildKey` the effect last minted a blob for, and the
  unmount cleanup must skip a blob still `wanted` or `showing` — React 19 *simulates* an
  unmount between passes and was revoking a URL the first document was still fetching.
- The crossfade rule is that **both frames are opaque and the outgoing one is underneath**,
  which is false at mount. `reveal` is `null` until something has drawn and the first
  arrival does not animate. Measured: **one `srcdoc` assignment on a cold load**, against
  four before.
- `useEmbedDesign` PATCHes on a 400ms trailing timer and **the base a write applies to is the
  draft, never `map.settings`**. It lives in `publish-panel.tsx`, not the sidebar, because
  the preview reads the same draft.
- `.lm-list__item:hover` carries the row hover ground, **not `.lm-list__row`** — the actions
  are its sibling, so hovering stopped above the links. `--on` must be more specific rather
  than merely later.
- **The tag filter chips are gone from the embed, and that is the one place §7 is not
  honoured** — the bundle is shared, so a published map loses them on the next `/embed`
  deploy without republishing. `settings.filters` stays in the type; nothing reads it.
- A results row's pin is a **canvas** — the third renderer of one geometry. Not `pinSvg()`
  (the embed sets no `innerHTML` anywhere) and not a `data:` URI (a host CSP restricting
  `img-src` blocks it invisibly). `pinCanvas` caches one per `pinImageId(icon, color)`.
- **Adding a MapLibre control is nearly free**: `maplibre-gl` is `external` in
  `embed/vite.config.mts`, so its dist ships whole either way. Attribution is the one
  control with no switch (§12); there is no traffic or satellite toggle (§2).
- The Search placeholder and Nearest label were **deleted, not hidden** — they never reached
  a published snapshot, so §7 does not apply.

## Notes

**The Publish tab is the map designer, and the whole of what a visitor sees is
one JSON column.** It was five stacked panels in a 672px `Measure` column — a box
explaining publishing, a box explaining the preview, the snippet, five switches,
a domain list — with the preview itself *narrower than the embed's own 640px
container query*, so the results panel a visitor gets beside the map stacked
underneath it instead. The owner was looking at a layout their customers would
never see. It is now one column of controls and one map, edge to edge — and the
column **stands where the app nav does on every other page**: `hidesAppNav` in
`lib/layout/app-nav.ts` returns true for this route and `Sidebar` returns null,
so `components/publish/design-sidebar/` takes that 15rem and the map gets
everything else. Which is why the page has no `Container` either: a column meant
to read as the nav's replacement cannot sit inside `py-6`. The consequence is
that the back link in the sidebar's header is the only way out, so it is
structure rather than decoration.

**That reversed the breakpoint from `xl` back to `lg`, and both numbers were
measured.** The embed decides its own shape with a container query at 640px *of
its own width*, and under it the results panel stacks below the map. The two-pane
row first went to `xl` because the nav plus a right-hand column left the frame
about 400px at `lg` — the preview drew the phone layout, the Side and Placement
controls appeared to do nothing, and the page taught the opposite of what it is
for. With the nav gone, 1024 minus 320 leaves 704px, which clears it; below `lg`
the page stacks and the map takes the full width, clearing it by more.

**This page has no `loading.tsx`, and that is the fix for a real complaint rather
than an omission.** It had one, whose layout strings were copied verbatim from
`publish-panel.tsx` on the sound argument that a skeleton at the wrong size moves
the page when the real thing swaps in. What it produced was worse than a move.
Measured across a real navigation from the editor: one commit at t+0 in which the
app nav unmounts, `main` jumps 240px to the left, and **eight `animate-pulse` grey
boxes** take the whole viewport — then, 550ms later, a second commit replacing all
of it. Two large grey states for one click, which is what "the publish page
blinks" was. With no loading boundary the router awaits the payload instead, the
editor stays on screen, and the nav's removal and the designer's arrival land in
the same paint. The click is still acknowledged, because `SidebarNavItem` already
renders a `useLinkStatus()` spinner inside the `<Link>` and the pathname — and so
the nav — is still there for the whole pending phase. Re-measured after: no frame
anywhere in the navigation has an `animate-pulse` in it. `SidebarMapNav` is the
only link to this route, so nothing else needed an affordance.

**Nothing in the panel is a checkbox, and the reason is the same one the card
designer gives for keeping them.** A checkbox is a property of a draft that does
not leave the page until Save, which is what `BlockProperties` is; everything
here repaints the map under the pointer, which is what a switch is. Most of them
are not even one switch — the four fields a result row can draw and the four
MapLibre controls are each *one* question with four parts, so they are one line
of icon tiles (`PropertyToggles`, a multi-select `ToggleButtonGroup`) rather than
four labelled two-line controls stacked down a 20rem column. `PropertySwitch` is
for the handful whose label is a sentence and cannot become a glyph — "Show the
results panel", "Zoom with the scroll wheel".

**A five-tile scale is illegible at this width, and the fix is per control rather
than a rule.** Five words across 20rem is about 60px each, so Width and
Transparency became `PropertyNumberSelect` (`SelectControl` with the string
boundary done once) and Blur and Pin size dropped to three stops. Corners, Side,
Placement and the controls corner stayed tiles, because **a tile that draws the
thing it is choosing costs no label width at all** — the argument
`PropertyChoice` already makes. Narrowing a scale is safe on designs that already
exist: `nearestStop` lights the closest remaining tile and writes nothing.

**The Search placeholder and Nearest label are deleted, not hidden.** Wording is
not what anyone opens this panel to change, and the pair cost two full-width text
boxes in a column where every other control is one line. Gone from the schema,
from `SnapshotSettings` and from the embed's `createSearchField` and
`createNearestButton` — §7 does not apply, because those fields never reached a
published snapshot.

**Embed code and Allowed domains are a dialog, not a fold.** Both are read once
each — when the snippet is first pasted, when a domain is locked down — against
controls somebody adjusts for as long as they are on the page, and a 20rem column
made the snippet a code block scrolled sideways a word at a time.
`components/publish/share-dialog/` is a `Modal` holding both forms unchanged;
only their container was ever wrong.

**Everything the designer writes is optional on `SnapshotSettings`, and absent
means what the embed did before that field existed.** That is §7, and the
asymmetry it forces is the thing to understand before adding a setting:
`DEFAULT_EMBED_SETTINGS` in `lib/validation/embed-settings.schema.ts` is what a
map *publishes* and carries the current design (panel right, floating, pins in
the rows, controls top-left); the **embed** reads a missing key as the old
behaviour (panel docked left, no pins, controls top-right). Changing a default
changes what the next publish writes and can never change what a live customer
site already renders. `readEmbedSettings` resolves one fully-populated object
that feeds both the controls and `buildSnapshot`, so the panel and the published
map cannot disagree about an unset field — and it is the **only** writer of
`settings`, because that column is one blob `updateMap` serialises whole and two
forms writing it are the lost update §6 records. `EmbedSettingsForm` was deleted
rather than left beside it.

`useEmbedDesign` holds a draft and PATCHes on a 400ms trailing timer, flushed on
unmount. Not a saving: `ColorPickerField` fires `onChange` per pointer move, so a
one-second drag is thirty concurrent writes of one blob, replies land out of
order, and the last to arrive is what sticks. **The base a write applies to is
the draft and never `map.settings`** — that half is what stops a late reply
becoming the base for the next write and persisting a colour the owner has
already moved off. Measured in the browser: five changes in 300ms produce one
PATCH. The hook lives in `publish-panel.tsx` rather than in the sidebar, because
the preview reads the same draft — a preview reading the saved row would lag
every press by that timer.

**The preview does not rebuild itself for most of what the designer changes, and
that is the difference between a customizer and a slideshow.** `EmbedPreview`
keyed its `srcdoc` on the whole snapshot, so every press threw the document away:
a new MapLibre instance, a new WebGL context, a new tile fetch, and the camera
back at the map's saved view. Dragging a colour did that thirty times a second.
It blinked, it moved, and it got *worse the longer the page stayed open*, because
browsers cap live WebGL contexts and the churn was unbounded.

So there are two channels, the same split the card block panel makes between a
picture and a record.

The **live** one is possible at all because a `srcdoc` frame inherits this
document's origin, so its DOM is simply reachable: `lib/preview/live-chrome.ts`
writes the embed's own custom properties straight onto the running map's root.
That covers the panel's width, transparency, blur and corners, the row pin size
and all five colours — every control a pointer drags. **Drift is prevented by
construction rather than by discipline**: the table is `chromeVars` in
`packages/shared/embed-chrome.ts`, which `applyChrome` in `embed/src/index.ts`
also calls, so the preview cannot recolour one set of tokens while publishing
writes another. A property that becomes `undefined` is *removed*, not skipped, or
clearing a colour would do nothing.

The **rebuild** one is for the discrete presses — panel on/off, side, placement,
the row fields, the map controls, clustering, scroll zoom. `rebuildKey` is the
snapshot with `CHROME_SETTING_KEYS` stripped out, and it is what the `srcdoc`
effect depends on. Two things make what is left of it invisible. There are **two
iframes**, and the replacement is built in the standby one and revealed only on
its `load` — assigning `srcdoc` blanks a frame the instant it is set, so the
outgoing document stays on screen until then and is released immediately after,
which also bounds the live GPU contexts at two. And the **camera is carried
over**: `MapHandle.getView()` plus `root.lmMap = map` in `mount()` is the only
seam a parent document has, and without it every structural press threw the owner
back to the map's saved view.

**Arriving on the page was the one path none of that covered, and it built four
documents.** "It blinks several times before it initialises" was a separate bug
from the one above, in the same file, and it was mostly one line. React inserts
both iframes with no `src` and no `srcdoc`, which queues a `load` for each
frame's own initial `about:blank` — and that load is delivered *after* the mount
effect has already assigned a real document. `handleLoad` guards frame A with
`index !== standby.current` and had nothing guarding frame B, which is the frame
every navigation goes to, so the blank load cleared `navigating` while the real
one was still in flight and `flush` immediately assigned `srcdoc` again — the
one-navigation-at-a-time invariant that ref exists for, broken on every single
mount. A document we build always carries `script[data-snapshot]`, so `got ===
null` means "not ours" and is now simply ignored while a navigation is in the
air. Nothing deadlocks behind that: with no navigation ever aborted, every
assignment fires exactly one `load`.

Three smaller ones went with it, and two are StrictMode. `builtFor` holds the
`rebuildKey` the effect last minted a blob for, so the double-invoked mount pass
flushes instead of building a second document. The unmount cleanup skips a blob
that is still `wanted` or `showing` — React 19 *simulates* an unmount between
those two passes, so it was revoking the URL the first document was on its way to
fetching, which the embed answers by warning, returning, and never setting
`data-lm-ready`: a white box that `awaitReady` reveals anyway two seconds later.
And `useCardDesign` now takes its `initialData` from the page's own
`Promise.all`, because it was the one *legitimate* extra rebuild — the first
document was built against the default card and thrown away when the account's
real one landed.

The fourth is the crossfade, which was inert on the one load that needed it. The
rule it works by is written in globals.css — *both frames are opaque and the
outgoing one is still underneath* — and at mount that is false, because frame A
has never held a document. So it faded a blank white frame in over the frame
where the document was actually being built. `reveal` is `null` until something
has drawn, an opaque cover stands in for the missing outgoing document, and the
first arrival does not animate at all, having nothing to cross from. **Measured
in the browser: one `srcdoc` assignment on a cold load, against the four traced
before.** A chrome control still costs zero and a structural press still costs
exactly one.

**The results panel got the visual pass it never had**, on request, and one line
of it was a real bug: `.lm-list__row` is a `<button>` and `.lm-list__actions` is
its *sibling*, so the hover ground stopped above the Directions and phone links
and they read as belonging to something else. It is `.lm-list__item:hover` now,
which is why `--on` has to be more specific rather than merely later. With it:
the links became small outlined pills instead of `#1c7ed6` underlined text — a
hardcoded blue that ignored the owner's own accent, and the single thing making a
designed panel read as an undesigned web page — the name and address got a type
scale and a two-line clamp, the docked toolbar's field takes a foreground tint
rather than `--lm-surface` (a *solid* colour, so a field painted with it on a
translucent floating panel was an opaque patch in a see-through box), and the
selected row wears an inset bar because a 10% tint over a basemap is invisible.
The whole pass cost 0.1KB: the dead `.lm-list__tag` rules and the two deleted
text settings paid for it.

**The tag filter chips are gone from the embed, and that one is not free.** The
bundle is shared, so a map published with chips loses them on the next deploy of
`/embed` without its owner republishing — the one place §7 is not honoured, taken
deliberately. Every label they offered is in `buildSearchIndex`, so nothing
became unfindable, and the row's tag dot went with them because the pin at the
head of the row now answers "which of these is on the map?" better than a label
did. `settings.filters` stays in the type because published snapshots carry it;
nothing reads it.

**A results row's pin is a canvas, and that is the third renderer of one
geometry.** Not `pinSvg()` — it returns a string for `innerHTML`, and
`embed/src/dom.ts` sets none anywhere on purpose. Not a `data:` URI on an `<img>`
either: `pin-raster.ts` documents that a host CSP restricting `img-src` blocks
that outright and invisibly. So `drawPin` returns its canvas now, `pinCanvas`
caches one per `pinImageId(icon, color)`, and a row copies it with `drawImage` —
no fetch, no CSP surface, and one drawing shared by a hundred rows. A logo pin
cannot be drawn synchronously, so it is its body alone until
`registerPinImageBitmaps` fills the cache in and the next redraw picks it up.

**Adding a MapLibre control is nearly free and that is a fact about the build.**
`maplibre-gl` is `external` in `embed/vite.config.mts`, so its dist files ship
whole whether a map names `FullscreenControl` or not — what a switch costs is the
line that reads it. Attribution is the one control with no switch (§12), and
there is no traffic or satellite toggle because both are metered feeds in the
visitor's path (§2).

## From §4 — the embed boundary

**The own-code budget was raised from 42KB to 46KB for the map designer**, and that is the second and last time it should happen casually. It was at *exactly* 43,008 of 43,008 bytes — passing only because the check compares with `>` — and the designer needed a floating panel, a pin per results row and a dozen settings reads. Two things made 46 honest rather than a shrug: the **total**, which is what §4 actually protects and what a visitor downloads, had the room (315.9KB against the 320KB ceiling); and it was part-paid by deleting the tag filter chips rather than borrowed whole. The reasoning is written out in `scripts/check-embed-size.mjs`. Do not raise it again to get past a binding budget — it exists to catch the MapLibre duplication regression above, and a budget that moves whenever it binds is not one. Trim, or keep the addition on the dashboard side of the seam.

It started type-only. It now also holds a little runtime — `color.ts`, `darken-style.ts`, `load-style.ts`, `shapes.ts` — because the editor and the embed must run *the same* dark-basemap transform and turn a circle into *the same* ring of points, not two that agree today: the preview panel renders the real embed bundle beside the editor's own canvas, so any drift is two differently-coloured or differently-shaped maps on one screen. The condition for putting runtime here is **zero dependencies, vanilla TS**, since whatever this directory imports the embed inherits. ESLint holds `/packages/shared` to the embed's own import ban for exactly that reason. Anything needing a package belongs in `/lib`.
