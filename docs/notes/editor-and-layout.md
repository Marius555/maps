# Editor layout, drag and import — design notes

Moved out of CLAUDE.md on 2026-09-05 so that file stays cheap to load. Nothing here is
rewritten; it is the record of why this area is shaped as it is.

## Invariants

### Editor layout

- **Exactly one element in the editor has a real height**, and everything below depends on
  it: `lg:h-[calc(100dvh-3rem)]` on the editor row in `map-editor.tsx`, where the 3rem is
  `Container`'s own `py-6`. Everything else is `min-h-*` or `flex-1`, and a percentage
  flex-basis against an indefinite parent resolves to `content` — so without it the panel's
  `overflow-y: auto` sat on a box that always grew, scrolling the page and stretching the
  map. Below `lg` the row stacks and the panel caps at `max-h-[60dvh]`.
- **A modal's actions go in `Modal.Footer`, never at the end of `Modal.Body`.** HeroUI's
  modal is `scroll: "inside"` by default, so the body is the scroller and the dialog is
  capped at `max-h-full` and centred by `sm:my-auto`. Buttons inside the scroller are
  dragged by the browser's scroll anchoring while a fold animates shut, and jump when the
  content stops overflowing and the dialog re-centres — which is exactly what closing the
  Edit location dialog's **last** fold did, it being the only one with the buttons directly
  beneath it. `PlaceForm`'s `<form>` therefore spans `Modal.Body` *and* `Modal.Footer` as a
  `flex min-h-0 flex-1 flex-col` child of the dialog, so submit still reaches a button that
  is no longer inside the scrolling half and no `isSubmitting` has to be lifted. It carries
  `mt-2`, which is what `.modal__header + .modal__body` gave the body before an element sat
  between them. `pin-studio.tsx` is the older statement of the same rule. Verified: the
  footer holds at one pixel for the whole 200ms collapse.
- **The general form of that bug is scroll anchoring, and the general answer is
  `overflow-anchor: none`.** Moving the footer fixed the dialog, but the design sidebars on
  `/card` and `/publish` have no such move available — their folds are *inside* a
  `ScrollShadow` and closing the last one shrinks the content under the browser's own
  anchor correction. `.accordion` and `.disclosure` carry `overflow-anchor: none` in
  app/globals.css, and the panel keeps `will-change: height` unconditionally, because
  HeroUI declares it only under `[data-expanded="true"]` — dropped at exactly the moment
  the closing transition needs it. Measured after: 64 frames, **zero direction reversals**,
  a clean ease-out from 9.6px to 0.8px a frame. Single-open folds help on their own, by
  leaving far less `scrollTop` to clamp.
- **The window's scrollbar gutter is reserved, once, on `html`.** The dashboard's pages
  grow the document (`AppShell` is `min-h-[100dvh]`, a floor rather than an app frame),
  so anything that opens can cross the viewport boundary and bring a classic scrollbar in
  with it — taking ~15px out of the layout in one frame. `scrollbar-gutter: stable` in
  `app/globals.css`. Reported on the import wizard's Review step, where pressing **Fix**
  on a short list did exactly that; the fix is deliberately global rather than per screen,
  because every page here can do it.
- **The import wizard is centred down the page with `my-auto`, never `justify-center`.**
  Auto margins resolve to zero when free space is negative, so the tall Columns and
  Review steps still start at their top edge and scroll normally. `justify-content:
  center` would push their top above the scroll container, where nothing can reach it.
  `page.tsx` and its `loading.tsx` carry the same two classes.
- **A Motion collapse reveals itself through `revealCollapse`, not `revealFoldIn`.**
  `reveal-fold.ts`'s machinery reads React Aria's `--disclosure-panel-height`, which
  Motion does not write; the collapse wrapper is `overflow-hidden`, so its `scrollHeight`
  is the same answer. It also falls back to `document.scrollingElement` where
  `scrollableAncestor` finds nothing, because a reveal fired before the row grows
  under-scrolls exactly the rows near the bottom of the screen. **It honours
  `scroll-margin-top` by hand**, since the arithmetic path never reaches `scrollIntoView`
  — that is what keeps an opened review row from landing behind the `lg:sticky` map.
- **A `<div>` inside a `<p>` is a hydration error, not a lint nit.** `SidebarGroupLabel`
  was a `<p>` and holds a `Skeleton` (a div) while the map name loads; the parser closes
  the paragraph early, the DOM is not the one React rendered, and the whole subtree
  regenerates. It is React's own "invalid HTML tag nesting" bullet, and the error names the
  component rather than the tag.
- **The sidebar's map name reserves its box before it has one.** `SidebarMapNav` rendered
  nothing until `useMap` resolved, then popped in a ~28px label and pushed all six nav items
  down on every cold load. It waits on a real request even though the page already has the
  object: `AppShell` renders the sidebar before `<main>`, so this observer creates the
  `maps.detail` query *without* the `initialData` `map-editor.tsx` passes, and react-query
  will not retro-fill a query that already exists. The label is now always rendered, holding
  a skeleton bar. Measured: 241 frames across a cold load, the nav list at exactly 64px in
  every one.
- `app/(dashboard)/maps/[id]/(editor)/loading.tsx` repeats all three strings verbatim and
  has to keep doing so.
- **Every `loading.tsx` must pass the same `Container` `size` as its page**, or the skeleton
  swap moves the layout.
- **A `loading.tsx` covers its segment's page *and every route below it*.** Each page with
  routes beneath it sits in its own route group — `maps/(list)`, `maps/[id]/(editor)`,
  `maps/[id]/places/(list)`. **Add a nested route under one of these and put it outside the
  group.**
- Page width is three choices: `Container` is `content` (unbounded), `centered`
  (`max-w-5xl`) or `narrow`. `Measure` is the readable column *inside* a full-width page.
  The import wizard caps itself per step (`isWide`), animating between `max-w-5xl` and
  `max-w-full` — **`max-w-full`, because `none` is not a length and will not interpolate.**

### Drag

- `lib/map/edge-autoscroll.ts` pulls the container when the pointer nears an edge, because
  a drag refuses the pan outright (see below) and will never scroll there by itself.
- **`update` must be given `clientX` as well as `clientY`.** Without it the band is an
  infinite horizontal strip, and a block dragged across the card scrolled the palette out
  from under it at 14px a frame. The `clientX` argument is optional so the nine existing
  calls in `edge-autoscroll.test.ts` still pass unmodified.
- **The whole row is the drag source, on every device.** There is no grip, and the one
  attempt at one is worth knowing about because it was a plausible answer to a
  misdiagnosis — see the next two bullets. The row is `touch-action: pan-y` (`none` gave
  every finger swipe to the drag and the panel could not be scrolled at all) and decides by
  **stillness**: movement first is a scroll, 250ms of stillness starts a drag. A mouse skips
  the hold and uses the 8px threshold.
- **`preventDefault()` on a pointer event does not stop a scroll.** This is the bug that
  cost the most here, and the code asserted the opposite in a comment for a long time: the
  250ms hold was written to claim the pan by preventing the first `pointermove` after it
  fired, which the Pointer Events spec defines as a no-op. On Android the compositor then
  took the pan `pan-y` had promised it, marked every later move `cancelable: false`, and
  finished with a `pointercancel`. The symptom was "the row does not move", with an empty
  console.
  **The evidence, and it was read backwards once:** `components/tags/use-chip-reorder.ts`
  has the identical hold, threshold and `pan-y` and has always worked — because a chip drags
  *horizontally*, the axis `pan-y` refuses declaratively, so it never had a pan to claim.
  `components/map/add-location/use-drag-to-add.ts` always worked for the same declarative
  reason: `touch-action: none`, no hold. Neither is evidence that a hold cannot work. Both
  are evidence that only `touch-action` was ever doing any work. A grip carrying
  `touch-action: none` was built on the backwards reading, worked, and has been removed.
- **So the pan is claimed by a non-passive `touchmove`, and three details of how are forced
  by the platform** (`rowRef` in `use-row-drag.ts`): it must be `addEventListener`, because
  React registers `touchstart`/`touchmove`/`wheel` at its root *passively* and a JSX
  `onTouchMove` therefore cannot `preventDefault` at all; it must be bound at mount, because
  Chrome decides whether a scroll can go straight to the compositor by looking for blocking
  listeners at hit-test time and one added mid-gesture does not apply to the gesture already
  running; and it must be bound only where `canDrag`, because a blocking listener costs the
  first move of every touch scroll a main-thread round trip and the Locations tab is the
  longest list in the app and cannot drag at all. It refuses nothing before `begin()` has
  run, which is what leaves a swipe to the browser with its momentum intact.
  The ref detaches by hand on the `null` call rather than returning a cleanup, because
  `rowProps` is spread onto a `motion.div` in two places and anything that composes refs
  itself may drop a React 19 cleanup and leak a listener per row.
- Android's own long-press is refused in three places, because it fires ~500ms in — a
  quarter second *after* the row's hold has already started a drag. `user-select: none` and
  `-webkit-touch-callout: none` sit on the row from the start (they refuse the selection
  callout and the preview menu respectively, and `body.style.userSelect` in the drag effect
  was always too late to retract something the browser decided at `pointerdown`), and a
  `contextmenu` listener is bound for the length of a drag. The declarative pair is what
  covers the 250ms *before* there is a drag to bind that listener from.
  `preventDefault` on `pointermove` stays, guarded by `event.cancelable`, but only for text
  selection and the mouse-compatibility events — it stops sixty warnings a second in the one
  console you need to read.
- **A `pointercancel` after a drag has begun completes over a lit target rather than
  discarding it.** Before one it is the browser taking a scroll it was always allowed to
  take. After one the `touchmove` above has already refused the pan, so there is no scroll to
  take — a cancel is an interruption, and the highlight was a promise drawn from the same
  coordinate. It always *ends* the gesture either way: no further move or up is delivered for
  a cancelled pointer, so a drag kept alive would be a ghost stuck under a finger already off
  the glass.
- **Edit means the dialog, and only the dialog.** The row menu must not call `focusPlace`
  before `setEditingId` — that drew the card behind the modal and flew the camera away.

### The editor map's own controls

- **MapLibre's controls sit bottom-left, and that corner was chosen by elimination.**
  Top-right is where the floating toolbar wraps to — which is why `map-toolbar.tsx` carried a
  `pr-12` whose only job was dodging the zoom stack, now deleted. Bottom-right is spoken for
  twice: MapLibre builds its own attribution there from the constructor, and the shape/route
  card docks above it at `right-2 bottom-9`. Bottom-left is the only empty ground, so the
  stack lands there and `map-hint-bar.tsx` / `selection-bar.tsx` carry `ps-12` to centre
  their pill in what is left. Logical `ps`, not `pl`, so an RTL host moves the gap with it.
- **The dashboard gets the zoom stack and nothing else.** Locate, fullscreen and the scale
  ruler were all built and all removed: on the dashboard they are furniture over a map the
  owner is *editing*, and the corner is worth more than they are. `showCompass` is the one
  thing that varies — the editor asks for it, and the three small maps on this same canvas
  (the pin field, the import review map, the Analytics heatmap) take the bare zoom pair,
  because a third button on a 160px map is clutter. **The embed is untouched and still offers
  all of them**, since there the visitor is only looking; that choice lives in
  `SnapshotSettings` and `components/publish/design-sidebar/map-controls-group.tsx`.

### Verifying a map in the browser

- **A full-page DevTools screenshot renders an *idle* MapLibre canvas as blank.** MapLibre
  runs with `preserveDrawingBuffer: false`, so once the map reaches `idle` there is no
  preserved buffer for the capture path to composite, and the frame comes back showing the
  frame's own `bg-surface-secondary` — with the DOM, the canvas dimensions, the WebGL context
  and even the pin marker all measurably correct. This cost most of a session: it was read as
  a regression, bisected against a moving tree, and "confirmed" only because the working arm
  happened to be captured mid-render on a cold tile cache.
  **Screenshot the element, not the page** (`take_screenshot` with a `uid`, which forces a
  fresh composite of that subtree), or count frames — `map.on("render")` to `idle` — and
  believe that over the picture.

### Surfaces

- **The locations table and the import wizard sit *on* the page, not on a panel.** Neither
  has a background, a border or a radius of its own: `place-table.tsx` draws `border-t`
  hairlines and nothing else, and all four import steps lost their `SectionPanel`. The rule
  is one ground per screen — a `SectionPanel` on a grey page holding a
  `bg-surface-secondary` block is three grounds, and the innermost of them (96%) is
  *darker* than the page it is echoing (97.5%).
- **A sticky cell inside those screens is `bg-background`, never `bg-surface`.** It has to
  be opaque or rows slide visibly under it, so it must name a colour — and with no white
  panel around the step, the colour is the page's. `bg-surface` there is the elevation
  system pointing the wrong way. See `column-table.tsx`.
- A **frame** is still allowed where the box is a scroll region or a map — the Columns
  table's scroller and the Review step's map keep `rounded-xl border border-border`. A
  *section* does not get one.
- **A control must not resize itself as a side effect of being used.** `Tags · 3` and
  `Showing 4 locations need attention` both grew when pressed and shoved the toolbar around
  — which is what pushed that row onto two lines. State is told by the variant plus
  `aria-pressed` (or, for a popover trigger that already owns `aria-expanded`, by `sr-only`
  text, because a button claiming both is announced as two controls). Measured: the label
  span is `position: absolute` and costs 0px, and `button--secondary` and `button--tertiary`
  are the same width. A 3% width difference while measuring is the press animation's
  `scale(0.97)`, not layout.
- **The primary action of a step goes above a long list, not under it.** Columns puts
  Continue on the header-row line and Review puts Import beside its summary. A footer under
  a three-thousand-row table is several screens from the thing it acts on. The warnings that
  *disable* Continue moved up with it — the rule was always "between the evidence and the
  button", and the button moved.

### Import

- `lib/import/` reads CSV, XLSX, XML and Google Sheets; every source adapter returns the
  same `SourceTable`. XML builds its own header row; CSV and XLSX leave it to
  `detect/header-row.ts`, which **walks down and takes the first plausible row** rather than
  scoring every row — scoring made row 2 beat row 1 whenever row 1 had partial type-contrast,
  which is undiagnosable from the symptom.
- Detection combines what a column is **called** (`detect/synonyms.ts`, accent-folded, six
  languages) and what it **contains** (`detect/value-signals.ts`). The rule keeping it honest
  is in `detect/score.ts`: **only `SELF_EVIDENT` fields may be assigned on values alone.**
  Name, address, city, state and postcode all look like "short text", so the header has to
  agree or the field is left blank and the mapping step asks.
- `DetectionResult.byHeader` carries the scoring work back to the UI so the picker can rank
  itself. That index is held separately from `detection` and is **deliberately not cleared**
  when the user answers a column — it describes the file, not our guess.
- The XLSX reader is ours: an .xlsx is a ZIP of XML and `fflate` was already in the tree.

### Large imports

- **A run survives the page.** `import-store.ts` persists to IndexedDB via
  `import-persist.ts`; `attachTo` decides on mount whether what came back belongs to this
  map and is younger than `RUN_MAX_AGE_MS`. Resuming needs no special path because
  `draftsNeedingGeocode` only ever returns rows still `pending`.
- **Discarding is a delete, not an update.** `reset()` alone only *schedules* a debounced
  write, so Start over followed by a navigation left the old run on disk and the wizard
  offered it again. `startOver` calls `persist.clearStorage()`, whose `removeItem` cancels
  the queued write first. Everything else may be eventually-consistent; this may not.
- **Writes are debounced (1500ms) and that is load-bearing**, not a nicety: `patchDraft`
  fires once per resolved address, so persisting each one would clone the whole run three
  thousand times. `loaded` is deliberately not persisted — it is the raw grid, it roughly
  doubles the clone, and re-picking a header row happens in the first seconds of a flow
  while resuming happens ten minutes in.
- **One bad chunk must not end the run.** `geocode-run.ts` gives a chunk three attempts with
  a jittered backoff (the server's `Retry-After` wins when it sends one), then marks just
  that chunk's rows failed and carries on; only `MAX_CONSECUTIVE_FAILURES` chunks in a row
  is an outage worth stopping for. Nothing retryable about a 403 or a 422 — asking again is
  three times the requests for the same refusal.
- **Rows sharing an address cost one lookup.** `geocode-plan.ts` folds them and the answer
  is fanned back out per row *through `patchDraft`*, so each row still derives its own
  issues. Normalisation is whitespace and case only: folding "St" into "Street" would merge
  two addresses the geocoder itself distinguishes, and a wrong merge writes one building's
  coordinates onto another's row with nothing flagged.
- **A landed commit chunk stops being a draft.** Without that, a run that failed on chunk
  eight of fifteen wrote the first fourteen hundred rows *again* on the next press, and
  nothing in the flow said so.
- The plan check on `geocode/batch` asserts against `runTotal`, not the chunk:
  `existing + 25 > limit` is false for almost every chunk of almost every file, so the old
  form let a whole file through and refused at insert time with every request spent.
- **`GEOAPIFY_MIN_INTERVAL_MS` defaults to 220ms, not 120ms.** 120ms is 8.3 requests a
  second and the free plan allows five — the pacing that existed to stay under the limit was
  over it. Still an open plan question: the free tier is 3,000 credits *per day*, so one
  full Pro-sized import spends the whole allowance (CLAUDE.md §12).

## Notes

**Import reads four formats and detects columns from the data, not just the headers.** `lib/import/` (was `lib/csv/` — the folder now parses XLSX and XML too). Every source adapter in `sources/` returns the same `SourceTable`: a raw grid plus a flag for whether it already knows its header row. XML sets that flag because it *builds* its header row — it finds the repeating record element and flattens each one into dotted columns (`address.street`) — while CSV and XLSX leave it to `detect/header-row.ts`, which walks down from row 0 and takes the first row that could plausibly be one. That walk is deliberately not a "score every row and take the best": scoring made the *second* row of an ordinary file beat the first whenever the first had partial type-contrast and the second had none, which is a bug you cannot diagnose from the symptom (every column named after your first location). The XLSX reader is ours — an .xlsx is a ZIP of XML, `fflate` was already in the tree via pmtiles, and the alternatives ship either unpatched advisories or a CDN-only tarball (§3).

Detection then combines two independent signals, and needs both because each alone is unreliable: what a column is *called* (`detect/synonyms.ts`, now six European languages, matched after accent-folding so "Straße" reaches "strasse") and what it *contains* (`detect/value-signals.ts`). Values are what make a `Column1..Column9` export importable at all. The rule that keeps this honest is in `detect/score.ts`: only `SELF_EVIDENT` fields — the ones with a real signature, like an email, a URL, or a longitude past ±90 — may be assigned on values alone. Name, address, city, state and postcode all look like "short text" or "short alphanumeric code", which equally describes an internal reference and a sales rep, so for those the header has to agree or we leave the field blank and *ask*. That asking is the mapping step itself (`mapping-step/`), which is the file laid out as a table with our reading written across the top: one picker per column, over that column's own real values, because "which one is longitude?" is unanswerable from column names that are already known to be useless. It replaced a modal that could only ask against those same useless names. Two things carry the uncertainty. `confidence-mark.tsx` puts one icon on the field title's own line — grey tick detected, amber tick likely, amber question mark guessed, red cross nothing matched — with the word kept in `sr-only` text, because dropping it leaves colour and shape as the only signal and colour alone fails for some readers. And the picker ranks itself: `detectColumns` scored every field against every column on the way to picking a winner, so `DetectionResult.byHeader` hands that working back to the UI and the two or three fields that actually fit come first, under a heading, ahead of the other eleven. That index is held in the store separately from `detection` and is deliberately *not* cleared when the user answers a column — it describes the file, not our guess, and clearing it would empty the ranking at the one moment someone is using it.

**Edit means the dialog, and only the dialog.** The Locations panel's row menu used to call `focusPlace` before `setEditingId`, so choosing Edit also selected the pin — drawing its card on the canvas *behind* the modal and flying the camera to something the user was about to stop looking at. Shapes had the same pair. Selecting is what clicking the row means; the menu item means what it says, and both dialogs carry their own view of the thing being edited.

**Exactly one element in the editor has a real height, and everything below it depends on that.** From `<body>` down to the locations list, every step of the layout is `min-h-*` or `flex-1` — a floor or a ratio, never a ceiling — and a percentage flex-basis against an indefinite parent resolves to `content`. So the panel's `overflow-y: auto` sat on a box that always grew to fit: adding a location scrolled the *page* rather than the list, and stretched the map taller on the way. `lg:h-[calc(100dvh-3rem)]` on the editor row in `map-editor.tsx` is the one definite height, and the 3rem is `Container`'s own `py-6` — at `lg` there is nothing else above it, since `MobileHeader` is `md:hidden` and `PageTitle` is `sr-only`. Below `lg` the row stacks and the panel caps itself at `max-h-[60dvh]` instead. `app/(dashboard)/maps/[id]/(editor)/loading.tsx` repeats all three strings verbatim and has to keep doing so. The panel scrolls with no visible scrollbar because `ScrollShadow` already had `hideScrollBar`; that was never the missing piece.

A real scroller then created a gap the growing one hid: a drop target can now be off screen, and the drag deliberately `preventDefault`s every `pointermove` so it will never scroll there by itself. `lib/map/edge-autoscroll.ts` pulls the container when the pointer nears an edge — in `lib/` because, like `drop-action.ts`, it is the part of the gesture decidable without a pointer, and so the part worth testing. The same file's arrival is why rows are `touch-action: pan-y` rather than `none` — `none` gave every finger swipe to the drag, which was survivable only while the page scrolled instead. Touch now decides by stillness: movement first is a scroll and the gesture is dropped, 250ms of stillness starts a drag. That ordering is not cosmetic. The browser commits to a pan once the finger travels and ignores `preventDefault` after that, so a drag has to begin from a finger that has not moved, which is the only moment the gesture is still ours to claim.

**That pull had no horizontal bound, and the card designer is where it showed.**
`update` took a `clientY` and nothing else, so the band was not a band but an
infinite horizontal strip: anything above `rect.top + 56` counted as "at the top
edge" of a panel the pointer might be nowhere near. A block dragged out of the
Blocks palette and across the card — which is the whole gesture, since the drop
target is never in the palette — sat inside that strip the entire time, and the
palette scrolled out from under it at up to 14px a frame. `update` takes an
optional `clientX` now and gives up when the pointer is outside the container's
own left and right; optional so the nine existing calls in
`edge-autoscroll.test.ts` still pass **unmodified**, which is what says the
vertical behaviour did not move. The Locations list had the same bug against the
map beside it and is fixed by the same line.

The palette also simply stops scrolling while a block is in the air
(`DesignerTabPanel`), because a wheel can still move it and a panel that shifts
mid-drag re-aims the drop at a row nobody chose. An **inline** `overflow-y:
hidden`, since it has to beat both HeroUI's `.scroll-shadow--vertical` and the
element's own `lg:overflow-y-auto`, and a media-query rule wins on source order
however the class list is written — and `hidden` rather than `clip`, which would
make the box a non-scroll-container, drop `scrollTop` to 0 and jump the palette
under the user's hand.

**Page width is three choices, not seven.** `Container` is `content` (unbounded — the map editor, which needs every pixel), `centered` (`max-w-5xl`, the locations table: things you read and fill in), or `narrow`. `Measure` is still the left-aligned readable column *inside* a full-width page. Switching between a map and its Locations tab does step sideways, and that is accepted rather than overlooked — the alternative was a full-width table or a narrower map. Every `loading.tsx` must pass the same `size` as its page, or the skeleton swap moves.

The import wizard is the one page that varies inside those three, and it has to: its Columns step is a table wider than any laptop and its Review step is a map, while its Source step is a dropzone and its Addresses step a progress bar. So the page is `content` and `import-wizard.tsx` caps itself per step (`isWide`), animating `max-width` between `max-w-5xl` and `max-w-full` — `max-w-full`, because `none` is not a length and will not interpolate. Its `loading.tsx` stands in for the Source step and must carry the same `mx-auto max-w-5xl`.

**A `loading.tsx` covers its segment's page *and every route below it*.** So the Locations skeleton was also the fallback for `places/import`, and clicking Import played two skeletons in a row, out of phase and neither shaped like what arrived. Each page that has routes beneath it therefore sits in a route group with its own skeleton — `maps/(list)`, `maps/[id]/(editor)`, `maps/[id]/places/(list)` — which is Next's documented fix and changes no URLs. Add a nested route under one of these and put it *outside* the group.


## The durable import job, not built

The client now survives a reload, a flaky chunk and a partial commit, and that is as far as
a browser-driven run goes. What it still cannot do is bound *spend*: `runTotal` is a number
the client chose, geocoding writes nothing, so the server cannot see how far an import has
already got, and a scripted caller can re-send chunks that each fit the headroom on their
own. The batch route's own docblock has said so since it was written.

The shape of the answer, when it is worth building — before signup is open to strangers, per
CLAUDE.md §12:

- An `importJobs` table: `userId`, `mapId`, `status`, `total`, `done`, `spent`,
  `createdAt`. One row per run, which is the durable per-user counter the current guard
  lacks.
- `POST /api/maps/[id]/import/jobs` creates one and returns its id; the plan check happens
  there, once, against the real total.
- A worker — the first thing `/functions` would hold (§5) — walks the rows and increments
  `done` and `spent`, so the count is the server's rather than the client's.
- `GET .../jobs/[jobId]` polls. The wizard's progress bar reads that instead of counting its
  own chunks.

What it buys beyond the counter: progress survives a closed *laptop*, not just a closed tab,
and an import can be picked up on another machine. What it costs: an Appwrite schema change,
a polling UI, and a cron or queue on a platform whose Hobby tier caps cron at once daily
(§12). Which is why the client hardening came first.
