# Cards and the card designer — design notes

Moved out of CLAUDE.md on 2026-09-05 so that file stays cheap to load. Nothing here is
rewritten; it is the record of why this area is shaped as it is.

This is the largest area in the project and the one with two renderers that must agree:
`components/card/**` (HeroUI, dashboard) and `embed/src/popup.ts` (hand-built DOM), both
building the same card from the same functions in `packages/shared/`.

## Invariants

### The two renderers

- **The twin renderers must agree.** A bug here does not look like a bug — it looks like a
  card drawn correctly for the wrong location. `embed/src/popup.test.ts` is what stands
  between them and a silent regression.
- **Every `--lm-card-*` fallback must equal its `--card-*` twin.** The two stylesheets are
  kept in step by hand; three sizes and one chip colour had already drifted.
- Shared resolvers exist so neither renderer can guess: `chipStyleOf`, `buttonTargetOf`,
  `logoImageOf`, `logoRadiusOf`, `blockBox`, `emptyBlockHeight`, `overrideBlock`.
- `lib/card/designer-status.ts` is the one seam every reader goes through.
  `effectiveCardLayout` is what `buildSnapshot` reads, and a layout equal to
  `defaultCardLayout()` is **omitted from the snapshot entirely**.

### Absent means the old behaviour

- Every optional field on `CardLayout` / `CardBlock` means, when absent, exactly what the
  card did before that field existed. `optional()` in `resolveCardLayout` **drops a value
  equal to what absent already means**, so trying a setting and going back publishes the
  bytes it always did.
- **Retired, not deleted**: the `category` block and `details` ("More details") stay in
  `CardBlockType` and `CARD_BLOCKS` marked `retired: true` so `availableBlocks` stops
  offering them, and both builders and components stay. A block that stopped being a block
  would silently drop a row out of somebody's saved design.
- Coming off `defaultCardLayout()` changes what a *fresh* card is, never what a saved one
  becomes. **Quietly editing a design somebody made is the one thing these functions must
  never do** — including opening a panel, which is why `nearestStop` lights the closest
  tile **without writing it back**.
- The Links row's flags are spelled as the hidden state (`hidePhone`, `hideEmail`,
  `hideWebsite`, `hideDirections`) — `true` or absent, never `false`.

### Layout and blocks

- **A card block is `flex: none`, except the week.** A flex item's default `flex-shrink: 1`
  let a block be compressed below its own content, and with `overflow: hidden` that cuts
  text mid-word while the zone doesn't think it has anything to scroll. `hours` is
  `0 1 auto` with `minHeight: 0` **because it scrolls inside itself** — its summary row is
  `flex: none` and only the seven days give way. Nothing else may take that exemption
  without a scroller of its own.
- **The room check is asked in terms of what a line *asked for*, never its rect.** That
  exemption above is exactly why: the one shrinkable block absorbs a whole over-full
  design, so the rects in a zone always sum to precisely the card's height and
  `roomForNew` pins to 0 forever. `wants` on `ZoneBlockMeasure` is the unshrunk number,
  `zoneHeights` is the only way to build the map `canDrop` reads, and the *drawing* still
  uses the rects — a mark has to be painted where the block actually is. See the
  post-mortem below.
- **Only the bottom zone pins.** The middle zone's `flex-1` is the whole of it. A block at
  the bottom *of the middle zone* is held there by its own `offset`, which is space above
  it — so it lands flush only for a location whose content is as tall as the sample's.
  An empty end zone measures zero, which is why `lendToEndZones` borrows a block's worth of
  room from the middle so there is something to drop onto, and why `BlockProperties` offers
  a Position control.
- Vertical padding belongs to **the zones that actually drew**, not the ones named top and
  bottom — `CardView` works out which will draw first, then hands `padTop`/`padBottom` to
  the first and last of those.
- `.map-card` has a floor as well as a cap: `min(8.75rem, …)`, because `min-height` beats
  `max-height` and a bare floor would push the card out of the frame `useMapAnchor` just
  measured. `.lm-popup--place` carries the same number.
- `emptyBlockHeight` is the reservation an empty block holds, read off the block's own
  settings. **Its numbers were measured in the browser, not derived.** The floor lands on
  the block's **content** element in every renderer, never on its box.
- `removeCardBlock` takes a `VacatedSpace`, so a delete refunds what the arrival was
  charged and the card survives a round trip. `CardCanvas` reports `geometry.vacate`
  upward; `CardDesigner` holds it in a **ref**, not state.
- **The card is exactly as wide as the popup holding it.** `maxWidth` on a MapLibre popup
  caps `.maplibregl-popup`, which is a flex row of the tip *and* the content — so a cap
  costs the card the tip's 9.6px and it overflows an `overflow: hidden` parent. It is
  `maxWidth: "none"`; a cap, if ever wanted again, must be the card's width plus the tip's.
- **A card never opens under the results panel.** `embed/src/card-place.ts` holds
  `usableFrame`, `cardBands` and `chooseBand`, and decides **from rectangles, never from
  `data-lm-side`** — which is what makes one rule serve docked, stacked and floating, and
  an RTL host page need no second case.
- `flyToCard` still offsets against the **container's** centre, not the usable rect's —
  MapLibre defines `flyTo`'s offset that way. `card-place.ts` is its own module because
  `map.ts` imports maplibre-gl at module scope and is unreachable from a unit test.

### The designer on a touchscreen

- **A block's `style` prop must merge `rowProps.style`, not replace it.**
  `designer-block.tsx` spread `rowProps` and then set `style={blockStyle(...)}` a few lines
  later, and React replaces `style` wholesale rather than merging — so the `touch-action:
  pan-y` the drag depends on was thrown away and **every placed block on the canvas computed
  `auto`**. A finger on a block was handed to the scroller instead of to the gesture, and
  nothing said so: the block simply did not move. It is
  `style={{ ...rowProps.style, ...style }}` now, and the order is the point — the block's own
  box must still win over the gesture's.
- **A resize handle appears on hover *or* on selection, never on hover alone.** Both
  `BlockResizeHandle` and `BlockCornerHandle` were `opacity-0 pointer-events-none` until
  `group-hover/block` or `group-focus-within/block`, and neither state exists on a
  touchscreen — so block height and logo size were unreachable on a phone for the whole life
  of the page. They now also open on `group-data-selected/block`, which `DesignerBlock`
  already published as `data-selected`, and which on touch is one tap away.
  **`pointer-events` and `opacity` move together in every one of those class lists** — an
  invisible handle that still takes presses intercepts ~12px of the block and silently starts
  a resize where the user meant to pick it up.
- **These two are the only handles on a block, and *move* is not one of them.** A block is
  picked up by pressing anywhere on it, which is `useRowDragSource`'s gesture for every row
  in the app — a 250ms hold on touch, 8px with a mouse. A grip was drawn here briefly and
  removed; `docs/notes/editor-and-layout.md` has the bug it was answering and the
  non-passive `touchmove` that answers it properly. Resize keeps its handles because there
  is no whole-surface gesture for it to be: the surface already means move.
- The palette has no grip glyph either, and it had one twice — first as decoration, then as
  a real drag source. The whole row has always been what you pick up. The row's duplicated
  `touch-pan-y` class went with it, since `rowProps.style` already states that rule.

### The Button block

- **It stores a *source*, never a URL — except per pin.** The design is saved per
  *account* and drawn for every location on every map, so a URL on the block would send
  three thousand pins to one page. `buttonSource` names a place to look; `buttonTargetOf`
  resolves it per location. `null` is the common case, not an error path.
- **`buttonHref` is the exception, and it is gated on being a per-pin override.** An
  override is a whole resolved block against one place, so a URL there is about exactly
  one card. `ButtonProperties` offers the option only when `isOwnCard` — the same flag
  the Logo panel reads — and `buttonTargetOf` prefers it over `buttonSource`, returning
  `null` rather than falling back when it will not parse. The box never shows `https://`
  (`lib/card/button-link.ts` strips it for display and adds it back on the way in) and
  **must not trim what it stores**, for the reason `buttonLabel` documents at length.
- Field ids are per *map*: a button bound to one finds nothing on a map without it.
- `buttonAction` is spelled `"link"`, so **absent is Directions** — a Button has to work
  before anybody configures it, and every location has coordinates.
- `directionsUrl` lives in `packages/shared/directions.ts` because three renderers draw it.
- The button is `inline-flex` **precisely so the block's own `text-align` moves it**. Make
  it a flex child and `buttonStyleOf` needs a `justify` too — the bug `chipStyleOf` was
  given one to fix. `align` reaches a block as `text-align`, which cannot move a flex item.
- `CardButton` wears `card-button card-text` **and nothing else** — a hardcoded Tailwind
  utility on the leaf beats the block's `--card-*` properties and breaks Font/Size/Colour/
  Bold silently.
- **A button's outline is a width, and the colour is optional on it** — unlike a chip's
  indivisible pair — because a button has `currentColor` under its edge. Both stylesheets
  fall back to `currentColor`; the control writes only a width and never seeds a colour.
- A new Button arrives full width (`defaultButtonFull`, read only by `makeCardBlock`).
- A Label may contain spaces: `resizeCardBlock` must **not** normalise `buttonLabel`
  mid-typing. `readBlock` still collapses and trims on the way in.

### The properties panel

- **Nothing is a slider.** A slider cannot say *zero* — a thumb at the far left reads as
  "not set". Numbers are `PropertyScale` over `PropertyChoice`, stops in
  `property-scales.tsx`, sitting **on** the defaults so an untouched card lights the tile
  it is drawing.
- Which control a question gets is decided by **width**. A tile that *draws* what it is
  choosing costs no label width; a tile carrying a *word* gets ~36px and clips, so every
  `room()` scale is a `PropertyNumberSelect`.
- The Modify tab folds (`PropertyFold`; `PropertyGroup` is deleted). **Every fold in the
  app starts shut and only one opens at a time** — `PropertyFolds` is the set, and the
  three panels that each opened something (`["panel"]`, `["size"]`, every shelf) no longer
  do. `key={block.id}` on it stops a new block inheriting the last one's open fold.
- `SIGNATURE_GROUP` is **deleted**, with the `firstOpen` search beside it. Both existed to
  decide what opens, and nothing opens.
- A group with every control hidden renders nothing at all, heading included (`isEmpty`).
- Booleans: one question on one line. Several answers → `PropertyToggles`; a single yes/no
  → `PropertyCheckbox`, and it sits at the **end** of its fold. A toggle that is on when
  its field is *absent* lies about what it stores (why `hoursOpen` is "Whole week").
- `PropertyCheckbox` is a label **above** its box and `PropertyChecks` stacks them one per
  line — in both panels, since a control that looks different depending on which opened it
  is two controls.
- `EVERY_BLOCK_IS_SHELVED` in `block-labels.ts` fails at compile time. A new
  `CardBlockType` nobody shelved is a block offered nowhere, with no runtime symptom.
- The palette does **not** scroll while a block is in the air, via an **inline**
  `overflow-y: hidden` (it must beat both HeroUI's scroll-shadow class and the element's
  own `lg:overflow-y-auto`). `hidden`, not `clip` — `clip` drops `scrollTop` to 0.
- **The Blocks palette is not a fold and must keep fitting.** All eleven blocks are
  drawn at once, two-up, under static headings — measured at 315.5px of content in a
  456px scroller. A tile that grows past one line, or a fifth shelf, has to be measured
  against the column again. An empty shelf still renders nothing at all, heading
  included; that is what lets it shrink as the card fills.

### Glass, theme and chrome

- Transparency is a `background-color` with alpha through `color-mix`, **never the
  `opacity` property**, which would fade the card's text with its ground.
- **Absent blur is `none`, not `blur(0)`** — a backdrop filter of zero still makes the
  element a backdrop root, and the card is moved by transform at 60fps.
- MapLibre paints `.maplibregl-popup-tip` from its own stylesheet, so the tip runs the same
  mix at MapLibre's own specificity, later in the same injected sheet. No blur on the tip.
- The dashboard's card carries **its own colour context** (`lib/card/card-theme.ts`,
  resolved from the *basemap*), on the card element itself in `card-canvas.tsx` and
  `place-card.tsx` — **not** on the wrappers carrying `cardAccentVars`, which are the whole
  editor row and designer column.
- **Auto asks `usePrefersDark()`, never `matchMedia` — and never at render.** The answer is
  an argument, the same shape `shouldDarkenStyle` takes, because the OS preference and the
  dashboard's theme are different questions and a `typeof window` branch in a render is a
  hydration mismatch.
- **A drag ghost is re-parented to `<body>`, so it must be handed its inherited custom
  properties and the card's theme class** (`inheritContext` in `row-drag-ghost.ts`).
  Without them a cloned block silently draws in `--card-accent`'s `#1c7ed6` fallback.
- `.transparency-grid` is a checkerboard shown only while the card is see-through; the
  studio's flat `bg-default/40` workspace cannot otherwise tell glass from solid.

### Slots (editor only)

- A slot **replaces** the block's content, so filling one in moves nothing else. An overlay
  (`renderOverlay`, `.card-edit-target` at `inset: 0`) **displaces nothing** — turning edit
  mode on must move nothing, or the design being edited is not the one on screen.
- `cardSlotOf` is **not** `hasBlockContent`: one names a field, the other answers a boolean,
  and they disagree about an empty gallery on purpose.
- Slots are editor-only, arriving as an optional `cardSlots` prop group — the import review,
  the preview panel and the embed pass nothing (§2, §4).
- The popover is portalled, so it closes on the map's `movestart`; Escape is guarded so one
  press does not close the popover and the card under it. `.card-slot`'s open state is our
  own `data-open` — HeroUI leaves `aria-expanded` false.
- `.card-slot` wears `--card-radius` / `--card-slot-radius`, not the app's `--radius-md`.

### Edit mode (editor only)

- **The whole block is the press target, and everything under it is `inert`.** One gesture
  per block, because there is one thing on it to press. Remove the `inert` and the target
  becomes a transparent sheet over live links.
- The `inert` wrapper is `display: contents`, so the card lays out identically in and out of
  edit mode — a real box there would break the gallery image's `height: 100%` chain.
- The target must render **outside** that wrapper. Inside it, it is inert too.
- **Filling content in is not an edit-mode gesture.** The `+` slots are pressable on the
  card as it normally stands; edit mode changes how a block is *drawn*. The two used to
  share a block and could not both have its box.
- **The mode moves, the pointer stops it.** Every block breathes
  (`.card-block-editable`, `card-block-breathe`, 1.2% at 2.4s) for as long as edit mode is
  on; the block under the pointer drops the animation and outlines itself in dashed accent.
  Both halves are needed — the card is otherwise identical in and out of the mode, and an
  affordance that only appears under the pointer is one you have to already be on to see.
- Empty and filled blocks draw the **same** thing. This used to split on `isEmpty`, which is
  why `renderOverlay` used to be handed one; it is not any more.
- The scale is on the **block's box**, never its content: the box is `overflow: hidden`, so a
  transform on the content grows straight into that clip.
- Hover sets `animation: none` **and** keeps `transition: transform` on the base rule, so a
  block interrupted mid-swell settles instead of snapping — removing an animation lets a
  transition run from the value it was showing.
- `prefers-reduced-motion` needs its own rule here, and it is the state that needs one most:
  with nothing breathing there is no sign the card's blocks became buttons at all. Every
  target wears a faint dashed rectangle at rest instead, and hover takes one to full accent
  — verified by rewriting the media rule's condition to `all` in the live CSSOM.
- The middle zone is `overflow-x: hidden` **because of the swell** — `overflow-y: auto` alone
  computes the other axis to `auto`, and a bled block growing put three measured pixels of
  horizontal scroll into the card. On the y axis the swell leaves 0.8px of scroll range at
  the top of each cycle, measured; `data-bottom-scroll` never flips, so it is left alone.
- An element that never stops moving is not "stable" to browser automation: DevTools' own
  `hover` refuses a breathing block until its animation is paused. Worth knowing before
  writing an E2E test against edit mode.

### Logo

- `places.logoId` is a storage **file id**, not a data URI — three thousand inline logos
  would hand every visitor megabytes of base64 (§2). `SnapshotPlace.logoUrl` is written
  only when there is one.
- Three modes must be three behaviours: absent = **Pin** (every card published before this),
  `"mixed"` = this location's logo else the pin (what a fresh block arrives as),
  `"image"` = the logo always, empty block if there is none. **`"image"` must not fall back
  to the pin** or Mixed is a second word for something that already exists.
- Both renderers had to learn this together — the first attempt was real twin drift.
- **The two renderers' untagged fallback now agrees by default rather than by design, and
  that is not the same as agreeing.** The embed reads `--lm-pin`, which `applyChrome`
  writes from `settings.pinColor`; the dashboard's `PinPreview` reads `var(--accent)`
  (`app/globals.css`). `DEFAULT_EMBED_SETTINGS.pinColor` is that same accent, so an
  undesigned map draws the same colour on both sides — but an owner who changes **Default
  pin** in the Colours fold moves only the published half, and the card designer keeps
  previewing the orange. Left alone deliberately: the designer is an account-level tool
  with no map in scope, so it has no per-map colour to read. If a Logo block ever needs the
  real one, the seam is `PinPreview`'s `fallbackColor`, not a new token.

### Per-pin overrides

- **An entry is a whole resolved block, not a diff.** Absent is meaningful all over
  `CardBlock`, so a diff would need an "and unset these" list travelling beside it. A
  resolved block reduces the merge to `overrides[block.id] ?? block` (`overrideBlock`),
  which is the only reason this fits in the embed at all.
- **`overrideBlock` must run before `cardRows`** — a width or overlap decides how blocks
  pair into lines. Both renderers do it on the pairing's own input.
- An id the design no longer has never matches, and a **type mismatch is ignored**, so a
  block id minted again after a delete cannot inherit the old one's settings. Dangling ids
  are the normal state; `publishedCardBlocks` narrows them at publish.
- A patch is never assembled by hand: `resizeCardBlock(effective, id, patch)` then
  `findBlock` back out, so the menu inherits every clamp and every *deletion* of a field
  returning to its default.
- **The panel is not inside the block it edits.** `PlaceCard` owns it and it is anchored to
  the **card** by an explicit `triggerRef` — inside the block it chased the block
  (React Aria's `ResizeObserver`) and unmounted whenever `cardRows` reparented it at the
  100%-width boundary. It is deliberately **not keyed on the block**.
- It is a **standalone `Popover.Content`** with no `Popover.Root`; HeroUI's slot classes are
  passed explicitly from `popoverVariants()`.
- **Picture and record are two channels.** `PlaceCard` holds a `preview`, keyed on the place
  id, feeding `blockOverrides` with no network; `useDeferredOverrides` writes one PATCH on a
  400ms trailing timer, flushed by Done and by unmount. **The base a patch applies to is the
  preview, never `place.cardBlocks`** — that half is what stops a stale reply being saved.
  `mutateAsync` is deliberate: every exit unmounts the observer, so `mutate`'s own callbacks
  would never fire.
- `useUpdatePlace` carries a `scope` of `places:<mapId>`, serialising every place PATCH for
  one map. That is a behaviour change for every caller, the pin drag included.

### Directions and the visitor's origin

- **The link is never intercepted.** The browser opens it exactly as it would with no script
  on the page; the lookup runs behind it. The first press goes out with whatever was known.
- **An answer reaches links that are already drawn.** `refreshDirections` rewrites the
  `href` of every `a[data-lm-dir]` under the root, and `remember` calls it whenever the
  session's answer actually changes. Reading `me` at draw time is *not* enough: the results
  panel is drawn once, synchronously, before any of the four writers can have answered.
- **The ask is raised on `pointerdown`, and it latches on a refusal, not on an attempt.**
  A press asks over a 30s window (`PROMPT_WINDOW_MS`), not `bestPosition`'s 3s — the 3s
  timer fires in the backgrounded tab and its `clearWatch` **withdraws the prompt**. Only
  `denied` and `unsupported` stop us asking again.
- **A coarse origin beats no origin.** There is no accuracy gate — with the origin omitted
  Google falls back to the IP address, which measured as *another town*. The only thing we
  decline to send is nothing at all.
- `me` keeps the **sharpest recent** reading, not the latest and not merely the sharpest
  (`remember`, over `betterFix`). **Fresh beats sharp**; among comparable ages, sharper wins.
  Ties go to the newcomer. `toFix` stores the browser's own timestamp, never `Date.now()` —
  a cached reading carries the time it was *taken*, and that gap is the entire signal.
- `bestPosition` exists because `getCurrentPosition` resolves on the **first** reading that
  satisfies the options — on a phone that is the network fix. It watches for three seconds,
  reports **every** reading through `onReading`, ends immediately on a refusal, and treats
  any other error as one failed reading.
- `GeolocateControl` runs at `enableHighAccuracy: true`: the circle the visitor sees must be
  what a route starts from.

## Notes

**The card designer is on, and `lib/card/designer-status.ts` is the one seam
every reader goes through.** It was switched off behind a `CARD_DESIGNER_ENABLED`
flag in that file while it was unfinished, on the argument that what it stores is
read by the editor's popup, the preview panel and every published snapshot — an
unfinished tool here is not a page nobody has opened, it is what a visitor to a
customer's site sees. The flag is gone; the seam stays, because there is still
one place to change what "the card for this account" means.
`effectiveCardLayout` is what `buildSnapshot` reads, and a layout equal to
`defaultCardLayout()` is omitted from the snapshot entirely, so the embed falls
back to its own copy and the two agree by construction with nothing added to a
published map.

That promoted the default from "what you get before you design anything" to "the
card", so it grew into the job: `description` and `hours` came out of the fold
onto the card itself, which left the fold holding nothing and is why it was
later retired outright (below). The bytes in `card-layout.test.ts` moved with it,
deliberately — that string is
not sacred, what is sacred is that this file and `embed/src/popup.ts` build the
same card from the same function. The blocks are HeroUI now (`Chip`,
`Disclosure`, `ScrollShadow`, and contact rows wearing `buttonVariants` on an
anchor, since a HeroUI `Button` is a real `<button>`); the embed keeps its
hand-built DOM and cannot have any of it (§4).

**A card's vertical padding belongs to the zones that drew, and it used to belong
to the ones named top and bottom.** An empty zone is not rendered at all — its
padding would be a band of nothing at an end of the card — but the card's `pt`
and `pb` lived on the top and bottom zones, so a location with no photo and no
contact details lost both and with them every pixel of vertical padding it had:
name flush against the top edge, Edit button flush against the bottom, in a card
seventy pixels tall. `CardView` now works out which zones will draw before any of
them does and hands `padTop`/`padBottom` to the first and last of *those*; the
embed does the same with two classes in `buildPopup`. With all three zones present
they land where they always did, which is why no populated card moved. The bleed
rules are safe by construction: zones run top → middle → bottom, so a rendered top
zone is always the first.

Padding alone still left a card the height of its one line, so `.map-card` has a
floor as well as a cap — `min(8.75rem, …)`, because `min-height` beats
`max-height` and a bare floor would push the card out of the frame `useMapAnchor`
just measured. `.lm-popup--place` carries the same number, and the modifier exists
because a shape's popup is a name and a sentence and is meant to be smaller. And a
location with nothing but a name says so, in an editor-only line passed to
`CardView` as `renderEmptyState` — the embed passes none, because "add an address"
is not a sentence a visitor can act on.

**A card block is `flex: none`, and that was a real bug.** A zone is a flex column
with a bounded height, and a flex item's default `flex-shrink: 1` let a block be
compressed below its own content — which for a block with `overflow: hidden`
means the text is cut off mid-word rather than the zone scrolling. A card with a
paragraph and a week of opening hours lost the end of both, and the middle zone's
`scrollHeight` matched its `clientHeight`, so it did not even think it had
anything to scroll. `blockBox` in `packages/shared/card-layout.ts` now gives every
full-width block `flex: none`, not just a block with a height. Found in the
browser with a long description, which is the only way it was ever going to be
found.

**The week is the one block that gives way, and it earned the exemption by
scrolling.** An open Hours block is a summary row plus seven days — 154px, the
number `emptyBlockHeight` already measured — and it is the only block routinely
taller than the card it is on. Take the card's height down a stop or two with a
week in the middle and everything under it left the zone's visible area, with the
bar hidden (`hideScrollBar`) and nothing saying so; put those blocks in the bottom
zone, which cannot shrink, and they were clipped off the card outright. The rule
above is right for a block that would *clip* when squeezed and wrong for one that
can scroll, so `blockBox` answers `flex: 0 1 auto` with `minHeight: 0` for
`hours` alone, and both stylesheets bound the list rather than the block:
`.card-hours` in app/globals.css, `.lm-popup__hours` in embed/src/styles.css. The
summary row is `flex: none` in both — "Open now" and today's times are the line a
visitor came for, so the six other days are what gives way. Shrink order in a
squeezed zone is therefore the lead (shrink 1000), then the week (shrink 1), then
the zone scrolls.

Three things about it are load-bearing. **The bound is a chain of definite
heights**, which is why the canvas needed a change the other two renderers did
not: in `CardView` and the embed the block's own box *is* the zone's flex item, but
`card-canvas.tsx` wraps it in a `motion.div` for the reorder animation, so `flex`
and `minHeight` had to move onto that wrapper in `splitOuterBox` and the block
below it gets `height: 100%`. Left where they were, the studio drew an open week
pushing blocks off the card while the editor's card and the embed both handled it
— two surfaces out of three, which is the drift the shared `blockBox` exists to
prevent. **The old refusals stand**: `useCardFits` rewrote the layout to fit and
walked blocks up the card permanently, and freezing the disclosure on the canvas
made a control that visibly did nothing. This writes nothing back to the design at
all. And **it moves cards already live** on the next `/embed` deploy, which is the
same exception taken for the `--lm-card-*` pixel fixes: a card whose week used to
push content into the scroll now shrinks the week instead. Verified in the browser
at 300px (block 40px, summary visible, week scrolling 138px inside 16px, blocks
below flush at the card's edge) and at 720px (block 162px, week 138px, not
scrolling — nothing with room on it moves).

**And that exemption then made the card refuse every drop, which is the bug it
took a reported “there is space right there” to find.** A zone is a flex column
and the week is the one thing in it that may shrink below its own content, so on
a design that needs more height than the card has, the week quietly absorbs *the
whole surplus* — and every rect in the zone then adds up to precisely the card's
height. Nothing overflows. Nothing looks wrong. But `dropSlots` built the map
behind `hasRoomFor` out of exactly those rects, so `contentHeight` came back equal
to `maxHeight` whatever the design actually weighed, `roomForNew` pinned to 0, and
`canDrop` refused all three zones for good. The only thing on screen was the
shrunken week, drawn as a large empty band in the middle of the card — which is
where every palette chip was being aimed, and what the owner reasonably read as
free space. The more over-full the card, the more certain the refusal: the same
backwards answer `roomForNew` already documents for leading space, arrived at by a
different route. Measured on the reported card — 220×300, week wanting 162px and
drawn at 125.2 — the design needed 336.8px and the check reported 300 of 300.

`wants` on `ZoneBlockMeasure` is the missing number, and `wantedHeight` in
`use-drop-bands.ts` is how it is read: `blockContentStyle` stretches a block's
content to `height: 100%`, but a block holding a reservation *floors* it as well
(`.card-block--empty`, from `--card-empty-h`), and a floor beats a percentage —
so the content element keeps its full height and is merely clipped by the
`overflow: hidden` box above it. Its rect plus the block's own padding is what the
block asked for. For every block nothing squeezed that is the rect it was given,
which is why every existing fixture and test was unaffected to the pixel. Two
things are deliberate. **Only the room check moved to it** — `zoneHeights` feeds
`canDrop` and nothing else; the bands, marks and regions are still cut from the
rects, because a mark has to be painted where the block actually is. And **the
blind spot is written down rather than papered over**: a squeezed block whose
content is real rather than reserved has no floor under it, so it reports the
squeeze too and `wants` comes back level with the rect. That is precisely what the
check did for every block before this existed, so it is never worse than the old
answer.

**The refusal now says why, because over-full is the one state that is invisible.**
Full is visible — the blocks reach the bottom edge and the owner can see it.
Over-full is not, for the reason above. So `CardDropOverlay` carries `over` from
`overHeight`, read from the same `zoneHeights` map the refusal was decided from
(the explanation and the decision cannot be allowed to disagree), and says “This
card is 37px over its height. Make it taller, or remove a block.” in place of the
bare “No room for this on the card.”, which is still what a merely full card
gets. Letting the drop through instead was considered and rejected: `hasRoomFor`
exists so a card cannot be *designed* to overflow on somebody else's website, and
the block that would have paid for it is the scroller that exists for content
nobody can measure at design time. Verified in the browser on the reported card at
both widths and on both gestures — mouse and the 250ms touch hold — and the same
card at 720px still offers 18 targets and four regions.

**Only the bottom zone pins, and until now it was the one place a block could not
be put.** The middle zone's `flex-1` is the entire "push to the bottom" mechanism
on a card: it grows to fill whatever the ends leave and packs its own blocks from
the top. So a block at the bottom *of the middle zone* is held there by its stored
`offset`, which is empty space **above** it and not a promise about the card's
edge — and the same saved design therefore drew a Button flush on a location with
a long description and 37px short on one with none. Measured on a real map:
252 → 299 on one pin against 215 → 262 on the next, in a 300px card.

The reason nobody simply used the bottom zone is that an empty one is
content-sized and therefore **zero pixels tall** (`CardZoneBox`'s `hasBlocks`).
`dropSlots` emitted a zero-span run for it, `dropRegions` skips any band with no
height so nothing was drawn, and `dropBands` left it a `MIN_BAND` sliver at the
very edge of the card. Meanwhile the middle zone had swallowed every leftover
pixel, so the empty space a person sees in the lower half of a card *is the middle
zone*, and every "put this at the bottom" gesture landed there.

`lendToEndZones` in `use-drop-bands.ts` is the fix: an empty top or bottom zone
borrows a block's worth of room from the middle, both halves written so the two
cannot claim the same pixels and draw two marks on one strip. It is a loan against
the *measurement*, not a change to the layout — and it has to discount the block
in the hand, because a block dragged off the bottom of the middle zone otherwise
reports that zone full and the gesture that most needs the bottom band is the one
that cannot reach it. It lends nothing when there is less than `MIN_BAND` going
spare, which is a card already full to its bottom edge: there is no empty strip to
point at, and a target drawn over a block is worse than none.

`BlockProperties` gained a **Position** control beside it — three tiles narrowed to
`spec.zones`, writing through `dropCardBlock` so it inherits `acceptsBlock` and
every clamp behind it. It is the one-press way for a block already on the card,
and the place somebody looks when a drag did not do what they meant. **Optional,
and its absence hides it**, on `chipPreview`'s rule: the per-pin card menu stores a
whole resolved block against an id, so it can change what a block *is* and nothing
about where the design puts it.

**A card can carry a Button, and it stores a *source* rather than a URL.** The
one thing the designer could not draw was a call to action: a custom field with
`showAs: "button"` lands as a small text link inside the Links row and cannot be
styled at all. The `button` block is that, modelled on Atlist's — `zones:
["middle", "bottom"]` on the Links row's argument that a card putting its call to
action above the name has buried the answer, and the second block after the
divider that is not `unique`, because Directions and "Book now" are two buttons
rather than one with two jobs. **The card design is saved per *account* and drawn
for every location on every map, so a URL kept on the block would send three
thousand pins to one page.** `buttonSource` therefore names a place to *look* —
absent is the location's own `url`, a value is a custom field id — and
`buttonTargetOf` in `packages/shared/card-button.ts` resolves it per location.
`null` there is the common case worth designing for, not an error path: one
layout has to be right for three thousand locations filled in differently, so a
button to a booking page is a button only on the locations that have one and
draws nothing at all everywhere else. The documented consequence is that field
ids are per *map*: a button bound to one finds nothing on a map without it, which
is the same thing it does for a location that left it blank.

`buttonAction` is spelled as `"link"`, so **absent is Directions** — a Button
dragged onto the card has to work before anybody configures it, and every
location has coordinates while not every one has a URL. That is also what made
`directionsUrl` move out of `embed/src/popup.ts` into
`packages/shared/directions.ts`: three renderers draw that link now and two
copies of "which maps app does this visitor have" is one bug away from a card
that routes correctly in the studio and not on the customer's site. A move, not a
copy, so the embed's byte count did not change. §12 bans the Google Maps *SDK*
and its terms; an outbound link is what §11 names as the answer.

Two traps the block walks straight into, both already documented elsewhere in
this file and both live here. **`align` reaches a block as `text-align`, which
cannot move a flex item** — the bug `chipStyleOf` was given a `justify` to fix.
The button is `inline-flex` precisely so the block's own `text-align` moves it;
make it a flex child and `buttonStyleOf` needs a `justify` too. And **a hardcoded
Tailwind utility on the leaf beats the block's `--card-*` properties**, which is
why `CardButton` wears `card-button card-text` and nothing else: its Font, Size,
Colour and Bold controls would otherwise look broken in exactly the silent way
`ContactRow`'s did. Everything else is `--card-button-*` custom properties set
inline, so a button nobody has styled writes nothing and the stylesheet's own
fallbacks stay in charge — which is what keeps an unstyled one theme-aware where
a stored `#ffffff` could not be (§7).

**A button's outline is a width, and the colour is optional on it — where a
chip's pair is indivisible.** That divergence is deliberate and was bought with a
bug. A chip has nothing under its edge to fall back to, so there a colour with no
width draws nothing and a width with no colour draws a black line nobody picked,
and `readBlock` refuses to keep either half alone. A button *does* have something
under its edge: `currentColor`, its own label. The version that enforced the pair
here did it in the panel, by having the Border width control **seed** a colour on
the first nudge — a hard-coded `#1c7ed6` that its docblock called "the accent",
which the accent has never been (it is `oklch(64.37% 0.2195 36.18)`, an orange).
So thickening an Outline button, whose preset deliberately stores *no* colour so
its line stays theme-aware, turned that line blue while the Outline swatch stayed
lit. Both stylesheets now fall back to `currentColor`, `buttonBorderWidth` stands
alone in storage, and the control writes only a width. Nothing published moves: a
stored width has always arrived with a colour, and a card with no width draws
`0px`.

**A new Button arrives full width** (`defaultButtonFull` on the spec, read only by
`makeCardBlock`, beside `defaultAlign` and `defaultOverlapPct`). `buttonFull`
still means what it always meant and absent is still a hugging button, so no card
already published moves — this is what a *fresh* one is, not what an old one
becomes.

**Nothing in the properties panel is a slider any more.** Every number is a row
of five named tiles — `PropertyScale` over `PropertyChoice`, with the stops in
`components/card/designer/properties/property-scales.tsx`. The Corners control had
already made the whole argument on its own and nobody had applied it to the other
seventeen: nobody arranging a card is choosing 17px of roominess out of fourteen
possibilities, and a slider cannot say **zero**, because a thumb at the far left
of a track reads as "not set" — which is how a corner control ended up unable to
express a square. One table per question, so the card's Border width and the
button's are the same five words and the card's Corners and the button's are the
same five tiles. Two things make it safe on designs that already exist. Stops sit
*on* the defaults (`defaultCardLayout`'s 320/440/12/8, `TEXT_PADDING`'s 4,
`DEFAULT_HOURS_ROW_GAP`'s 1) so an untouched card lights the tile it is actually
drawing; and `nearestStop` (lib/card/scale-stops.ts) lights the closest tile for
everything else — a width that came off a resize handle, or anything saved while
these were sliders — **without writing it back**, because opening a panel must
never edit a design.

**And not every number is a row of tiles either — the Modify tab is now a mix,
and which control a question gets is decided by width.** A tile that *draws* what
it is choosing costs no label width at all, so Corners, Alignment, Vertical,
Shadow, Fill/Fit, Width and Height stay tiles. A tile carrying a *word* gets
about 36px of room across this column at five across, so every `room()` scale —
None / Tight / Regular / Roomy / Wide — clipped: Padding, Gap between blocks,
Margin, Space between days, Chip padding, Roominess and all three Border widths
are `PropertyNumberSelect` now, and Hover and Size are selects for the same
reason with four and five words of their own. It is the argument the card's own
Transparency already made in this file, applied to the seven controls it had not
been. Narrowing is safe on designs that already exist for the reason above:
`nearestStop` lights the closest remaining option and writes nothing.

**Every fold now starts shut and only one opens at a time, which reverses two
more of this file's arguments and settles a third.** The publish sidebar opened on
"Results panel" because comparing a panel setting against a colour is a real thing
to be doing; the palette opened on all four shelves because nothing is compared
across shelves and hiding the block you came for is a click for nothing; the Modify
tab opened the first non-empty group and, via `SIGNATURE_GROUP`, the fold a Button
or a Tags block is really selected for. Each of those is a good argument about one
panel. What none of them survives is the two questions being asked together — *how
many are open* and *how tall is the column* — because the answer to the first was
"as many as you like" and the second is 20–24rem everywhere. A sidebar with three
folds open is the wall folding was introduced to break up.

So `PropertyFolds` owns the set: no `allowsMultipleExpanded` (react-aria's
`DisclosureGroup` is single-open by default, and all four call sites were asking
for the other behaviour), and `expandedKeys` starting empty. The Edit location
dialog had this rule all along — `FormSection` was `useState(false)` from the day
it stopped being a `<details>` — so three panels disagreeing with it was the actual
inconsistency, and `FormSectionGroup` now gives the dialog the *one-at-a-time* half
it was missing. A `useId` per section rather than a key derived from the title,
because two sections sharing a word would open and close together and the symptom
would read as a bug in the animation.

`SIGNATURE_GROUP` is gone with it, and the bug it answered is worth keeping in
view: a Button block opened "Size & position" while the button's colour sat shut
two folds below under a heading reading "Button" inside a panel already headed
"Button", and it was reported as the control not existing. Nothing open is not a
regression of that — with every fold shut, all seven headings a block offers are on
screen at once, so the one you want is one press away instead of one scroll and one
press. The failure was a control below the fold, not a control behind a click.

**Opening a fold now scrolls to what it opened** (`lib/ui/reveal-fold.ts`), which
is the other half of the same complaint. Nothing did this before — `scrollIntoView`
appeared twice in the tree and neither was a fold — so a fold near the bottom of a
sidebar grew its panel off the end of the scroller and reading as not having opened
at all. Measured: a 197px scroller with "Visitor analytics" 168px down: the panel's
bottom landed 126px below the fold, and after the reveal the whole item sits inside.
It waits for `transitionend` on `height` rather than scrolling on the press, because
HeroUI animates the panel from `--disclosure-panel-height` over 200ms and a scroll
against an 8px box lands nowhere; the timeout behind that is a guard, not a guess,
for a transition that never starts. `block: "nearest"` so a fold already fully
visible is left exactly where it is.

**The Modify tab folds, which reverses an argument this file used to make.**
`PropertyGroup` was always-open on the grounds that the panel already scrolls, so
folding buys height that was never scarce and costs a click on the way to every
control. What that did not weigh is how much there is: a block offers up to seven
headings and around twenty controls at 24rem, and a column that long is one
nobody reads down. The palette and the publish designer had each reached the
opposite conclusion separately, so three panels now agree and `PropertyGroup` is
deleted — `PropertyFold` took its `isEmpty`, which is the rule that a group with
every control hidden renders nothing at all, heading included. **Which fold opens
has to be *found* rather than named**: the publish sidebar can write
`defaultExpandedKeys={["panel"]}` because its four are always there, while a
block's are its own business, so a hard-coded id lands on a spacer and opens
nothing. `key={block.id}` on the `Accordion` is what stops a new block inheriting
the last one's open set.

**Booleans are one question on one line, and lone ones go last.** The Links row's
four and the week's three are `PropertyToggles` — the control the publish
designer uses for "Each row shows", and the thing its docblock already called
*"stop putting checkboxes in their own row"*. That docblock's stated reason was
wrong and has been corrected: the split is not draft-versus-immediate (this panel
*is* a draft, and the same `BlockProperties` is drawn immediately-writing in the
per-pin card menu) but how many answers one question has. A single yes-or-no is
still a `PropertyCheckbox`, and the rule is that it sits at the end of its fold —
a boolean interrupting a run of fields is the whole of what "checkboxes sprinkled
all over" meant. The week's `hoursOpen` flipped its wording with the change: as a
checkbox it read "Only today", the inverse of the field, and a toggle that is on
when its field is *absent* is a control that lies about what it stores. It is
"Whole week" now.

**A colour field can put its label above, and that is a question about the column
rather than about the control.** `ColorPickerField` keeps label-inside as its
default, because the publish designer's Colours fold is five of them and nothing
else — a name beside each swatch is a tidy list there. In the card designer the
same control sits among label-above fields, and a label-inside one spends none of
the 6px between a label and its box, so at one shared `space-y-3` a colour read
as crowded against whatever sat above it. With `labelPlacement="outside"` the
trigger says the value instead (`Default` when unset), which is what makes a
full-width bar with a swatch alone in it worth looking at.

**The palette is shelved and folded, where it was one grid of chips.** The Blocks
tab drew `availableBlocks` as a two-column grid of 12px chips, and two things
were wrong with it, both about the same 24rem column. The chips were
`border-border bg-surface` **inside a `bg-surface` panel**, so a dozen hairline
rectangles floated on an identical ground with nothing saying they could be
picked up — `.is-draggable` is deliberately `cursor: pointer` (see globals.css),
so there was no cursor to say it either. And at half the column's width every
label truncated, which is why `hint` — one good sentence per block, already
written — had nowhere to live but a native `title`. So: full-width rows on
`bg-default`, the block's own glyph in a tile of its own, and the hint on screen
at two lines before it clamps. The row's hover border is what says it is picked
up; the `GripVertical` that used to sit here is gone, twice over — see the
touchscreen section above. Eleven of those is a wall, which is what the folds
were for: `BLOCK_GROUPS` in `block-labels.ts` shelves them by the question each
answers, **a shelf holding nothing renders nothing at all**, and the palette
therefore shrinks as the card fills up until it is the two or three blocks that
genuinely repeat.

`PropertyFold` — the publish designer's own `Fold`, lifted to
`components/ui/properties/property-fold.tsx` — is what the Modify tab uses,
because that `Accordion.Item` → `Heading` → `Trigger` / `Panel` → `Body` anatomy
is load-bearing and a hand-copied second version is a trigger with no accessible
heading.

**The palette's folds are gone, and the shelves stayed.** Asked for, and right:
a fold is a claim that you already know which shelf the thing you want is on, and
this panel is the inventory rather than a run of questions. Shut and
one-at-a-time — the rule every other fold in the app follows, and the right one
for the Modify tab beside it, which asks up to twenty questions about one block —
cost two presses to reach a Divider and left nothing on screen to tell somebody a
Logo block existed.

What paid for it is the row shape, and the numbers are the whole argument.
Eleven full-width rows carrying a sentence of hint each is ~700px in a column
whose scroller is about `100dvh − 286px`; eleven **two-up tiles** under static
headings is ~340px. Measured in the browser with the card empty, which is the one
state where all eleven are offered: 315.5px of content in a 456px scroller at a
732px viewport, and 346 in 346 at 622px — no overflow either way, and no label
truncated at 24rem. The hint is still there, in the `title` that already carried
the zones sentence beside it; a tile is two words wide and a hint is a sentence,
so on screen was never available to it here. `BLOCK_GROUPS` lost its `compact`
flag with the change, because every tile is the compact one now.

`PropertyFolds` is still what the Modify tab uses, and the single-open rule still
holds everywhere it is used. The palette simply is not a fold any more.

`EVERY_BLOCK_IS_SHELVED` is the one thing in that file worth not deleting. A new
`CardBlockType` nobody filed would be a block that exists, drops onto a card
perfectly well and is offered nowhere — a failure with no runtime symptom at all.
`BLOCK_LABELS` is a `Record` and so forces its own entry; that constant is the
same guarantee for the shelves, and it fails at compile time.

**A card can be glass, and it is the panel's own mechanism one element over.**
`backgroundOpacity` and `backdropBlur` on `CardLayout`, both optional, **absent
meaning opaque and unblurred** — which is what every card saved or published
before them already says, so no migration and no republish (§7). It is a
`background-color` with alpha through `color-mix`, never the `opacity` property,
for the reason `.lm-panel` gives: `opacity` fades the card's text along with its
ground, so a glass card would be an unreadable one. `cardGround` in
`card-frame.tsx` and the two `.maplibregl-popup-content` rules in
`embed/src/styles.css` run the same mix, over `var(--surface)` / `var(--lm-surface)`
when the owner chose no colour — a stored `#ffffff` could not stay theme-aware,
which is the argument `background` itself already makes by being absent.

Three things about it are load-bearing. **Absent blur is `none`, not `blur(0)`** —
a backdrop filter of zero still makes the element a backdrop root, and a card is
moved by transform at 60fps by `useMapAnchor` where the results panel sits still;
so `--lm-card-backdrop` carries the whole `blur(...)` where `--lm-panel-blur`
carries a length. **The tip came with it**: MapLibre paints
`.maplibregl-popup-tip` from its own stylesheet, so a solid white triangle would
hang off a glass card — `.lm-root .maplibregl-popup-tip` now runs the same mix at
MapLibre's own specificity, later in the same injected sheet, which is what lets
it win. No blur on the tip, because a backdrop filter applies to the border box
and the tip's is a square. **And Solid stores the absence**: `optional()` in
`resolveCardLayout` drops a value equal to what absent already means, the way
`usedPinIcons` drops a pin field left at its default, so an owner who tries Glass
and goes back publishes the bytes they always did and `sameCardLayout` reports
the design clean. Verified in the browser both ways round.

The studio needed one thing for the control to be honest. Its workspace is
`bg-default/40`, one flat tone, so a glass card drawn on it looks exactly like a
solid one — the failure this panel refuses everywhere else. `.transparency-grid`
is a checkerboard behind the card while, and only while, the card is see-through:
the standard idiom, and honest in a way a fake basemap would not be. Blur is
offered only once there is transparency for it to show through, for the reason
the Border width below it is offered only once there is a border colour.

**Deleting a block moves nothing but the block, and getting there needed a
measurement carried across the tree.** `settle` pays for an arrival out of the
gap it lands in, and `vacate` refunds a departure the same way; `removeCardBlock`
did neither, on the stated argument that a delete and a move make different
promises. What that actually made was a card that does not survive a round trip:
drop a block into the room above another and nothing moves, delete it again and
everything below it jumps up by the space the arrival was charged for. So
`removeCardBlock` takes a `VacatedSpace` now. It cannot derive one — most blocks
have no height of their own — so `CardCanvas` reports `geometry.vacate` upward
through `onVacate`, `CardDesigner` holds it in a **ref** (state would re-render
the designer on every pointer move of a drag that is already measuring the card),
and the wall reads it on release. Verified in the browser rather than in a
fixture: gallery/logo/tags/hours/address at 160/235/318/367/**576**, a Button
dropped into the gap leaves them at 160/235/318/367/**580**, and removing it puts
them back at **576**.

**The Links row can leave any of its four out, and the flags are spelled as the
hidden state.** `hidePhone` / `hideEmail` / `hideWebsite` / `hideDirections`,
`true` or absent and never `false` — every card already live on a customer's site
draws all four, so absent has to mean shown or every published snapshot would be
describing something it does not say. They exist because a Button carrying
Directions makes the row ask the same question twice; that is the case they were
asked for. Fixing them turned up a real **drift between the twin renderers**: the
embed's row had always appended a Directions link and the dashboard's `Actions`
never had, while `BLOCK_LABELS.actions.hint` claimed all four. The dashboard now
draws it. `hasBlockContent` reads all four, or a row with everything unticked
would be an empty box with its own padding in it — and it takes the block now,
not just its type, which is why every call site passes one.

**"More details" is retired, not deleted.** `DETAILS_CONTENTS` is only
`description` and `hours`, and both came onto the default card when the designer
shipped, so the fold drew nothing on the card everybody gets. It is off
`defaultCardLayout()` and marked `retired: true` so `availableBlocks` stops
offering it, and `BUILDERS.details` and the `Details` component both stay: a
design somebody saved with the description dragged off still folds it, and every
snapshot already live keeps drawing what it drew. Same treatment `category` got —
the shape a block gets deleted in here.

**The card is exactly as wide as the popup holding it, and getting that wrong
cost two visible bugs at once.** `buildPopup` sets the card's own `width`, which
fixed the old "a card with little in it draws at 133px" drift — but the `Popup`
was still constructed with `maxWidth: <card width>`, and that caps
`.maplibregl-popup`, which is a **flex row of the tip and the content**. So the
content box was the card's width *minus the 9.6px tip*, and the card inside it
overflowed an `overflow: hidden` parent: every card lost ~10px off its edge, and
its position inside that clipping box re-resolved on any repaint. Hovering the
gallery's next arrow moved the whole card — photo, icons and all — four pixels
sideways, which is what "everything shifts slightly when I hover" was. It is
`maxWidth: "none"` now; `.lm-popup`'s own `max-width: 260px` is what still sizes
a shape's popup on the same instance. **A cap on a MapLibre popup is a cap on the
tip too** — if one is ever wanted again, it has to be the card's width plus the
tip's.

**A card never opens under the results panel, and the geometry moved out of
`map.ts` to say so.** `cardBands` measured `frame.clientWidth`, and a *floating*
panel is an overlay inside that frame — so on the default design (panel right,
over the map) a card routinely landed under it: not merely hidden but
unclickable, since the panel takes the pointer. `embed/src/card-place.ts` now
holds `usableFrame`, `cardBands` and `chooseBand`, and the first of those cuts
the frame back by whatever the panel actually covers. **It decides from
rectangles, never from `data-lm-side`**, which is what makes one rule serve all
three layouts: docked, the panel is a flex sibling and does not intersect the
frame at all; stacked (the narrow container query) it sits below the map; only
floating produces a cut — and an RTL host page needs no second case. The card
therefore opens on the side away from the panel, which is what "opposite the
sidebar" means in practice, and still goes above or below the pin wherever that
already fits.

Two traps in that file. **`flyToCard` still offsets against the *container's*
centre**, not the usable rect's: MapLibre defines `flyTo`'s `offset` relative to
the map container, so mixing the two flies the panel's width too far. And it is
its own module because **`map.ts` imports maplibre-gl at module scope**, which
touches `window` on evaluation — nothing in it is reachable from a unit test, and
`embed/src/card-place.test.ts` is what now holds the placement honest.
`PositionAnchor` is a type-only import there, so the split costs the bundle
nothing.

**Every `--lm-card-*` fallback must equal its `--card-*` twin, and three of them
did not.** The two stylesheets are kept in step by hand, which works until
somebody types a number: the embed drew the address and description at 13px
against `.card-text--body`'s 12px, the button label at 13px against
`.card-button`'s 12px, and the opening-hours summary at 13px against its own
week's 12px. The chip was worse than a pixel — `color-mix(--lm-foreground 8%)`
was documented as "the same weight of grey" as the studio's `--default-soft` and
is the opposite one: a light theme's `--default` is near-white, so the studio drew
a *lighter* pill than its card and the embed a darker one. It reads
`color-mix(in oklab, var(--lm-border) 50%, transparent)` now — `--lm-border` is
the embed's twin of `--default`, #e2e5ea against `oklch(94%)` in light and
#2c2f35 against `oklch(27%)` in dark. All four move cards already published on
the next `/embed` deploy, which is the tag-filter-chips exception taken again and
is the entire point: the two renderers must agree.

**And then it followed the wrong viewer, which is the second half of the same
bug and cost three symptoms that looked unrelated.** `cardThemeClass` resolved
Auto — and `DEFAULT_MAP_STYLE` is Auto, so this is most maps — by reading
`window.matchMedia("(prefers-color-scheme: dark)")` at render. That is the
*operating system's* preference, and the dashboard's theme is not it: HeroUI
resolves localStorage first, so an owner whose OS is dark and who picked **Light**
in the account menu got `<html class="light">`, a light basemap via
`usePrefersDark`, and a card wearing `.dark` on top of both. Three reports came out
of that one line and none of them named the theme: the card was black in light
mode (`bg-surface` at `oklch(19%)`), the gallery's dashed border was black
(`--border` at `oklch(28%)`), and React reported a hydration mismatch against
`card-frame.tsx` — because a `typeof window` branch read during render makes the
server say `light` and the client say `dark` on the same element. It was also
non-reactive: toggling the dashboard theme never redrew the class.

The answer arrives as an argument now, from `usePrefersDark()` — the `.dark` class
off `<html>`, through `useSyncExternalStore`. That is the same source
`use-maplibre.ts` reads for the basemap, so the card and the map under it cannot
disagree; it honours an explicit Light or Dark as well as "system"; it re-renders on
a toggle; and it has a server snapshot, so there is nothing left to mismatch. The
signature deliberately mirrors `shouldDarkenStyle(style, prefersDark)`, which
answers the neighbouring question about the basemap itself. **The product's own copy
was right all along** and is worth quoting, because it is what settled which viewer
Auto means: the appearance dialog says Auto matches "your theme here, each visitor's
own setting on your site."

**The drag ghost lost its variables, and drew a colour instead of nothing.**
`mountRowGhost` clones the dragged block onto `document.body`, deliberately — a
fixed ghost is clipped inside the panel. The clone keeps its classes, so every rule
that styled it still matched, but the two elements *declaring* what those rules read
are ancestors it no longer had: `cardAccentVars` writes `--card-accent` on the
designer column and `cardStyle` writes `--card-pad`, `--card-gap`, `--card-radius`,
`--card-slot-radius`, `--card-font*` and `--card-color` on the card root. So
`.card-button` fell to the end of `var(--card-button-bg, var(--card-accent,
#1c7ed6))` and the thing under the pointer was blue while the block it was a copy of
was orange two inches away; an Outline button's ghost took a blue border and label,
and the slot radius, the text sizes and an empty block's height were each one
fallback out. `inheritContext` walks the ancestors copying their **inline** custom
properties, nearest winning — inline is what makes it work in every browser, since
iterating `el.style` finds custom properties where enumerating `getComputedStyle`
does not, and both declarations above happen to be inline. The card's `.light` /
`.dark` comes too, or a block dragged out of a card on the Dark basemap would
repaint itself in the page's theme mid-gesture.

**The dashboard's card carries its own colour context, because it was following
the wrong theme.** A card's ground is a colour its owner picked — a stored
`#ffffff` at 60% on the default design — while every word on it comes from theme
tokens. On the dashboard those tokens followed the *dashboard's* theme and in the
embed they follow the map's (`resolveTheme`), so with the dashboard in dark mode
the studio drew pale text and a dark chip on a pale card while the customer's
site drew the opposite. `lib/card/card-theme.ts` answers `"light"` or `"dark"`
from the *basemap* — Auto asks the browser, everything else asks
`isDarkMapStyle` — and that class goes on the card element itself in
`card-canvas.tsx` and `place-card.tsx`. It works with no new tokens because
app/globals.css already declares both sets under `.light` / `.dark`, and the
card's own chrome (the pencil, the close X, `.card-slot`) correctly flips with
it. **Not on the wrappers that carry `cardAccentVars`** — those are the whole
editor row and the whole designer column, and re-theming them would take the map
chrome and the locations panel with them.

**Directions sends the origin, never waits for it, and the sharpest reading
wins.** Three rules, and each one is a bug that shipped.

**The link is never intercepted.** `directionsUrl` takes an optional origin and
for a long time never got one — the only things that set it were the crosshair
and a boot warm-up that runs when permission is *already* granted, so a visitor
who arrives and presses Directions had neither, and Google resolved the start
from their IP address. The obvious fix, and the wrong one, was to ask on the
press: open a tab synchronously (a browser will not open one from a promise
callback seconds later), hold it, and point it somewhere once the position
lands. On a machine with no GPS a better reading never comes, so that wait ran
its full three seconds every time — **five seconds of blank tab**, for an answer
that was no better. `installDirectionsAsk` now touches nothing: the browser
opens the link exactly as it would with no script on the page, and the lookup
runs behind it. The first press pays (it goes out with whatever was known) and
every link drawn afterwards carries the answer.

Two things died with that interception and are worth not rebuilding. The
`window.open` feature string had to be **empty** — it was `"noreferrer"`, which
implies `noopener`, which makes **`window.open` return `null`**; measured in
Chrome from one page, a bare `window.open("", "_blank")` hands back a handle
where `noreferrer` and `noopener` both hand back null, so the popup blocker was
never the variable. That guard fired on every press and the entire ask was dead
code for a release, while Directions went on working and simply started
somewhere else. And the tab then needed its opener severed and a `no-referrer`
meta written into its `about:blank` by hand, to put back what the feature string
was reaching for. None of that exists now, which is the point of recording it.

**A coarse origin beats no origin, and the gate that said otherwise made things
much worse.** There was an `ORIGIN_MAX_ACCURACY_M` of 50m, on the reasoning that
Google with the origin *omitted* uses the visitor's own live location and snaps
it to a road, which beats a frozen coordinate sixty metres out. That is true
only where Google has been given a location of its own; where it has not it
falls back to the IP address. Measured against a real reporter: with the coarse
fix the route started **on the wrong street**, and with it dropped the route
started **in another town**. The gate is deleted. The only thing we decline to
send is nothing at all.

**`me` keeps the sharpest *recent* reading of the session, not the latest and
not merely the sharpest** (`remember` in embed/src/index.ts, over `betterFix` in
embed/src/search.ts). Four things learn a position and they are not equally
good — the boot warm-up and the map's geolocate control ask for a precise one,
the crosshair deliberately takes a cheap cached fix because it only has to sort
a list by distance — so last-writer-wins let the worst of them overwrite the
best purely by arriving later. Ties go to the newcomer, so somebody who has
moved is followed. This is the one job `accuracy` still does, and it is why
`Fix` travels as far as `directionsLink` instead of being flattened to a
`{lat, lng}` at the point it is stored.

**Sharpest alone was not enough, and a `Fix` carries its `timestamp` for it.**
The crosshair's `currentPosition` accepts a cached fix up to five minutes old,
and the comparison read `accuracy` only — so a reading taken before a commute
could arrive claiming the tightest radius of the session and then hold `me` for
the rest of it, sending every Directions link to a confidently wrong street. Two
comments in search.ts asserted that this could not happen, both pointing at
`ORIGIN_MAX_ACCURACY_M` / `routeOrigin`, which had been deleted with the accuracy
gate and existed nowhere in the tree — the invariant was prose, not code.
`betterFix` is the rule as a function so that it can be tested, which nothing did
before: **fresh beats sharp**, and among readings of comparable age the sharper
wins. `toFix` stores the browser's own timestamp and never `Date.now()`, because
a cached reading is handed back with the time it was *taken* and that gap is the
entire signal.

`bestPosition` (embed/src/search.ts) is what the two precise callers use, and it
exists because **`getCurrentPosition` resolves on the first reading that
satisfies the options** — on a phone that is the network fix, and the GPS one
lands a second or two later where nothing ever sees it. It watches for three
seconds, keeps the sharpest, and stops early once one is good enough. It also
reports **every** reading through an `onReading` callback rather than only the
best at the end, because the window is long enough that a second press inside it
would otherwise be told nothing while a perfectly good answer was being sat on;
that is safe precisely because `remember` is sharper-wins. Two rules in it are
what `embed/src/search.test.ts` holds, and that test is in vitest rather than
the browser for a reason the rest of this bundle is not: what it holds is
*timing*, and a reading that arrived, was worse than the next one, and was used
anyway looks exactly like a correct route. A **refusal ends it immediately**,
and **any other error is one failed reading rather than the outcome**.

The map's own `GeolocateControl` runs at `enableHighAccuracy: true` rather than
MapLibre's default of `false`, and its `geolocate` event feeds `remember`. Both
halves are one point: that control draws an accuracy circle at the radius the
browser claims, so **what the visitor sees as the circle is what a route starts
from**. Drawing the cheapest answer while routing from the best one would make
it a picture of something else — and it is also the only honest statement this
product can make about precision, since on a machine with no GPS the browser
reports a neighbourhood and no code here can improve on that. Sharpening it
further would mean a reverse-geocode in the visitor's path, which §2 forbids
outright.

**And none of the above worked, because a link is built once.** Everything above
is about *learning* a position. What it never did was hand one to a link that
had already been drawn — and every link a visitor sees has already been drawn.
`wireControls` ends by calling `list.setPlaces` synchronously during `render`,
while all four writers of `me` are asynchronous, so **100% of the rows in the
results panel are built with `me` still null**, and the panel is redrawn only by
a keystroke, a filter or the crosshair. `list.ts` reads `getMe()` per row and its
comment claimed that covered a late answer; it covers only rows built *after*
one, which the boot rows never are. The pin card is rebuilt on every click, so it
picked the origin up and the bug looked intermittent.

The report that finally pinned it: the map's own locate control drew an accuracy
circle a street wide, and Directions from the sidebar still started at the
visitor's ISP. Both halves were true at once, which is the signature of a value
that is known and not delivered. `refreshDirections` is the delivery —
`querySelectorAll("a[data-lm-dir]")` over the root, rewriting `href` through the
same `directionsUrl` everything else uses. The targets live in a `WeakMap` keyed
on the anchor, so a redraw's dead rows are collected with their entries; encoding
the target into the attribute instead would have to carry the place *name* for
Apple's `q=`, which is customer text, and `dom.ts` exists to keep customer text
out of attribute payloads. It scans the root rather than the list, so it reaches
the open card's links row and its Button block for free — verified in the browser
with a card open: the href changed and the card was the same node, no rebuild, no
carousel reset.

`remember` gates on `betterFix(me, at) === me`, which is identity rather than a
deep compare because `betterFix` hands back one of the two objects it was given.
It refreshes only when the session's answer really moved.

**Two things kept the first press from ever paying for itself.** `bestPosition`'s
three-second settle fired in the tab the visitor had just left for Google Maps,
and its `clearWatch` — clearing the only outstanding geolocation request — is
what **withdrew the permission prompt**, so a visitor who came back to allow it
found nothing to allow. The ask now runs on its own 30s `PROMPT_WINDOW_MS`;
`SETTLE_MS` is untouched, because what it holds is refinement and this is not
that. And `asked` was set *before* the lookup and never cleared, so a window that
produced nothing silenced the feature for the whole session — one chance, spent
on a prompt nobody saw. It is now `asking` (concurrency) and `refused`, and only
`denied` or `unsupported` latch. A timeout or an unavailable fix retries.

The ask is bound to `pointerdown` **as well as** `click`: `pointerdown` fires
before the browser starts opening the tab, so the request is raised while this
document is still the visible one, which is what a browser requires before it
will paint a prompt. `click` stays for the keyboard, where Enter fires it and no
pointer event at all. Not `pointerenter` — asking because a pointer crossed a
link is how a prompt becomes something people block at the browser level.

The dashboard's own card is untouched throughout, having no visitor to locate.

**A block's own fold opens with the first one.** `BlockProperties` opened only
the first non-empty group, which for a Button is "Size & position" — so the
button's colour sat shut two folds below, under a heading reading "Button" inside
a panel already headed "Button". It was reported as the control not existing,
which is the right way to describe one nobody can find. `SIGNATURE_GROUP` names
the fold a type is really selected for (Button → its own, Tags/Category → Chips)
and it opens alongside; the fold is titled "Button style"; and its first swatch
is **Colour**, not "Background", because on Outline, Soft and Ghost it paints the
line and the label rather than a background.

**An empty block on the editor's own card is a dashed `+` that fills itself in.**
Blocks stopped collapsing on a half-filled location — the card is the size its
owner designed (`--card-h`) and an unfilled block holds its place at
`.card-block--empty`'s floor — which fixed the layout and left a hole nobody
could tell from a gap. `lib/card/card-slots.ts` says which block is missing what
(`CardSlot`), `CardView` gained a `renderSlot` seam beside `renderEmptyState`,
and `components/map/place-card/slots/` is one small form per answer, each reusing
the control the edit dialog already uses — `TagPicker`, `HoursField`,
`PhotoGalleryField`, `AddressSearchField` — over the existing
`PATCH /api/maps/[id]/places/[placeId]`. No new route, no schema change, and
`useUpdatePlace` being optimistic is what makes the dashed box become content
under the finger.

Four things about it are load-bearing. **The slot replaces the block's content
rather than overlaying it**, so it inherits the block's width, height, margins
and place in the line — filling one in moves nothing else, measured in the
browser at 147/274/313/362/532/543 before and 147/274/313/361/531/543 after.
**`cardSlotOf` is not `hasBlockContent`**: that one answers `true` for a gallery
with no photo, correctly, because the band is the owner's design — but a missing
photo is the most obvious thing on a card to offer, so it is a slot here; and a
slot has to name a *field*, where the other answers a boolean. **It is
editor-only** and arrives as an optional `cardSlots` prop group, so the import
review and the preview panel pass nothing and the embed has no idea it exists
(§2, §4). And **the popover is portalled**, so it cannot follow a card that
`useMapAnchor` moves by transform at 60fps: an open slot closes on the map's
`movestart`, and Escape is guarded so one press does not close the popover and
the card under it together. `.card-slot`'s open state is our own `data-open` —
HeroUI's `Button` leaves `aria-expanded` false on a trigger whose popover is
open. With slots on, the card-wide "No details yet" sentence is retired: the
slots say it per block, each naming its own field.

**An empty block holds the room its filled twin would take, and one flat number
used to do eight jobs.** `.card-block--empty` was `min-height: 1.5rem` for every
block alike, which is right for the ones that draw a line and badly wrong for the
week: Hours with "Only today" unticked draws a summary row *plus seven days*, so
a location with no opening times lost 130px out of the middle of its card and
every block under it moved up into space the studio had never shown anybody —
the failure blocks stopped collapsing to fix, reintroduced one level down.
`emptyBlockHeight` in `packages/shared/card-layout.ts` is the reservation, read
off the block's own settings (`hoursOpen`, `hoursRowGap`, `clampLines`,
`chipPadding`, `buttonPadding`, `fontSize`) and carried out of `blockBox` as
`emptyHeight` so all three renderers ask one function. **Its numbers were
measured in the browser rather than derived** — a `Disclosure` body's 8px, a
`.chip--lg`'s 32.8px floor, a button's 27px box — and a filled open week comes to
153.9px against the 154 it answers. The floor lands on the block's **content**
element in every renderer, not on its box, which is what lets one number serve
all three: on the box it would have to know the padding too, since a
`min-height` on a border-box element covers it. That moved the class one level
down in `card-view.tsx` and `card-canvas.tsx`; the embed already had it there.
A block with a `heightPct` emits nothing, so a card nobody has touched writes no
new property at all.

**The slot wears the card's corners, not the app's.** `.card-slot` hardcoded
`--radius-md`, which is the dashboard chrome's rounding and has nothing to do
with the thing being designed — a square card drew round dashed boxes inside it.
`cardVars` publishes `--card-radius` for it, and `blockStyle` writes
`--card-slot-radius` for the one block with a corner of its own, so a Button's
slot is the shape of the button that will land there.

**A location carries its own logo, and the Logo block's Show control has three
answers.** The only logo in the system was the image on a *map-level* custom pin
(`map.pinIcons`, eight per map, 6KB of base64 each, shared by every location
wearing that pin) — so a map of stockists carrying six brands could show one logo
or none, and there was no way to add one from the card at all. `places.logoId` is
a storage file id, mapped to `place.logoUrl` through the same `photoViewUrl` the
gallery uses, uploaded through `POST /api/maps/[id]/places/[placeId]/logo`
(`setPlaceLogo`/`clearPlaceLogo` in `files.repository.ts`, modelled on
`addPlacePhotos` down to the public-read permission). **A file and not a data
URI**, which is what the pins are: a URL costs a published snapshot nothing,
where three thousand inline logos would hand every visitor megabytes of base64
(§2). `SnapshotPlace.logoUrl` is written only when there is one.

The three modes have to be three *behaviours*, or the middle one is a second word
for something that already exists — so **`"image"` stopped falling back to the
pin**, and that argument became `"mixed"`'s:

| Stored | Label | Draws |
|---|---|---|
| absent | Pin | always the pin. Every card published before this (§7). |
| `"mixed"` | Mixed | this location's logo if it has one, else the pin. What a fresh Logo block arrives as, via `defaultLogoMode`. |
| `"image"` | Logo | the logo, always. No logo → an empty block, which is a `+` slot on the editor's card. |

`logoImageOf` takes the location's own logo *and* the pin's image and prefers the
first, so a card designed against a pin logo keeps drawing one. The documented
consequence: a card already saved as **Logo**, on a location with no logo, stops
drawing the pin — picking **Mixed** is the one-press way back. Both renderers had
to be taught this together, and the first attempt was real twin drift found in
the browser: `buildLogo` returned null while `Logo` in `card-block.tsx` still
fell through to `PinPreview`, so the studio showed a pin where the customer's
site would show a gap. On the designer's canvas that nothing is a dashed hint
(`.card-logo--empty`), because the sample is whichever row happened to be first
and an invisible block reads as a broken control.

`LogoField` is the one control, in the Edit dialog's media fold, in the card
slot, and in the designer's own Logo panel — where it uploads onto the *sample*
location and says so, because the design is per account and a logo is not.

**A card can be edited per pin, and the whole of that is one column and one
substitution.** The card design is saved per *account* and drawn for every
location on every map, which is the right default and the wrong answer for a
flagship store that should show its logo where the rest show a pin. Edit mode is
the seam: the button at the **top left** of a place card (`PlaceCardChrome`, its
own cluster away from the pair on the right, because those two are about the
location and this one latches and is about the card) turns every block into a
press target of its own, and pressing one opens **the designer's own properties
panel** pointed at this location instead of at the account.

Reusing `BlockProperties` rather than building a second panel is the decision
that made "everything the designer offers" affordable: it is already a walk over
the block's declared `controls` with an `onChange`, so a control added to the
studio arrives here wired on the same day. Three small things had to give for it
— `chipPreview` became optional and its group hides without it (it pads the
*canvas* so somebody can see what four chips would do, and over a real pin there
is nothing to pretend about), `LogoProperties` gained `isOwnCard` to drop the
sentence explaining whose row an upload writes, and the zone facts
`overlapsNothing` / `aloneOnLine` moved into `lib/card/block-panel-facts.ts` so
the two panels cannot disagree about whether a control does anything.

**An entry is a whole resolved block, not a diff, and that is the load-bearing
call.** Absent is meaningful all over `CardBlock` — no `logoMode` is the pin, no
`fit` is Fill, no `bold` is not bold — so a diff would need a second "and unset
these" list travelling beside it, and all three renderers would have to apply
both halves. A resolved block reduces the merge to `overrides[block.id] ?? block`
(`overrideBlock` in packages/shared/card-overrides.ts), which is the only reason
this fits in the embed at all. The documented consequence is what the panel's
**Reset to card design** button exists for: a block that has been singled out
stops following the account design *for that block*. Every other block on that
pin, and every other pin, still does.

A patch is never assembled by hand. It goes `resizeCardBlock(effective, id,
patch)` and then `findBlock` back out, so the card menu inherits every clamp,
every refusal of a control the type does not offer, and — crucially — the
*deletion* of a field that returns to its default. That is what makes "back to
square corners" store the absence of a radius rather than a word meaning square,
which is what every card published before the control existed already says (§7).

`overrideBlock` must run **before `cardRows`**: a width or an overlap decides how
blocks pair into lines, so overriding after the pairing draws a line the pairing
never agreed to. Both renderers do it on the pairing's own input — `renderZone`
in card-view.tsx, and the zone loop in embed/src/popup.ts. Two rules narrow it,
and both live in that one function: an id the design no longer has never matches,
and a **type mismatch is ignored**, so a block id minted again after a delete
cannot inherit the old one's settings. Dangling ids are the normal state here for
the reason they are for tags — nothing sweeps them, `publishedCardBlocks` narrows
them away at publish, and every reader drops them when drawing.

**The overlay is an overlay, where a slot is a replacement, and the two differ on
purpose.** `CardView` has both seams now. A slot's job is to *be* the content of
a block that has none, so it takes the block's box; an editor's job is the
opposite, because what is being edited is what you are looking at. So
`renderOverlay` draws inside the same box without displacing anything, and
`.card-edit-target` is `position: absolute; inset: 0` over a content element
`CardView` marks `relative` — turning edit mode on must move nothing, or the
design being edited is not the one on screen.

**The target owns the whole block, and it took `inert` to make that safe.** It
was a corner badge with a pencil in it, for an honest reason: an empty block
gives its entire box to the dashed `+` that fills it in, and two press targets
stacked on a 24px line is a control nobody can hit on purpose. What that cost was
a card in edit mode wearing six pencils — the chrome became the card, on the one
screen whose whole job is showing the design underneath it. And it was never only
the `+`: a `tel:` link, the Links row and the week's fold were all live under the
badge and all took presses meant for the block.

So the stack is gone rather than worked around. `CardView` puts the block's
content inside a wrapper marked `inert` whenever `renderOverlay` returns
anything, which turns off every control the owner's own design put on the card
for as long as edit mode is on, and leaves exactly one thing to press. Three
things about that wrapper are load bearing:

- It is `display: contents`, so it generates no box. The gallery's image resolves
  `height: 100%` against the content box above (`blockContentStyle`), and the DOM
  a card lays out is the same in both modes — measured: leaving edit mode returns
  zero `.card-edit-target`, zero `[inert]` and zero `.contents` to the card.
- **The target renders outside it.** `inert` on the content box itself would take
  the target with it. That is the whole reason there is a wrapper rather than an
  attribute.
- `inert` also hides the content from assistive tech, which is the trade. The
  card's own `role="dialog"` still names the location, and each target names its
  block, so what is lost is reading the *values* while redesigning — and the card
  out of edit mode is unchanged.

**Filling content in moved out of edit mode with the badge.** The `+` slots are
pressable on the card as it normally stands and inert inside it: the card as it
stands is where a location's *content* is filled in, and edit mode is where the
*design* of a block is changed. Two gestures separated by mode rather than by
pixels, which is what freed the box.

**The card breathes while the mode is on, and the pointer is what stops one
block.** `.card-block-editable` runs `card-block-breathe` — 1 to 1.012 and back,
2.4s, ease-in-out, on every block the overlay covers — and the block under the
pointer drops the animation and outlines itself in a dashed accent rectangle with
an `--accent-soft` tint under it.

Both halves are the affordance, and the first one is the half that was missing.
Edit mode is a state of the *card*, entered from one button in its corner, and
everything under that button is deliberately unchanged: same blocks, same type,
same picture, because what is being edited has to be what is being looked at. A
card that says nothing until the pointer arrives says it one block at a time, to
a pointer already on the block it is about — which is a way of telling somebody
what they have already worked out. So the card says it up front, everywhere, and
the pointer goes back to the job it is good at: picking one.

**Empty and filled blocks draw the same thing now.** This split on `isEmpty` —
an outline for a block that was already a dashed box, a lift for one with content
in it — and that is why `renderOverlay` was handed one and `CardEditTarget` took
one. The split answered "which affordance suits this block" when the question a
pointer asks is "which block am I on"; a card in edit mode should read the same
the whole way down whatever its owner happened to put on it. On an empty block
the accent rectangle lands on the slot's own resting one, at the same box and the
same radius, so it recolours that border rather than drawing a second beside it.
The prop is gone from both, and `CardView` no longer computes emptiness for the
overlay at all.

Five mechanical notes, each of which was a bug waiting:

- **It goes on the block's box, not its content.** The box is `overflow: hidden`
  (`CardView`), so a transform on the content grows straight into that clip and
  loses a percent of a photograph off every edge, on every pass. On the box, the
  clip scales with it.
- **Hover sets `animation: none` and the base rule keeps `transition: transform`.**
  Removing an animation reverts the property to its base value, and a transition
  on that property runs from the value the animation was showing — so a block
  caught mid-swell settles rather than snapping back.
- **`prefers-reduced-motion` needs its own rule, and here it needs a replacement
  rather than a deletion.** The blanket rule at the bottom of app/globals.css
  cuts `animation-duration` to 0.01ms, which does stop the swell and leaves a
  card with no sign at all that its blocks became buttons — the invariant's own
  failure case, a state told only in motion. So under that query every target
  wears its dashed rectangle at rest at 40% accent, and hover takes one to full.
  Verified by rewriting the media rule's `conditionText` to `all` in the live
  CSSOM and re-measuring: five faint borders at rest, the hovered one solid.
- **The middle zone is `overflow-x: hidden`.** `overflow-y: auto` alone computes
  the other axis to `auto` (CSS Overflow: `visible` beside a non-`visible`
  becomes `auto`), which cost nothing until a bled block could grow: `scrollWidth`
  221 against a `clientWidth` of 218, invisible because `hideScrollBar` is on, and
  a trackpad swipe would have slid the card's content sideways.
- **On the y axis the swell is left alone, and that is a measurement rather than
  an oversight.** The zone has to keep `overflow-y: auto`, so the last block's
  growth does add scroll range — 0.8px at the top of each cycle, measured by
  setting `scrollTop` to 999 across a full period. `data-bottom-scroll` never
  flips over a cycle, so the `ScrollShadow` fade does not blink, and sub-pixel is
  below what a wheel can express. Scaling *down* instead (0.988 → 1) would remove
  it outright and was rejected for what it does to a bled photo band: a shrinking
  full-bleed block shows slivers of card ground down both edges, where a growing
  one is clipped by `CardFrame` and shows nothing.

One thing worth knowing before writing an E2E test here: an element that never
stops moving is not "stable" to browser automation. DevTools' own `hover` refused
every target until the blocks' animations were paused through `getAnimations()`.

The gallery's badge used to be the one that left the corner, because the card's
close X sits over that corner at `z-10` and `elementFromPoint` answered "Close"
at the badge's own centre. That whole exception is gone with the badge — measured
again after: `elementFromPoint` at every block's centre now answers the target,
the gallery's included, and all three chrome buttons stay reachable at theirs.

**The panel paints through a preview channel and writes the row once, and that
is a correctness fix rather than a saving.** `ColorPickerField` fires its
`onChange` on every pointer move, which is right in the studio — `CardDesigner`
holds a local draft and nothing leaves the page until Save. This panel had no
draft, so a one-second drag on the colour area became thirty to sixty concurrent
PATCHes; replies do not land in the order they were sent, `onSuccess` merges
whichever lands last, and the card walked backwards and forwards between colours.
It was worse than a flicker, because the next patch was computed from the cache:
a stale reply became the base for the following write and was *saved*. So the
picture and the record are two channels. `PlaceCard` holds a `preview` — keyed on
the place id, like `openPanel`, so an uncommitted edit cannot be drawn over the
next pin clicked — which feeds `CardView`'s existing `blockOverrides` and
repaints under the pointer with no network at all, the same channel a shape drag
paints through. `useDeferredOverrides` holds the record: one PATCH on a 400ms
trailing timer, flushed by Done and by unmount, which is every other way out
(Escape, a click outside, the map's `movestart`, the edit-mode toggle). **The
base a patch is applied to is the preview and never `place.cardBlocks`**, which
is the half of the fix that stops a revert being persisted. Its `mutateAsync`
is deliberate: Query runs a `mutate` call's own callbacks only while the observer
still has listeners, and every exit unmounts this one, so an `onSettled` written
there would never fire and the preview would stand for ever over a row that may
not have saved.

`useUpdatePlace` carries ``scope: { id: `places:${mapId}` }`` underneath that,
which serialises every place PATCH for one map instead of letting them race. The
debounce decides how often we write; the scope decides what happens when two
writes overlap anyway. **It is a behaviour change for every caller** — the pin
drag included, which had the same latent bug and hit it far more rarely.

Three smaller things about the panel, each a real bug rather than a nicety. The
pencil badge was `min(1.125rem, 100%)` on both axes, because the block's box is
`overflow-hidden` and a one-line block is shorter than a fixed 18px square — the
address row clipped it. (The badge is gone; the target is the whole block now.
The rule it came from is still live everywhere else on this card, which is why
the note stays.) The popover is a **bounded, clipping flex column**, so
React Aria's own computed `maxHeight` reaches the form's scroller: the cap used
to be a `dvh` on an element inside the dialog and `.popover` has no `overflow` of
its own, so a tall panel overflowed a body-level absolutely positioned element
and gave the *whole page* a scrollbar that came and went with it. And the panel
is **24rem, the width the studio documents**, with `overflow-x-hidden` written
out beside `overflow-y-auto` — a lone `overflow-y: auto` leaves the other axis
`visible`, which computes to `auto`, so a one-axis scroller quietly gets both.

**The per-pin panel's scrollbar was the layout shift, and every other panel in
the app had already solved it.** `block-editor-form.tsx` scrolled through a raw
`overflow-y-auto` div, so a native bar took 15px out of the content box the moment
the content crossed the boundary — measured on the Button block, 866px of controls
in a 632px box, `offsetWidth` 384 against `clientWidth` 369. React Aria recomputes
the popover's `maxHeight` on every `ResizeObserver` tick (`useOverlayPosition`
blows the cap up to the viewport and recomputes on each pass), so a fold animating
its height or a dropdown opening over it walked the content back and forth across
that boundary and reflowed the column each way. It is `ScrollShadow hideScrollBar`
now — the call `DesignerTabPanel` already makes for the studio's copy of the same
controls, which matters because the two panels draw the same `BlockProperties` and
a scroller that looks different depending on which opened it is two scrollers. The
fade stays: with the bar gone it is the only thing saying the panel continues past
the fold. Verified at 384/384 across three dropdown open-and-close cycles.

**The panel is not inside the block it edits, and that is what makes it hold
still.** It began as a `Popover.Root` in `CardEditTarget`, which put a portalled
dialog inside the one element on the card that the panel's own controls can
move — and it failed two ways at once, both measured in the browser rather than
argued. It **chased the block**: React Aria positions from the trigger and
watches it with a `ResizeObserver`, so dragging a Button's Width control walked
the pencil along the block's corner and the panel after it. And it **closed and
reopened on every press**: `cardRows` gives a block at 100% its own line and
anything narrower a shared row, and `CardView` draws those through *different DOM
parents*, so crossing that threshold reparents the block, React unmounts the
subtree, and the open dialog goes with it — `openPanel` still named the block, so
a fresh one mounted open. Between 75% and 100% that fired every time.

So `PlaceCard` owns the panel (`BlockEditorPopover`), the target is a trigger and
nothing else, and the popover is anchored to the **card** by an explicit
`triggerRef` — the fix `TagPicker` already documents for the milder version of
the same failure, taken one step further because here the trigger does not merely
change shape, it unmounts. Verified: one popover rect, unchanged across eight
width changes, and zero `[role=dialog]` additions or removals across four
crossings of the 100% boundary. The trade is that the panel points at the card
rather than at the block, and stays put while you move between blocks; it is also
deliberately **not keyed on the block**, so a change still on its 400ms timer
rides into the next block's PATCH instead of being flushed by an unmount. It is a
**standalone `Popover.Content`** with no `Popover.Root` above it, which React Aria
supports outright — `Popover` takes its own state whenever `isOpen` is passed and
`Overlay` sets `restoreFocus` itself. A `Popover.Root` is `DialogTrigger`, whose
whole job is binding a trigger three components away inside the card, and with no
pressable child it logs a `PressResponder` warning on every open. What that costs
is HeroUI's slot classes, passed explicitly from `popoverVariants()`.

**The gallery's badge was the one that left the corner** — superseded, and kept
because the measurement in it is the one that stops the corner being reused.
The gallery is
the one block that reaches the card's own chrome: `PlaceCardChrome` draws the
close X at `top-1.5 right-1.5` at `z-10`, over the card rather than in it, so the
badge underneath it was not merely overlapped but unpressable —
`elementFromPoint` at its own centre answered "Close". It moves two ways, because
an empty gallery has neither of the other corners free: with a picture the middle
is clear, and with none the middle belongs to the dashed `+` that adds one while
the corner is still the X, so the badge goes to the bottom. `.card-edit-target`
was a one-cell grid and all three placements were one `place-items` declaration,
so there was no second set of insets to keep in step. `CardView` was what knew a
block was drawing a `+`, and it kept handing `renderOverlay` that fact after the
corners went — first to pick between a lift and a dashed outline, and then for
nothing at all: the target draws the same thing on every block, so the argument is
gone from the seam. Every other block kept the corner, where nothing was in its
way.

**A `PropertyCheckbox` is a label above its box, and `PropertyChecks` stacks
them one per line.** Asked for directly, and applied in the studio too rather
than only in the card menu: both panels draw the same `BlockProperties`, and a
control that looks different depending on which opened it is two controls. It is
also what fixed the Hours panel, whose three checks sat three across — 7rem a
column against "Full day names" — and pushed the panel wider than itself. A row
is as wide as its label plus its box with no way to give any of it back; stacked,
the label wraps and the control is 16px whatever it is called. `PropertyChoice`
truncates rather than overflowing for the same reason, since five tiles reading
None / Tight / Regular / Roomy / Wide are about 300px of text with no wrap in
them.

**The mark has corners now**, `logoRadius`, absent meaning the square the logo
`<img>` has always drawn (§7). Percentages rather than pixels — 12% and 50% —
because a logo block is squared by `blockBox` and its size is a percentage of a
card the owner can resize, so one number is the same corner at every size, and
there is no custom property to define in two stylesheets and drift.
`logoRadiusOf` is the single resolver both renderers ask, beside `logoImageOf`;
it answers nothing for a pin, which is drawn from paths and is already its own
shape. A wide wordmark under **Round** loses its ends, because the image is
letterboxed rather than cropped — a real cost, offered rather than guessed at.

**It cost the embed its last 204 bytes, and the budget was met by trimming rather
than raising it.** The first version merged all three zones into a new layout per
popup and came in 60 bytes over; `overrideBlock` answers a block at a time, which
is all either renderer needs, and `mergeCardBlocks` — which `buildSnapshot` still
wants, because clamping is a question about the whole card — tree-shakes out of
the bundle entirely. Our own code now sits **exactly on** the 42KB line with no
headroom at all, so the next thing to reach `/embed` or `/packages/shared` trips
it. `embed/src/popup.test.ts` is the first test to live under `/embed`
(`vitest.config.mts` was widened by one line to find it) and is what stands
between the twin renderers and a silent regression: a bug here does not look like
a bug, it looks like a card drawn correctly for the wrong location.

**The pin picker pages rather than scrolls.** `PinField` was a bare
`overflow-x-auto` row — a native scrollbar under a row of pictures, which is the
one control in the Edit location dialog you had to discover by dragging. It is
`CarouselTrack` at `columns={4}` now, the same control the pin studio's library
and field rows already use, with the chevrons *beside* the track: an overlaid
arrow on a four-up row covers a quarter of what is being looked at.

**The card's X and Edit buttons lost their tooltips.** They borrowed them from
`IconButton`, whose tooltip earns its place on a toolbar full of glyphs nobody
has a prior for. A cross and a pencil in the corner of a card are the two most
over-learned icons on the web, and a bubble saying "Close" covers the card to
explain the card. The labels stay in `aria-label`.

**"Copy to every day" is gone from the hours field**, on request. Worth knowing
what went with it: it appeared only once a first day was filled in, so it moved
the legend row as you typed, and it overwrote all seven days including ones
already set — one press that silently discarded a Sunday, with no undo. Copying a
row at a time is the shape to reach for if it comes back.

**A button's Label could not hold a space, and the fix was to stop normalising
mid-typing.** `resizeCardBlock` ran `.replace(/\s+/g, " ").trim()` on
`patch.buttonLabel`, borrowed from `readBlock`'s `text()` on the sound argument
that an emptied box should read as unset immediately. But `PropertyText` is a
controlled input reading its value back off the block and the designer commits
every keystroke — and a space typed while composing is always a *trailing* space
at that instant, so `Book now` came out `Booknow`. The blank test stays and the
normalisation goes; `readBlock` still collapses and trims on the way in, which is
the moment a stored label is read.
