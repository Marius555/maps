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
  is what a map *publishes* (panel right, floating, pins in rows, controls bottom-left); the
  **embed** reads a missing key as the *old* behaviour (panel docked left, no pins, controls
  top-right). Changing a default changes the next publish and can never change what a live
  customer site already renders.
- **A changed default does not reach a map that already has the old one written down, and
  that is the asymmetry seen from the owner's chair.** Reported as "the zoom buttons are
  top-left and I asked for lower left". Nothing was broken: `controlsCorner` shipped
  defaulting to `"top-left"`, `useEmbedDesign` writes the *whole* resolved blob on the first
  edit of anything, so that value was baked into the row — and when the default became
  `"bottom-left"`, `readEmbedSettings` found a real value and never reached it. Verified in
  the browser: the snapshot in the preview frame said `top-left`, the sidebar's Corner tile
  said "Top left", and the embed had put both control groups in
  `.maplibregl-ctrl-top-left` exactly as asked. The fix is one press of the tile, and the
  thing to know is the shape: **every map that predates a default carries the default it
  was written against**, and nothing may quietly rewrite it (§6 — a design somebody made is
  not ours to edit). If a changed default ever has to reach existing maps, that is a
  migration with the owner's knowledge, not an edit to `DEFAULT_EMBED_SETTINGS`.
- **A boolean the stylesheet branches on is an attribute, not a variable.** `panelScrollbar`
  hides the results list's own bar, and hiding one takes `scrollbar-width` *and* a
  `::-webkit-scrollbar` rule — a pseudo-element cannot be switched on by a custom property.
  So it rides in `chromeAttrs` as `data-lm-bar="0"`, written **only** when it is off, beside
  the side and the placement; `CHROME_SETTING_KEYS` carries it, so toggling it repaints the
  running preview instead of rebuilding the frame. Verified: same iframe, 17 network
  resources before and after.
- **`/embed/live.html` is a product surface now, not only a dev harness**, because the share
  dialog's "Open test page" links to it. Two consequences. `snapshot=` must stay the **last**
  query param — the page reads it as `/[?&]snapshot=(.+)$/`, everything to end-of-string, so
  that an Appwrite-hosted URL carrying its own `?project=` survives; `embedTestPageUrl` in
  `lib/embed/snippet.ts` is the one builder and the only place that rule is written down. And
  it must be built from the **dashboard's** origin, never `embedScriptUrl`'s, which may point
  at a CDN that serves `map.js` and no harness.
- **The test page reads measurement off the snapshot it fetched, not off `settings`**, and it
  is the only thing in the product that does. See the prose below.
- The Publish page **hides the app nav** (`hidesAppNav` in `lib/layout/app-nav.ts`), so the
  sidebar takes that 15rem and there is no `Container`. The back link in the sidebar header
  is the only way out — structure, not decoration.
- The two-pane breakpoint is `lg`, because the embed's own stacking query is 640px **of its
  own width** and 1024 − 320 leaves 704px. (The drawer query is 768px, so a `panelDrawer`
  map drawers at `lg` in the designer — that is the setting doing what it says, not the
  pane being too narrow.)
- **Below `lg` the design column is a bottom sheet over the map**, the same box the
  editor's locations panel and the card designer's sidebar are
  (`components/ui/bottom-sheet.tsx`). It was a `max-h-[60dvh]` block stacked under a
  `55dvh` map with the page scrolling past both — a designer where neither half has room
  and neither can be seen while the other is used. The page's own row therefore carries a
  definite height at every width (`h-[calc(100dvh-3.5rem)] md:h-[100dvh]`, the 3.5rem
  being the `md:hidden` `MobileHeader`), plus `relative` and `max-lg:overflow-hidden`,
  which are what the sheet needs of a caller.
- **The preview gets `max-lg:pb-[var(--sheet-peek)]`, not `--map-chrome-inset`.** The
  editor lifts MapLibre's bottom corner with that property; it cannot reach here, because
  the preview is the real embed in an iframe and a custom property on this document stops
  at the frame. Ending the frame above the strip is the only way the embed's attribution
  and its zoom stack stay uncovered (§12). Measured at 822x732: the frame's bottom edge is
  668 and the strip's top is 669.
- **The peek strip says the name and `PublishStatus compact`, and the footer's copy is
  `max-lg:hidden`.** The full status is a sentence; on a 390px strip 2.75rem tall, beside
  the panel's own name, it wrapped onto three lines and printed itself over "Design". The
  compact form is the word plus the card designer's unsaved dot — whether it is live, and
  whether what is live is current. **Publish itself is one tap away** below `lg`: it stays
  in the footer, because a long column of controls must not be able to push it out of
  reach and a second row of chrome is what the strip exists to avoid.
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
- **The embed renders into the host document and there is no shadow DOM, so every bare
  element selector on a customer's page reaches it.** `.lm-root :is(button, a, input, ul, li)`
  in `embed/src/styles.css` is the floor that stands between them, and it carries only
  properties the stylesheet does not already state on those elements. The weight is counted
  rather than assumed: `:is()` takes its heaviest argument, all bare element selectors, so the
  rule is (0,1,1) — above a host's `button` at (0,0,1) and below every one of our class rules
  at (0,2,0)+. A host rule at `.promo button` ties and wins on order; that is the accepted
  limit of doing this without a shadow root. **This was found the expensive way.**
  `/embed/live.html` styled its own Load map button with a bare `button { margin-top: 8px }`,
  which landed on the map's zoom stack (group 72 → 88px, 8px above each button) and on
  find-nearest inside the search field (8px low). It was reported three times as an embed bug
  — "the zoom buttons are too big", "padding top and bottom", "the nearest-to-me button is
  lower than the search bar" — and chased through three rounds of fixes to `styles.css`,
  because `/embed/dev.html` has no such rule and measured clean every time. **Neither harness
  may ever style a bare element**: the moment one does it stops predicting what a customer
  sees, which is the only reason either page exists. Both are scoped to `#form` now.
- **The map draws zoom in and zoom out and nothing else.** Compass, find-my-location,
  fullscreen and the scale bar went on request ("there is too many default map buttons, we
  don't need ruler, full screen, compass, location button, just zoom in and out"), and the
  designer's four-tile "On the map" row went with them — a switch for a control that no longer
  exists is worse than no switch. `compass`, `geolocate`, `fullscreen` and `scale` are
  **retired** on `SnapshotSettings`, like `filters`: still parsed, never written, never read.
  Find-my-location is the only one that did a job, and "Nearest to me" in the toolbar does it
  better — it re-sorts the list rather than dropping a blue dot.
- **A results row's two links are plain text that takes the accent under the pointer, and
  there is no choice.** They were an outlined pill with `soft`, `solid` and `plain`
  alternatives and four corners behind a pair of designer controls; now they are words ("I
  don't want directions, phone number and other options to be in chip, just put in plain
  text"). `rowLinkStyle` and `rowLinkRadius` are retired, `data-lm-link` and
  `--lm-link-radius` are gone from `chromeVars`/`chromeAttrs`, and the row is `flex-wrap:
  nowrap` — the wrapping was the other half of the report, two chips at 9px of padding in a
  25% panel less a 52px indent running out of width and stacking into a column. The phone
  link is the one that gives way (`--phone`, `flex: 0 1 auto` with an ellipsis); Directions is
  fixed.
- **The hover is the accent and nothing else, and that is the general rule here: a state may
  repaint a control and may not resize it.** For one revision the hover also set
  `font-weight: 600`, which is what had been asked for, and this file argued the growth was
  affordable — measured, the sibling moved a pixel, and the pointer was on the word that grew.
  The next request was "remove bold state and make sure they dont change in size, just change
  color on hover", and both halves of it are the one deleted declaration. Re-measured after:
  hovering Directions leaves its own box at x 965.19 / width 53.2 and the phone number at
  x 1030.39 / width 85.95 — identical to a pixel — while the colour moves from
  `rgb(242,243,245)` to `rgb(77,171,247)`. The rest of the stylesheet already worked this way:
  `.lm-list__item--on` draws its bar with an inset shadow, and focus is an `outline`. Both are
  out of flow on purpose.
- **A results row's type is 14 / 13 / 12, and the address is the 12.** The name inherits the
  root's 14px at 600, the distance beside it is 13px, and the address dropped from 13 to 12
  on request. The reason it is the one that gives way: the street confirms a result once the
  name has been read, where the name and the distance are the two columns a visitor actually
  scans down, and at 13px it carried the same weight in the row as both of them. It is level
  with the two links below it now.
- **This pass reaches maps that are already live** — the hover, the field width and the
  address size all ship in the shared bundle, so a map published today picks them up on the
  next deploy of `/embed` without its owner republishing. That is the tag-chip trade again,
  and unlike the toolbar fixes these are design changes rather than broken states becoming
  working ones. Taken because each was asked for directly, and recorded here rather than
  assumed.
- **The search field answers focus with its own border, not the accent ring.** `.lm-root
  :focus-visible` stays — it is the only focus affordance anything in the embed has, and §8
  lists visible keyboard focus as a quality floor — but on this one control `outline-offset:
  2px` drew a coloured halo outside a box already sitting in a 7px-padded toolbar. The
  override is `.lm-root .lm-search__input:focus-visible`, and **the weight is counted, not
  guessed**: a pseudo-class counts as a class, so it is (0,3,0) and beats `.lm-toolbar--docked
  .lm-search__input` at (0,2,0) a thousand lines later. Without the pseudo-class in the count
  the two would tie and a docked field would have no focus state at all.
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
  container query it takes the results panel out of the flow and parks it, and the
  toolbar has to *move* — out of the panel and onto the root — or the search box goes
  with it. No stylesheet can do that (`.lm-panel` is the containing block for its own
  absolutely-positioned children), so `installDrawer` runs a `ResizeObserver` and the
  setting stays out of `CHROME_SETTING_KEYS`: one rebuild per press, exactly what
  `list` and `panelSide` cost. `data-lm-drawer` is written in `render()` rather than by
  `chromeAttrs`, so that table still means exactly `CHROME_SETTING_KEYS`.
- **The switch has three answers and only two of them are positions.** `true` is the
  bottom sheet, `false` is the side drawer, and **absent is the stacked layout** — what
  every snapshot published before the field existed draws on sites we do not control
  (§7), and what neither position of the switch can now produce. `installDrawer` is
  therefore entered on `!== undefined` rather than on truthiness, and every narrow rule
  the stacked block would fight is gated `:not([data-lm-drawer])` rather than cancelled
  property by property — three complete answers to one width, not one answer patching
  another.
- **`data-lm-drawer` carries the axis, `"sheet"` or `"side"`, and almost nothing reads
  the value.** The shared rule, the open rule and the stacked block's negation are all
  written as attribute *presence*, so adding the second axis changed none of them. Only
  three rules name a value: the two closed parks and the MapLibre bottom-corner
  clearance, which is the sheet's alone because a side drawer covers neither bottom
  corner shut. **The open rule serves both** — `transform: translateY(0)` cancels a
  `translateX` as completely as a `translateY`, `transform` being one property — which
  is why the second axis needed no second open state and no second hand-counted tie.
- **The sheet replaced the side drawer on 2026-09-17 and stopped replacing it on the
  same day.** The bottom sheet is what `true` draws, and it is the better default: a
  strip along the bottom is its own trigger and its own affordance — it says a list is
  there, says how to get it, and, because it *is* the panel rather than a button about
  the panel, it opens by being dragged. Deliberately the same gesture as
  `components/ui/bottom-sheet.tsx` on the dashboard, down to the 6px of slop and the
  48px snap, so an owner who has used the editor does not have to learn a second one on
  the map they published. **What was wrong was deleting the other one.** `false` fell
  through to the stacked layout, which is a results panel welded to the bottom 40% of
  an already small map — so a two-position switch had one implementation behind it and
  the other position was not an alternative but a worse version of the same idea.
  Reported as "when I switch it off I want the side bar and the button back". The side
  drawer is `false` now, restored from the commit that removed it, and the switch is
  named for what it turns *on* ("Use a bottom drawer") because both positions are a
  drawer. **The sheet still reaches every `panelDrawer: true` map already live, on the
  next `/embed` deploy and without the owner republishing** — the same trade as the tag
  chips and each toolbar resize, taken because it was asked for directly.
- **Three things went out with the side drawer and only one came back.** The hamburger
  `trigger` and its three SVG paths had to: parked off the edge there is nothing of the
  panel on screen to press, which is the whole reason the sheet could drop it. The
  other two stayed gone on their merits rather than by omission. The **`.lm-veil`**
  scrim: the editor's sheet has none on purpose — the map behind it keeps working,
  which a scrim would end. And **`panel.focus({ preventScroll: true })`** with the
  `moveFocus` argument threaded through `setOpen`: both triggers are real `<button>`s
  carrying `aria-expanded`, so there is nowhere focus needs to be sent.
- **The veil's *job* came back without the veil, and the browser is what found it.**
  This note first said the trigger was "always on screen to press either way". For the
  sheet it is; for the side drawer it is not — the hamburger sits at the end of the
  floating toolbar, which is exactly the edge the panel slides in over. Measured at
  390px: trigger at x=344, open panel from x=80 to 380 at the z-index above it. On a
  phone, with no Escape key, the only way out was to pick a location. So the side
  drawer shuts on a `pointerdown` anywhere outside the panel and the toolbar — a
  listener, not a scrim, so the press also reaches the map and a pin tapped past the
  panel opens its card in one go. The toolbar is excluded so typing a search does not
  shut the list it filters, and the sheet does not get it at all: its strip is still
  there to press. 63 bytes. Verified: a map press shuts it, presses in the panel and
  the search field do not, and `root.scrollLeft`/`scrollTop` stay 0 throughout. `list.inert` — not `panel.inert`, because
  the sheet's strip lives inside the panel — is the whole of what keeps a parked panel
  out of reach, and it is one line rather than a branch because the trap is the same on
  both axes.
- **Carrying both axes cost 162 bytes and the own-code budget was raised to 48KB for
  it**, which is the fourth raise and the first taken against §4's rule rather than
  around it. Four trims paid back 18 of the 162 first and each is a real simplification:
  the shared drawer rule went from three selectors to one (the weight-carriers it was
  written to out-weigh set *nothing but* `transform`, and it sets none); the two
  triggers share one `button()` call and one accessible name; `aria-label` is reflected
  as `ariaLabel` beside the `ariaExpanded` that already was; and the trigger's two
  placements folded into one branch. The remaining 144 was put to the owner with the
  numbers and they took it. The argument is written out in `scripts/check-embed-size.mjs`
  — **the rule it overrides is unchanged for the next person.**
- **The `panel.focus()` post-mortem is kept because the trap is still there, rotated 90
  degrees.** "The drawer doesn't slide in, the map behind it does" was `focus()` landing
  on a panel still parked off the edge: the browser scrolls the nearest scrollable
  ancestor to reveal it, that is `.lm-root`, whose `overflow: hidden` is still
  scrollable programmatically, and the map is inside it. Measured then:
  `root.scrollLeft` jumped to 212 and decayed 212 → 78 → 19 → 0 across the 180ms.
  Parked *downwards* the same thing would act on `scrollTop`, and a transform still
  contributes to scrollable overflow (measured: `scrollHeight` 801 against a
  `clientHeight` of 518). What answers it is `inert`, and **the element it goes on
  moved**: the strip lives inside `.lm-panel` now, so marking the panel inert would
  take the sheet's own trigger out of the tab order with it. `list.inert` is the
  statement, which is what the dashboard's sheet does to its content wrapper.
  Verified after: `scrollTop` and `scrollLeft` both stay 0 across opening, dragging,
  focusing a row and a pin click that calls `select()`, and a `row.focus()` while shut
  leaves `document.activeElement` on `BODY`.
- **The drawer answers at 768px and the stacked layout at 640px, in two separate
  container queries.** Stacking is what a snapshot with no `panelDrawer` draws, and
  those are live on sites we do not control, so its breakpoint cannot move (§7); a
  drawer is opt-in and new, so it is free to cover a portrait tablet, which is the
  width where a results column beside the map leaves neither of them room.
  `DRAWER_MAX_WIDTH` in `embed/src/index.ts` carries the same 768 and has to — it
  decides where the toolbar lives while the query decides where the panel is drawn.
  The Tablet preview tile is 768px, so it lands inside the drawer's range by the
  root's own 1px border; that is what the tile is now for.
- **A sheet is the floating panel parked at the bottom, and it overrides one thing the
  owner designed.** Transparency, blur and corner radius all come from the same
  `--lm-panel-*` properties the floating rule reads, so a map designed at Glass (60%) —
  which is what `DEFAULT_EMBED_SETTINGS` ships — opens a glass sheet. Verified in the
  preview: `oklab(… / 0.6)`, `blur(10px)`, `border-radius: 12px`. The rule sets
  position, height and the transform and deliberately nothing else; the moment it
  restates `background`, a control in the publish sidebar has an exception invisible
  from the sidebar, which is what it did for one revision when it was a side drawer
  (the complaint that found it was "it doesn't share glass theme that we run by default
  and slim profile").
  **The exception is Width, and it is inherent rather than an oversight.** A sheet that
  comes up from the bottom spans the box, so there is no edge for a 25% column to be a
  column against, and `--lm-panel-w` stops reaching the panel below 768px. That costs
  nothing real: the percentage is of the embed's own box, so Slim was 97px on a phone
  and the side drawer had to clamp it up to 300px anyway. The setting means what it says
  again the moment the map is wide enough to have a side.
- **`backdrop-filter` and `border-radius` are restated, not to override but because
  `.lm-root[data-lm-float] .lm-panel` is where they otherwise live and a sheet is over
  the map at *either* placement**; "Beside it" describes a layout this width does not
  have. The blur travels with the slide — a `backdrop-filter` is sampled in the
  element's own coordinate space, so a 10px-blurred panel carries its patch of basemap
  along for the 180ms. The sheet was opaque for one revision on the theory that this was
  the reported "the map slides, not the panel"; it was not, that was `panel.focus()`.
  Weighed against discarding the map's own design language the artifact is not worth
  paying for. If it ever has to go, drop the filter for the length of the transition
  rather than hard-coding a surface.
- **The open rule must not name `[data-lm-float]`, and `translate` is still not
  available to make that easy.** The open state has to out-weigh both the closed rule
  and the *unqueried* floating side-flip, which a container query does nothing to
  weaken; done by stacking attributes, the open rule once picked up `[data-lm-float]`
  that the closed rule does not have, so a map with the panel placed **beside** the map
  matched closed and never matched open — the trigger moved focus into a panel off the
  edge and slid nothing. The tidy answer is the `translate` property, which nothing else
  sets on `.lm-panel`. **It does not survive the build:** written
  `transform: none; translate: 0 X`, Lightning CSS folds the pair into one `transform`
  and deletes the property the open rule was going to answer on, with no error anywhere.
  So it stays `transform` and every selector is weighed by hand. Check the built bundle,
  not the source, after touching any of it — verified this pass:
  `transform:translateY(calc(100% - 44px))` closed and `transform:translateY(0)` open,
  and the only `translate:` left in the bundle is `.lm-search__icon`'s.
- **The RTL selector survived the move to a bottom sheet, and it is no longer a
  mirror — it is a weight.** A sheet has nothing to mirror, so the instinct is to delete
  it. `[dir="rtl"] .lm-root[data-lm-float][data-lm-side="right"] .lm-panel` sits
  unqueried at five and sets `transform: translateX(...)`; without a five in the closed
  block, an RTL host page with the panel on the right would slide the sheet sideways.
  It is folded into the closed rule's selector list rather than kept as its own block,
  which is the one part of this pass that got *cheaper*. The open rule keeps both
  selectors for the matching reason: the closed block's own five would otherwise beat
  the open rule's four.
- **§12 is a rule here, not a nicety: the strip parks over exactly the corner MapLibre
  stacks the attribution and the zoom buttons in.** `--map-chrome-inset` is how the
  editor answers this for the same sheet and cannot reach — there the property is set on
  the dashboard's document and here the map *is* the document — so
  `.maplibregl-ctrl-bottom-left`/`-right` take a `padding-bottom` inside the drawer
  query. **Both corners, unlike the top rule**, which names one because a floating
  toolbar covers one; a sheet spans, so there is no far corner to leave alone and the
  rule needs no `:has`, no side branch and no matched-weight pair.
  **The number is 42, not 52, and the ten is MapLibre's own margin.** The top rule is
  "control height plus 8" because the toolbar it clears is inset from the frame by the
  same 10px the controls are; the strip is flush to the bottom edge instead, so the
  arithmetic is 44 + 8 − 10. Measured at 515×520 with 52: an 18px gap, which is the
  phantom band the top rule's comment warns about. With 42: 8px. Verified on the real
  publish preview at 414px — attribution and zoom stack both end at 559 against a strip
  starting at 568.
- **The sheet is flush to the bottom edge, and a 10px gutter there is a bug rather than
  a taste.** A translate parks the box by its *own* height, so lifting it 10px and then
  pushing it down by `100% - 44px` leaves 54px on screen: the strip plus a 10px sliver
  of the first row, with the strip's own bottom border stranded in the middle of it.
  Measured at 515×520 with `inset: auto 10px 10px`: the strip ended at 510 against a
  frame ending at 520. `inset: auto 10px 0` is what `max-lg:bottom-0` does for the same
  sheet on the dashboard, and the visible height is then exactly the strip.
- **The strip needs `flex: none`, and a 44px rule is not enough on its own.**
  `.lm-panel` is a flex column, so the strip is a flex item and `height` is only its
  basis — the list below it has content to show, so the default `flex-shrink: 1` squeezed
  a 44px strip to 31px and left the sheet parked 13px too low. Measured before the fix
  at 515×520: a 44px rule drawing a 31px box.
- **44px is written out at three sites rather than held in a custom property, and that
  is a budget decision with its reasoning on the rules.** The strip's height, the park
  distance, and the 42px of clearance all have to agree, and `--lm-peek` saying so once
  is how `app/globals.css` does it for the dashboard's sheet at 4rem. The property plus
  three `var()` calls measured 29 bytes gzipped against a budget that was 29 over. Two
  things make it survivable: the **JS half cannot drift at all**, because
  `installDrawer` measures `grip.offsetHeight` and never reads a number, and all three
  sites are inside one container query within fifty lines of each other.
- **The strip says "Locations" and no count, and that is a correctness call before it is
  a byte one.** A total printed there is the snapshot's, and the list under it is
  whatever the search box and find-nearest have left — so the strip would read
  "Locations · 40" over three matching rows. A live count means a callback out of
  `setPlaces`, which is more than it is worth for a number a visitor did not ask for;
  the editor's strip carries one because managing the list is the whole point of that
  screen.
- **The tap and the drag live on one button, and `event.detail` is what separates
  them.** A pointer released after 200px of dragging fires a click too, and that click
  would undo the drag that just landed. The dashboard's sheet arms a `swallowClick`
  flag; here the gesture decides it on its own terms — a press that never passed the
  slop calls the toggle from `onEnd` — and the `click` listener fires only when
  `detail` is 0, which is what a browser reports for a click synthesised from Enter or
  Space. No state to leave armed against an unrelated click later. Verified: drag past
  the snap opens, a 30px drag returns, 150px down shuts, a tap toggles, Escape shuts, a
  `detail: 0` click toggles and a `detail: 1` click is ignored.
- **The grab pill is a tinted `currentColor`, not `--lm-border`.** The border token was
  one declaration instead of two and it was wrong: measured on the dark theme it
  rendered `rgb(44, 47, 53)` against a `#17181a` surface, which is a pill nobody can
  see — and it is the only thing on the strip that says it can be dragged.
  `currentColor` tracks both themes and any colour the owner set. It is drawn as
  `::before` rather than a `<span>` because a pseudo-element is CSS the minifier already
  ships and an element is JS bytes.
- **No `aria-controls`, deliberately.** The list is the strip's own next sibling, which
  is the disclosure pattern ARIA describes, and there `aria-controls` is optional,
  thinly supported by screen readers, and would cost the list a literal `id` that a
  second map on the page would collide with. The dashboard's sheet names one because its
  content is not a sibling.
- **Find-nearest lives inside the search field.** The magnifier there was a picture
  (`pointer-events: none`) while the one live control beside it spent 34px of a row
  that runs out of width first on exactly the maps the drawer is for; at 390px the
  floating toolbar is now the field and nothing else, the drawer's own trigger having
  become the grab strip at the foot of the sheet. `createSearchField`
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
  x=16.8 to x=−267.2, with `data-lm-open` false and no veil, so there was
  nothing to press to undo it. `inert` answers the *focus* half of this trap and
  cannot answer this half: an explicit `scrollIntoView` is not focus, and an inert
  subtree still scrolls. Two rect reads and one `scrollTop` write reproduce
  `nearest` exactly with no way to reach an ancestor. **Those numbers are from the
  side-drawer era and the sheet turns the trap 90 degrees onto `scrollTop`**;
  re-verified after the move, a pin click that calls `select()` leaves both
  `root.scrollTop` and `root.scrollLeft` at 0.
- **A group's colour travels; a group's id does not.** `groupId` is still kept off
  every snapshot — a visitor cannot see a group or act on one. What is published is
  the colour it *decided*, because that is a fact about the pin rather than about the
  group: `SnapshotShape.color` (already "already resolved", so free) and the new
  optional `SnapshotPlace.color`, written only when a group actually decided.
  **Absent means the pin works its own colour out**, which is what every snapshot
  already on a customer's site says, so a map with no groups publishes the bytes it
  always published. `lib/map/group-colors.ts` is the single statement of the
  precedence, and the canvas, the PNG export and publish all read it.
- **The designer's "Results panel" fold is four folds.** Search and Nearest and the
  glass switch were never panel controls — the embed draws them on a map with the
  list switched off — and they are in "Map controls" now. Transparency, blur and
  corners are a "Panel surface" fold that is `isEmpty` unless the panel floats,
  because a trigger opening onto nothing is worse than no trigger. And the drawer
  switch is **"On a phone"** (`mobile-group.tsx`), because `panelDrawer` is the one
  setting in the whole designer that no width above 768px reads, and it was sitting
  among controls — side, placement, width — that the same width cancels. What is left
  in the original fold is a master switch, three selectors and one run of switches,
  which is the shape the rest of the designer already had.
- **"On a phone" is a shorter truth than the setting's own, taken deliberately.** The embed
  sizes off its *own* box, so a 360px map in a sidebar on a desktop gets the drawer and a
  phone held sideways may not — which is why the panel fold's copy said "narrow, not mobile".
  The fold is named the way an owner would say it and the header's device tiles are how
  either case is checked. It holds one switch and is meant to: **`toolbarGlass` is the one
  that looks like it belongs there and does not**, because the toolbar floats at any width
  once the results panel is off, so a list-less desktop map wears that glass too. The fold is
  `isEmpty={!settings.list}` for the Rows fold's reason — with no list there is nothing for a
  drawer to hold.
- **The toolbar's controls are 36px tall, on the root's own 14px type.** They have been
  four sizes, and the route is a circle worth knowing about. `font: inherit` at 14px with 7px
  of padding made a 36px box; asked for a third off, the row stated `font-size: 12px` on
  `.lm-toolbar` and padded 2px, for 23px; that was reported as too small to read or press, so
  the declaration went and the field padded 5px, for 32px. **That was reported as too small as
  well, which is the whole finding: 32px was never the answer, it was the halfway house
  between the two reports.** So the padding is 7px again and the box is back at its original
  36px — 14px at the inherited 1.45 is a 20.3px line, and 7px either side plus the hairline is
  36px. `font: inherit` on the field is what reads the row's type, and the search dropdown
  inherits it too. **Do not restate `font-size` on `.lm-toolbar`**: twice now the fix has been
  to delete that declaration. A control a finger presses on a phone does not get to be 32px.
- **Three numbers have to move with it or something breaks silently, and there were four.**
  `.lm-button--icon` is a square sized to the field's height (36px);
  `.lm-search__input`'s `padding-right` has to stay at or above the in-field button's width,
  now 36px, so 40px is that with 4px of air; and the MapLibre top-corner clearance is the
  control height plus an 8px gap, **in both places** (`:has(> .lm-toolbar)` and its 480px
  twin): 42 at the first 36px, 31 at 23px, 40 at 32px, 44 now. (42 rather than 44 the first
  time was the hairline counted on one side only; 44 is the honest arithmetic.) Too large is
  a phantom band with nothing in it; too small is the overlap that rule exists to end.
- **The fourth number was `.lm-search__action`'s height and it is gone, because deriving it
  by arithmetic got it wrong twice.** It was the field's 36 less a 2px inset either side, so
  32px — a control *centred in* the field without being *the same height as* it. At rest that
  is invisible; hovered or lit it is a short well with a 2px shelf above and below. Reported
  as "the search input field and the nearest-to-me button are different heights, they are not
  aligned", and then reported a second time, because the first pass measured the two
  centre-lines, found them equal to within 0.05px, and called it fixed. **Centred is not the
  same as the same height, and a centre-line measurement cannot tell the difference.** It is
  `height: 100%` now, against `.lm-search`, which already tracks the field — flush to the
  edge, `border-radius: 0 8px 8px 0` so its outer corners are the field's. Verified: input
  and button both 35.9px, top, bottom and right deltas all exactly 0.
- **The floating field is 266px; the docked one is not a number at all, and neither is the
  narrow one.** `.lm-search__input`'s own `width` is read in exactly one arrangement — the
  toolbar floating over the basemap, which is a map with the results panel switched off at
  any width and a narrow one whose list is a drawer. Docked, `.lm-toolbar--docked
  .lm-search__input` is `width: 100%` against a panel-width column; below 480px of the
  embed's *own* width the container query is `100%` again in a toolbar spanning the map.
  Three complete answers to one question, which is why changing this one moves nothing else.
  It was 190px and was reported too small in precisely the case it governs: with the panel
  off the field is the only thing on the map and it was shrink-wrapped to under a quarter of
  it. **266px is that plus the 40% asked for.** Measured in the publish preview with the list
  off: 266.0 at the Desktop tile (1105px embed) and 266.0 at the Tablet tile (766px, where
  the drawer floats the toolbar, and the zoom stack is 602px clear of it); 368.8 at the Phone
  tile (389px), which is the full-width rule and did not move. With the list back on and the
  toolbar docked, 254.6 in a Slim panel — untouched.
- **MapLibre's control icons are stroked paths in a 29px viewBox, so `background-size` scales
  the stroke too.** The embed skins those controls to match the toolbar — 36px square, 8px
  corner, `--lm-*` tokens — and the glyph is sized by `background-size` alone, there being no
  element inside a `background-image` to size. It shipped at 44px for one revision on the
  reasoning that 18px is what `icon()` writes for *our* controls; but ours are SVG elements
  whose box is 18px, and 44px here gave an 18px glyph on a 4.6px bar filling half the button.
  Reported as "why did you make the zoom icons big and bold". **The number to match is the
  proportion, not the glyph size**: MapLibre draws 12px in a 29px button, 41% of the box, on a
  3px bar, and 34px in our 36px button is 14px at 39% on a 3.5px bar. Rendered and compared in
  the browser against 29px (33%, airier than MapLibre's own default, which is the complaint
  the skin exists to answer) and 44px.
- **A cluster expands with `flyTo`, not `easeTo`, and the reason is the duration.** `easeTo`
  with no `duration` takes MapLibre's flat 500ms however far it travels — fine for what a
  cluster expansion usually is, one or two zoom levels, and unreadable at the one view where
  clusters matter most: from the whole map, a single press crossed about ten zoom levels in
  half a second. Reported as "it flies to the group selector insanely fast, I could almost not
  even see". `flyTo` derives its duration from the distance, so the short hop stays short and
  the long one becomes followable, and it is what a pin click already does through
  `flyToCard` — one vocabulary for "go there" instead of two that differ by how far the target
  happens to be.
- **There is no `.lm-toolbar svg` rule any more, and its absence is load-bearing enough to
  have a comment holding the space.** It shrank `icon()`'s `width`/`height` of 18 —
  presentation attributes, which any rule beats, and which have to stay 18 in `dom.ts` because
  the same helper draws the card's links and folds — down to 16px for a 32px field. At 36px the
  row wants the 18 the helper already writes, so the rule became two declarations restating a
  default. It went out as **part of paying for the resize**: the glyph reading small was half
  of what "the search box is too small" meant. If a toolbar glyph ever needs a size of its own
  again, it needs one class, not a descendant rule on every `svg` in the row.
- **Every size change here reaches live maps**, on the next `/embed` deploy and without the
  owner republishing — the tag-chip trade, taken deliberately each time because it was asked
  for directly, and a setting would be a key in `SnapshotSettings` for something nobody would
  open the panel to change.
- **Each resize has had to be free against the budget, and the 36px pass came in 10 bytes
  under.** The 23px pass got there by stating the type once and folding two `color`
  declarations. The 32px pass was value edits plus one deleted `font-size`, net zero on its
  own — what paid for `rowCard`'s 24 bytes of JS was dead CSS, none of it a feature: the bare
  `.lm-button` rule (every `.lm-button` is also `--icon`, whose `padding: 0` always won), a
  `flex-wrap: nowrap` the docked toolbar restated from the base, `font: inherit` on a
  glyph-only button, and `-webkit-overflow-scrolling: touch`, which no browser that can run the
  embed reads. The 36px pass is seven digit-for-digit value swaps — every number kept its
  character count, which is why it cost nothing — plus the deleted glyph rule, which is where
  the 10 came from. **No budget was raised for any of the four** (§4). What did change, in the
  same commit as the bottom sheet, is *which* number is the gate: the 320KB total ceiling was
  down to 2 bytes and had become a cap on our own code by arithmetic accident, so it was
  re-aimed at MapLibre, which is what its own docblock always said it was for. The 47KB
  own-code budget is untouched and is still the number to argue with.
- **`rowCard: false` is a results row that flies and marks but opens no card.** Absent in a
  snapshot means the card opens, which every published row did (§7); `DEFAULT_EMBED_SETTINGS`
  is `false`, because a card opened from the panel rarely fits the map the panel leaves. The
  embed passes `bare` to `focusPlace`, which calls `popup.remove()` *before* `setOpen` — the
  close event clears the selection, so the other order would clear the row just marked — and
  `flyToCard` then flies plain through the same `!card` branch `card: false` relies on. A pin
  click and find-nearest still open cards. The switch sits in the Results panel fold and is
  offered only while `card` is on.
- **The accent has a default and the other four colours do not.** `DEFAULT_EMBED_ACCENT`
  seeds `DEFAULT_EMBED_SETTINGS.colors`, so `readColors` always resolves an accent and every
  new publish writes one. `--lm-focus` in the stylesheet stays `#1c7ed6`, because that is
  what live snapshots were published against (§7). The four remaining tokens stay absent so
  `.lm-root--dark` can still redefine them.
- **Snapshots are served from R2 at `https://cdn.pinglide.com`, never from Appwrite and never
  from `pub-*.r2.dev`.** Appwrite Storage answers 403 `general_unknown_origin` to every Origin
  not registered as a Web platform, and the embed's `fetch` always sends one — so a snapshot
  on Appwrite loads on the dashboard and on no customer's site. `SNAPSHOT_PUBLIC_URL` picks
  the store (`lib/snapshot/storage.ts`); unset is development only.
- **The CORS header comes from a zone response-header rule, not only from the bucket.** R2
  adds `Access-Control-Allow-Origin` only when the request carries an Origin, so one request
  without one can fill the edge cache with a copy that has none, and every browser then fails
  on that URL until it expires. The rule *sets* (never adds — a doubled ACAO also fails)
  `*` on every response from the host, cached or not. `npm run setup:r2` recreates it along
  with the custom domain, the bucket CORS and the cache rule; a clean run prints only `ok`.
- **Cache policy lives on the object, and the zone rule respects it.** `live.json` is
  `max-age=60` — its URL never changes, so that is how long a republish takes to reach a
  visitor; archives are a year and `immutable`. Without the cache rule Cloudflare does not
  cache `.json` at all and every visitor's fetch is a paid R2 read (§2). R2 answers with
  `Vary: Origin` and the edge honours it, so each customer domain warms its own copy —
  measured: a new Origin is a MISS, the same Origin again a HIT. At most one R2 read per
  domain per minute per edge location, which is nothing.
- **Test an embed change from a foreign origin, never only through the preview.** The
  preview's `srcdoc` frame inherits the dashboard's origin and so passes every CORS check a
  customer's page would fail; that is how the Appwrite 403 went unnoticed for a whole phase.

## Notes

**Published snapshots moved to R2 on 2026-09-19, because on Appwrite they worked nowhere
but the dashboard.** Measured with curl against a real live file: no Origin → 200;
`Origin: http://localhost:3000` → 200; `Origin: https://some-customer-shop.com` → 403
`general_unknown_origin`, "Register your new client … as a new Web platform". Registering
each customer's domain is not a fix — it is manual per customer and keeps Appwrite in the
visitor's path, which §2 forbids anyway. The same 200 also carried
`cache-control: private, max-age=3888000`, 45 days on a URL that never changes across
republishes. Photos and logos still load from Appwrite, as plain `<img>` (no CORS, so they
answer 200 with a foreign Referer); moving them is the next piece and reuses
`lib/r2/client.ts`.

The layout is `{mapId}/live.json` plus `{mapId}/{generatedAt}.json` archives, five kept. R2
overwrites atomically, so the delete-then-create window the Appwrite store has — and that
the embed's single retry was written for — does not exist here; the retry stays because it
costs nothing and still covers a dropped connection. Maps published before the move were
copied byte for byte by `npm run migrate:snapshots-to-r2`, which reads each map back through
the public URL with a foreign Origin before repointing `snapshotUrl`. It is not a republish:
unpublished edits stay unpublished.

The app holds an R2 token scoped to Object Read & Write on the one bucket. The account-wide
`CLOUDFLARE_API_TOKEN` that `setup:r2` needs never goes onto the site.

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

**"Open test page" is the third thing in that dialog, and it exists because
everything after Publish used to be a `<script>` tag.** Reported as "we only have
a script tag and that's it, we can't test how it will actually look". True: the
designer's preview builds a snapshot *in the browser*, renders it in a `srcdoc`
frame on the dashboard's own origin, and passes no collector URL
(`lib/snapshot/preview.ts`) — so it can prove a colour and can never prove a
publish. The only page that could was `/embed/live.html`, which had been in the
tree the whole time with nothing pointing at it and the snapshot URL pasted by
hand.

`TestPageLink` is a `LinkButton`, not a `Button` with `window.open`, because it is
a navigation: middle-click and copy-link-address have to work on a URL somebody
will send to a colleague. It takes the sidebar's draft `settings.analytics` for
**the wording of its warning and nothing else** — see the next paragraph for why
that distinction is the whole point.

**The test page reads measurement off the snapshot it fetched, and it is the only
thing in the product that reads the published answer rather than the draft.** The
switch saves immediately; the endpoint is baked in at publish time and a live
snapshot is immutable. So the states diverge, and the dashboard resolves that
divergence the wrong way round: the Analytics tab's `isMeasuring`
(`app/(dashboard)/maps/[id]/analytics/page.tsx`) reads `settings` **as stored, not
as last published**, so it reports "on" while the live file carries no endpoint and
nothing is being recorded. A visitor's beacon is answered `204` whether it was
stored or dropped, deliberately — so from outside there is no signal at all, and
somebody in that state goes looking for a bug that does not exist. `live.html`
fetches the snapshot itself and says which of the two it is. The duplicate fetch is
paid for: R2 serves `live.json` with `max-age=60`, so one of the two is a cache
hit, and the page is outside the embed's 48KB budget.

**An owner arriving from that button must not land on developer prose.** The page
had its explanation, its paste form and its Network-tab checklist all visible at
once, which was right while it was only ever opened by hand. Everything
explanatory now sits in one `#docs` div hidden the moment a map loads; what stays
is the map, the verdict, and the warning that this writes real rows against the
map's monthly ceiling — a consequence, not an explanation, so it survives.

**Everything the designer writes is optional on `SnapshotSettings`, and absent
means what the embed did before that field existed.** That is §7, and the
asymmetry it forces is the thing to understand before adding a setting:
`DEFAULT_EMBED_SETTINGS` in `lib/validation/embed-settings.schema.ts` is what a
map *publishes* and carries the current design (panel right, floating, pins in
the rows, controls bottom-left); the **embed** reads a missing key as the old
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
