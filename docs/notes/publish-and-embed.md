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
- The two-pane breakpoint is `lg`, because the embed's own stacking query is 640px **of its
  own width** and 1024 − 320 leaves 704px. Below `lg` the page stacks. (The drawer query is
  768px, so a `panelDrawer` map drawers at `lg` in the designer — that is the setting doing
  what it says, not the pane being too narrow.)
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
- **The floating toolbar is the docked one's twin and four rules were missing.** It is
  `inset-inline-start` and side-aware (`data-lm-side` is written from `panelSide` whether or
  not the list is on, so turning the list off no longer throws the search box to the other
  edge); it is `flex-wrap: nowrap`, with `min-width: 0` on both `.lm-search` and the input,
  so the row shrinks instead of dropping Nearest onto a second line; and under 480px
  `.lm-search` takes `flex: 1 1 auto` — `width: 100%` on a field inside a shrink-to-fit
  wrapper resolves against the wrapper's own content and did nothing.
- **A logical inset compiles to a `:lang()` pair, and that silently changed a specificity
  tie.** The base `.lm-root[data-lm-side="right"] .lm-toolbar { inset-inline-start: auto }`
  ships as `… .lm-toolbar:not(:is(:lang(ar), :lang(he), …))`, which counts a pseudo-class and
  so is (0,4,0); the 480px override set both sides to the *same* value, needed no direction,
  compiled to a bare selector at (0,3,0) and lost to the rule it exists to cancel. The field
  was back at 202px on a 390px map — the exact symptom the 480px block records having already
  fixed. `:not(:empty)` restores the weight honestly (an empty toolbar is `display: none`
  anyway). **This one reaches live maps**, and it is a broken state becoming a working one
  rather than a design changing under somebody, which is the same test the four fixes below
  passed. It was reachable only with the list switched off until `panelDrawer` started
  floating a narrow map's toolbar with the list on, which is how it was found.
- **A floating toolbar reserves 42px at the top of the corner it covers, and only that
  corner.** Padding both recreated the reported symptom on the far side. The two branches
  name opposite corners so they cannot conflict, which is what lets the 480px query add the
  other one without out-specifying anything; `:not([data-lm-side="right"])` keeps the two
  selectors the same weight.
- **`.lm-panel ~ .lm-canvas`, not `.lm-canvas`, carries the stacked 60%.** A map with the
  list switched off was giving away 40% of its height to nothing. The sibling combinator says
  "a panel precedes me" exactly and needs no `:has`.
- **`panelDrawer` is structural, not chrome.** Below the stylesheet's own drawer
  container query it takes the results panel out of the flow and parks it off the
  edge, and the toolbar has to *move* — out of the panel and onto the root — or the
  search box goes off the edge with it. No stylesheet can do that (`.lm-panel` is
  the containing block for its own absolutely-positioned children), so
  `installDrawer` runs a `ResizeObserver` and the setting stays out of
  `CHROME_SETTING_KEYS`: one rebuild per press, exactly what `list` and `panelSide`
  cost. `data-lm-drawer` is written in `render()` rather than by `chromeAttrs`, so
  that table still means exactly `CHROME_SETTING_KEYS`. **Absent is the stacked
  layout**, and every narrow rule it would fight is gated `:not([data-lm-drawer])`
  rather than cancelled property by property — two complete answers to one width,
  not one answer patching the other.
- **The drawer answers at 768px and the stacked layout at 640px, in two separate
  container queries.** Stacking is what a snapshot with no `panelDrawer` draws, and
  those are live on sites we do not control, so its breakpoint cannot move (§7); a
  drawer is opt-in and new, so it is free to cover a portrait tablet, which is the
  width where a results column beside the map leaves neither of them room.
  `DRAWER_MAX_WIDTH` in `embed/src/index.ts` carries the same 768 and has to — it
  decides where the toolbar lives while the query decides where the panel is drawn.
  The Tablet preview tile is 768px, so it lands inside the drawer's range by the
  root's own 1px border; that is what the tile is now for.
- **"The drawer doesn't slide in, the map behind it does" was `panel.focus()`, and
  the fix is `{ preventScroll: true }`.** At the instant focus lands the panel is
  still parked at `translateX(100%)`, so the browser scrolls the nearest scrollable
  ancestor to reveal it — that is `.lm-root`, whose `overflow: hidden` is still
  scrollable programmatically, and the map is inside it. Measured in the browser:
  `root.scrollLeft` jumped to 212 and decayed 212 → 78 → 19 → 0 across the 180ms,
  with the basemap dragged exactly that far under a drawer that looked stationary.
  After: `scrollLeft` stays 0 and the map's offset does not change by a pixel while
  the panel travels 340 → 0. The stylesheet's note about a focused *row* doing this
  is the same trap from the other side, and `inert` answers that one.
- **A drawer is the floating panel parked off the edge, and it overrides nothing
  the owner designed.** Transparency, blur, corner radius and the width scale all
  come from the same `--lm-panel-*` properties the floating rule reads, so a map
  designed at Glass (60%) and Slim (25%) — which is what `DEFAULT_EMBED_SETTINGS`
  ships — opens a glass, slim drawer. The drawer rule sets position, width and the
  transform and deliberately nothing else: the moment it restates `background` or
  `border-radius`, a control in the publish sidebar has an exception invisible from
  the sidebar. That is exactly what it did for one revision, and the complaint that
  found it was "it doesn't share glass theme that we run by default and slim
  profile". Two consequences worth knowing. `backdrop-filter` and `border-radius`
  *are* restated — not to override, but because `.lm-root[data-lm-float] .lm-panel`
  is where they otherwise live and a drawer is over the map at **either**
  placement; "Beside it" describes a layout this width does not have. And the width
  is `min(86%, max(var(--lm-panel-w, 40%), 300px))`: the percentage is of the
  embed's own box, so Slim is a readable column beside a 1200px map and 97px on a
  phone — the setting widens the drawer and never narrows it below what a name and
  an address need, while the 86% ceiling keeps the strip of basemap that says the
  map is still back there.
- **The blur does travel with the slide, and that is the accepted cost.** A
  `backdrop-filter` is sampled in the element's own coordinate space, so a
  10px-blurred panel carries its patch of basemap along for the 180ms. The
  drawer was opaque for one revision on the theory that this was the reported
  "the map slides, not the panel" — it was not; that was `panel.focus()`, the
  entry above. Weighed against discarding the map's own design language, the
  artifact is not worth paying for. If it ever has to go, the fix is to drop the
  filter for the length of the transition, not to hard-code a surface.
- **The drawer's open rule must not name `[data-lm-float]`, and `translate` is not
  available to make that easy.** The open state has to out-weigh both the closed
  rule and the *unqueried* floating side-flip, which a container query does nothing
  to weaken; done by stacking attributes, the open rule picked up `[data-lm-float]`
  that the closed rule does not have, so a map with the panel placed **beside** the
  map matched closed and never matched open — the trigger dimmed the basemap, moved
  focus into a panel off the edge, and slid nothing. The tidy answer is the
  `translate` property, which nothing else sets on `.lm-panel`. **It does not
  survive the build:** written `transform: none; translate: 100% 0`, Lightning CSS
  folds the pair into one `transform: translate(100%)` and deletes the property the
  open rule was going to answer on, with no error anywhere. So it stays `transform`
  and every selector is weighed by hand — each open selector ties the heaviest
  closed rule it competes with, four against four in LTR and five against five in
  RTL, and comes later. Check the built bundle, not the source, after touching any
  of it.
- **Find-nearest lives inside the search field.** The magnifier there was a picture
  (`pointer-events: none`) while the one live control beside it spent 34px of a row
  that runs out of width first on exactly the maps the drawer is for; at 390px the
  floating toolbar is now the field and the drawer trigger. `createSearchField`
  takes an `action`, and with none it draws the magnifier as before — a map with
  Nearest switched off still has to read as a search box. **The in-field control
  wears `lm-search__action` *instead of* `lm-button lm-button--icon`, not beside
  it**: `.lm-toolbar--docked .lm-button` paints a 6% well at two classes from a
  thousand lines further down, which one class cannot answer at any source
  position. `setNearestOn` is unchanged, so the lit rule still has to out-weigh
  `.lm-toolbar--docked .lm-button--on` and is scoped through `.lm-search` to do it.
- **`pinColor` is structural for the same kind of reason, and the reason is
  rasters.** Map markers and results rows are canvas images cached per
  `pinImageId(icon, color)`, so a custom property cannot recolour them — only a
  rebuild can, which is why it is a sibling of `colors` and not a sixth key inside
  it. The one renderer that *is* CSS, the card's Logo block, reads `--lm-pin`,
  written by `applyChrome` only when the snapshot carries the field; absent leaves
  the stylesheet's `#7a828f` in charge, which is what every live snapshot draws.
  `ColorPickerField` fires per pointer move and this build of
  `react-aria-components` exposes no `onChangeEnd`, so `PinColorField` in
  `colors-group.tsx` commits on a 250ms trailing timer instead.
- **The device preview is a width and nothing else, and it is local state.** Every
  responsive rule the embed has is a `@container` query against `.lm-root`'s own inline
  size, so capping the frame *is* the phone layout — no emulation, no second document. It
  lives in `useState` in `publish-panel.tsx` rather than in `settings`, because a key there
  would change `rebuildKey` and throw the document away on every press. `EmbedPreview`
  repaints **both** frames on a width change: MapLibre paints on demand, and the standby
  frame would otherwise be revealed at the old size. **It sits in the sidebar header
  now, not over the map** — `DeviceToggle`'s own docblock keeps the old placement
  reasoning, because the argument against the header was that a 20rem row already held a
  truncating map name, and turning the back link into an icon is what removed it. It kept
  its translucent pill only for as long as it was on the map.
- **A floating toolbar wears the panel's glass, and the glass rule sets no real
  property.** `toolbarGlass` writes `data-lm-glass`, and the rule under it
  assigns `--lm-tool-bg` and `--lm-tool-blur` on the toolbar alone; the base
  `.lm-search__input, .lm-button` rule reads them as fallbacks. That is forced
  rather than tidy: a rule *painting* `background` on those elements would have
  to out-weigh `.lm-toolbar--docked .lm-search__input` (two classes) and lose to
  `.lm-button--on` (one), and no selector does both. Naming the ground instead
  leaves every existing override winning exactly as it did. `blur(var(--lm-panel-blur))`
  carries **no fallback on purpose** — absent makes `--lm-tool-blur`
  guaranteed-invalid, so `backdrop-filter: var(--lm-tool-blur, none)` resolves to
  `none` rather than the `blur(0)` `chromeVars` already refuses to write. The
  corner is deliberately *not* inherited: `--lm-panel-radius` runs to 24px, which
  on a 34px control is a lozenge.
- **The results-row links are four tokens on the link and three treatments on the
  root, and the split is a cascade fact.** `.lm-list__link:hover` sets
  `--lm-link-bg`/`--lm-link-fg` **on the element**, which beats any inherited
  value however heavy the selector that set it — so a variant painting real
  properties would kill its own hover, and a variant setting the tokens on the
  link would too. On `.lm-root` they reach the link by inheritance and the hover
  still wins. The outline's hover *line* is therefore scoped
  `.lm-root:not([data-lm-link])`, because leaving it in the shared rule grew a
  border on every borderless chip under the pointer. Verified in the browser
  across all four treatments, at rest and hovered.
- **`card: false` is a pin that opens nothing, and `focusPlace` needed no branch
  for it.** MapLibre's `Popup.remove()` does `delete this._container`, so
  `getElement()` is undefined on a popup never added — which is every popup on a
  card-less map — and `flyToCard`'s existing `!card` branch already flies plain.
  `setOpen` still runs, so a pin click marks the row: the information moves to
  the panel rather than disappearing. A shape's popup is out of scope — it is an
  area's name, not a location card.
- **`select()` must scroll this list and nothing else.**
  `row.scrollIntoView({ block: "nearest" })` is what it was, and on a drawer map
  it dragged the basemap out from under a panel nobody had opened — measured:
  `root.scrollLeft` 0 → 284, the panel from x=670 to x=386, the canvas from
  x=16.8 to x=−267.2, with `data-lm-drawer-open` false and no veil, so there was
  nothing to press to undo it. `inert` answers the *focus* half of this trap and
  cannot answer this half. Two rect reads and one `scrollTop` write reproduce
  `nearest` exactly with no way to reach an ancestor.
- **A group's colour travels; a group's id does not.** `groupId` is still kept off
  every snapshot — a visitor cannot see a group or act on one. What is published is
  the colour it *decided*, because that is a fact about the pin rather than about the
  group: `SnapshotShape.color` (already "already resolved", so free) and the new
  optional `SnapshotPlace.color`, written only when a group actually decided.
  **Absent means the pin works its own colour out**, which is what every snapshot
  already on a customer's site says, so a map with no groups publishes the bytes it
  always published. `lib/map/group-colors.ts` is the single statement of the
  precedence, and the canvas, the PNG export and publish all read it.
- **The designer's "Results panel" fold is three folds.** Search and Nearest and the
  glass switch were never panel controls — the embed draws them on a map with the
  list switched off — and they are in "Map controls" now. Transparency, blur and
  corners are a "Panel surface" fold that is `isEmpty` unless the panel floats,
  because a trigger opening onto nothing is worse than no trigger. What is left is a
  master switch, three selectors and one run of switches, which is the shape the rest
  of the designer already had.
- **The accent has a default and the other four colours do not.** `DEFAULT_EMBED_ACCENT`
  seeds `DEFAULT_EMBED_SETTINGS.colors`, so `readColors` always resolves an accent and every
  new publish writes one. `--lm-focus` in the stylesheet stays `#1c7ed6`, because that is
  what live snapshots were published against (§7). The four remaining tokens stay absent so
  `.lm-root--dark` can still redefine them.

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

**The four toolbar and layout fixes above reach live maps, and that is the tag-chip
trade taken deliberately a second time.** The bundle is shared, so a map published today
picks them up on the next deploy of `/embed` without its owner republishing: a right-hand
map with the list off moves its search box to the right, a narrow one stops wrapping and
stops hiding its own zoom-in button under the search field, and a panel-less narrow one
fills the height it was already given. Every one of those is a broken state becoming a
working one rather than a design changing under somebody, which is the distinction that
makes it worth doing — the colour default, which *is* a design change, was routed through
`DEFAULT_EMBED_SETTINGS` instead precisely so it could not.

Measured before the fix, in the publish preview at 390px with the list off:
`.maplibregl-ctrl-zoom-in` sat at (11, 11) and `.lm-search__input` sat at (11, 11) — the
zoom button was not mispositioned, it was underneath. The field measured 202px at every
width from 480px down, and Nearest wrapped to a second row below 260px. After: the field
runs 418 → 130px across that range, nothing wraps down to a 180px embed, and the zoom stack
starts at y=53.

**Three settings later, the binding number is the total and it has 26 bytes in
it.** Glass over the map, a card that can be switched off and a treatment for the
results row's two links cost about 360 bytes gzipped between them, against a
ceiling with 400. They fit, and what paid for the overshoot is worth writing
down, because it is the shape of every future addition here:

- `--lm-tool-radius` went, on its own merits — see the invariant above.
- `focusPlace`'s explicit card-off branch went, because `flyToCard` already had
  one and MapLibre's `remove()` guarantees it fires.
- `--lm-link-bg: transparent` in the `plain` rule was the base's own default
  restated, and the outline's hover line moved to `:not([data-lm-link])` instead
  of being painted on all four and undone on three.

None of that is a feature trimmed, which is the test §4 sets. **What did not
happen, and is the next lever if anyone needs one:** the bundle's own CSS is
29.2KB raw, and **8.1KB of it is `:lang()` expansion Lightning CSS generates
because `build.target` is `es2020`** — every `inset-inline-*` ships as an
LTR/RTL pair, twice over, once for `:is()` and once for `:-webkit-any()`.
Gzipped that is about 400 bytes, for browsers that cannot render a `color-mix()`,
a `@container` query or an ESM script and therefore cannot render this embed at
all. Raising `build.cssTarget` would reclaim it — and would also re-weigh every
selector in this file, including the two ties hand-counted above (the 480px
toolbar rule and the drawer's open/closed pair), which is why it is written here
as a measured option rather than taken as a shave. It is a §3/§4 conversation,
and the numbers for it are on this line.

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


**The budget was at the ceiling, and the lever this file left on the table is
what paid for the next feature.** Three settings had taken the total to 320.0KB of
a 320.0KB ceiling — passing only because the comparison is `>` — with 211 bytes
left against our own 47KB budget. Then a dotted route turned out to draw eggs
rather than dots at every fractional zoom (`docs/notes/shapes-and-routes.md`), and
fixing it in the embed as well as the editor costs about 250 bytes. Editor-only was
not an option: the preview on this page is the real bundle, so a fix in one is a
new divergence in the other, which is the class of bug the same change was closing
for colours.

So the `build.cssTarget` option written up above was taken, and it reclaimed
**about 600 bytes** — more than the ~400 estimated. Ours went 47.1 → 46.5KB and the
total 320.2 → 319.7KB, which is more headroom than there was before any of this
started. The argument is the one this file already made: the expansion is an
LTR/RTL `:lang()` polyfill for `inset-inline-*`, and logical properties have been
supported since Chrome 87 — far below the `color-mix()`, `@container` and ESM floor
that decides whether this bundle renders at all. **No browser that could render the
embed before loses anything.**

The risk this file flagged was that raising it re-weighs every selector, including
the two ties hand-counted here. Checked in the browser against `/embed/dev.html`
after the change: the floating glass panel, the docked toolbar, the results rows
with their outlined pill links, the circle and polygon shapes and the scrollbar all
draw exactly as before. Worth re-checking the narrow-width drawer specifically if
anything in that area moves again.
