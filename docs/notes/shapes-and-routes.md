# Shapes and routes — design notes

Moved out of CLAUDE.md on 2026-09-05 so that file stays cheap to load. Nothing here is
rewritten; it is the record of why this area is shaped as it is.

## Invariants

### Shapes

- Shapes are the one thing the editor draws as **style layers** rather than DOM markers
  (`components/map/shapes/`). **`setStyle` discards every source and layer**, and
  `use-maplibre.ts` calls it on every basemap or theme change — `use-shape-layers.ts`
  re-adds them on `styledata`. **This is the first thing to test after touching any of
  this.** Handles are DOM markers, so a drag inherits the pins' machinery.
- A drag paints through a preview channel that writes straight to the source; the PATCH
  fires once, on release.
- A circle is stored as a centre and a radius in metres and drawn as **64 points**
  (`packages/shared/shapes.ts`). MapLibre's `circle` layer sizes in pixels, so it would be
  a different distance at every zoom. It lives in `shared` because the preview panel draws
  the real embed beside the editor's canvas — 64 points in one and 32 in the other is two
  visibly different circles on one screen.
- `useMapAnchor` takes the shape's extent and pushes the card clear of it, clamped to the
  frame.

### Routes

- A route is **a line whose points came from an engine** — not a new entity, table, layer
  or byte in the embed. `LineGeometry.route` is optional; absent means hand-drawn, which
  is every line ever written, so it shipped with no migration and no republish.
- The engine runs **once, on commit**, behind `/api/maps/[id]/directions` → `lib/routing/`.
  A published route is plain coordinates, so a map with one costs a visitor nothing (§2).
- **`resolveGeometry` must not rubber-band a routed line** (`lib/map/line-endpoints.ts`).
  A routed line's **stops** rubber-band instead (`lib/map/route-staleness.ts`), and a stop
  past 25m marks the route stale. **Nothing recomputes on its own** — a pin drag must never
  reach a metered upstream.
- **Duration is baked; distance is not.** The embed sums a line's length from its own
  points; no arrangement of coordinates says how fast you may drive, so `durationS` is the
  one measurement that travels.
- **`draw-route` is an `EditorMode`, not a `ShapeKind`.** Making it a kind would earn it a
  fill layer, an Appwrite enum value and a second branch in every geometry switch.
- **Adding anything to `EditorMode` that is not a `ShapeKind` means auditing every
  `drawMode` read.** Five of them were silently false for the whole length of a route
  gesture: the `drawing-shapes` class that makes markers `pointer-events: none`, the
  crosshair cursor, the place card guard, `drawingRef` in `map-canvas-impl.tsx`, and
  `handleClick` in `use-shape-layers.ts`. They all ask an `isArmed` that names the tool now.
- **A stop is a location, and only a location.** A click on no pin adds nothing
  (`lib/map/route-stops.ts`, along with the already-last-stop and 25-stop-cap cases). Free
  waypoints still load and draw but are never produced again.
- **A click that adds nothing says so — once.** A miss on open ground and a click on a pin
  still being created both raise a toast (`onMissed` in `use-draw-route.ts`, written in
  `map-shapes.tsx`); the open-ground one fires once per gesture. The already-last-stop and
  the cap stay silent, because neither is something anybody can act on.
- **A stop never bonds to an optimistic place id.** A pin whose create is still in flight
  carries a `temp-` id that is swapped for the server's the moment it lands, and nothing
  rewrites a stop that already holds the old one. Refused in `use-draw-route.ts` rather than
  in `snapToPlace`, for the reason the unroutable refusal gives.
- A routed line has **no drag handles** — the engine's points are not ours to drag. The
  card's stop list is the grip (`route-stops-list.tsx`), and both its gestures go through
  one `routeThrough`, which is also Recalculate's.
- Removal is decided **per stop, not per route**: `removeStopAt` collapses consecutive
  repeats of the same location id before checking the floor of two, and returns null when
  nothing survives. It never collapses a free waypoint (legacy routes have no ids).
- **Recalculate is offered only when the route is stale** — same condition as the warning
  above it, `isRecalculating` included, or the button vanishes under the pointer.
- Everything being drawn is **dashed and thin**, through one draft channel (`draw` in
  `use-shape-layers.ts`): `ShapeProperties.draft`, `SHAPE_LINE_LAYER` filters it out,
  `SHAPE_DRAFT_LINE_LAYER` paints it. **A second layer, not a `case`** — a `case` puts
  every feature including saved shapes through the SDF line shader. `line-cap` is `butt`.
- `onStopsChange` is a third channel beside `onPreview`/`onDraw` so the breathing marks and
  the stop list cannot drift. The animation carries a static `scale(1.4)` under it, because
  `prefers-reduced-motion` cuts every animation to one pass.
- **A pin the engine cannot reach is refused before it is clicked.** `NoSegment` almost
  never fires (OSRM's snapping radius is unlimited — a point 60km out to sea routes
  happily), so the real test is the `nearest` service and `ROUTE_SNAP_MAX_DISTANCE_M`
  (2km, generous on purpose) in `lib/routing/routable.ts`. Both paths are kept.
- Three things ask: a **sweep** on arming (`lib/map/probe-order.ts`), a **hover** pre-warm,
  and a **check on click** that blocks until answered. The click check reads the boolean it
  was handed, **not `unroutableIds`**, which is one render behind at that moment.
- `useRoutability` holds verdicts in a ref *and* state, with one writer. `asked` is written
  before the request goes out, so it is not `answered`; failures and aborts must come back
  out of it. The sweep's cancellation token belongs to the **gesture**, not the call.
- The unroutable grey is written as `--pin-color`/`--pin-ring`/`--pin-icon-color` **on the
  pin's children**, because `setPinVars` writes those inline on the marker and inline wins
  on the element it is written on.
- **A marker is inert during a drawing gesture only because that rule is `!important`.**
  MapLibre's `Marker._onUp` sets `pointerEvents = "auto"` inline after any mousedown, so
  every pin ever clicked beat `.drawing-shapes .maplibregl-marker` permanently.
  `usePlaceMarkers` also takes `isArmed` and calls `setDraggable(false)`.
- **Routes are a paid feature**, enforced on both endpoints that reach the engine
  (`directions` and the `routable` sweep, the bigger spender). `PlanFeatureError` is its
  own error: a limit offers a delete *and* an upgrade, a gate offers only the upgrade.
- **A route is the second kind of parent in the Locations panel, and it owns no
  membership.** The stop list *is* the membership (`lib/map/sidebar-rows.ts`), so a
  route group needs no column, no cleanup when a stop goes, and no answer to "what
  if a pin is on two routes" — it is on both. Start and end are `stops[0]` and
  `stops[n-1]`, not fields.
- **One row per location.** A stop is drawn under its route and nowhere else — not
  in the loose run, and not in a group it was also put in by hand. Two rows for one
  location meant selection (which is keyed on the location) lit both, one of them in
  a group the click had nothing to do with. The group's count follows the same
  narrowing, so a header never promises a row it does not open onto.
- **A route opens the moment it is drawn, and only then.** `sidebarRows` takes a new
  route's stops out of the loose run and out of their groups, so connecting five pins with
  the route shut deletes five rows from the panel and leaves "· 5 stops" on a folded row.
  It is a move, and it has to read as one. Reasserted on arrival only — a route the owner
  folded stays folded.
- **A round trip lights the row that was pressed.** Selection is keyed on the location,
  and `stops[0]` and `stops[n-1]` can be the same one, so one id matched two rows and
  pressing Start lit End too. `isFirstVisit` on the row plus `lightsThisStop` in the
  Locations panel settle it: the pressed row wins, and with nothing pressed the first visit
  stands for the location.
- **A stop row draws the same label as every other location row.** `PlaceRowLabel` —
  address first, postcode and name under it — not `place.name`, which for a dropped pin is
  "Location 9". The canvas card's list agrees with it on the first line.
- **Every reordering gesture goes back through the engine, and `null` means "do
  nothing".** `lib/map/route-order.ts` returns null for a move that leaves the same
  route, which is what stops a drop back where it started spending a metered request
  (§12). Callers resolve the stops first, exactly as the card's × does, so a reorder
  on a stale route never re-commits stale coordinates.
- **`routeThrough` lives in `map-editor.tsx`, not in `MapShapes`.** The sidebar
  reorders routes and is a different component tree from the canvas; two copies of
  those four lines would be two chances to forget the profile.
- **A dotted outline is a `symbol` layer, not a dash pattern.** A zero-length dash
  under a round cap draws a circle *only at integer zooms* — see below.
- **A dotted layer must declare `text-size: 1`, and it is not about text.**
  MapLibre floors `symbol-spacing` at the icon image's own *raw* pixel width times
  `text-size / 24`; at the default 16 that is 21.3px, so every spacing this product
  asks for was silently replaced. `DOT_TEXT_SIZE` in `packages/shared/dot-line.ts`.
- **There is one dotted layer per integer stroke width**, because `symbol-spacing`
  is a layout property and cannot be data-driven. `SHAPE_DOTTED_LINE_LAYERS` in
  both renderers, and **every one of them belongs in the hit-test list** — leaving
  dotted out of the embed's list made a published dotted shape unclickable.
- **Symbols placed along a line do not hold their spacing between zoom levels**,
  and no expression can fix it: the layout runs once per tile at that tile's
  integer zoom and the tile is then scaled, so spacing on screen runs from the
  asked-for value to double it. `DOT_SPACING_RATIO` is tuned for the tight end.
- **Route-stop rows are the one place this panel is two levels deep.** `TreeRail`
  draws the ancestor's line with no elbow; `continues: false` draws a gap of the
  same width, because a rail running past the group's last member points at nothing.
- Geocoding's ceiling is asked **before the first lookup** (`assertPlaceHeadroom`, hoisted
  out of `createPlaces`), not after the last.
- The default engine is the **public OSRM demo server, development only**. `ROUTING_URL`
  must point elsewhere before a paying customer; `ROUTING_PROVIDER=geoapify` is the
  answer that needs no machine. Geoapify returns a `MultiLineString` per leg with the
  joint repeated, and has no `nearest` service — the probe asks its reverse geocoder for
  the nearest street instead.

## Notes

**The dots on a dotted route were eggs, and the spelling that fails is the one
the documentation recommends.** `line-dasharray: [0, 2]` with `line-cap: "round"`
— a cap on a zero-length dash — is how you dot a line in MapLibre, and it draws a
circle only at *integer* zooms. The dash pattern is an SDF texture sampled along
the line, and the shader anchors its horizontal scale to tile units, correcting
in 2× steps through the fromScale/toScale crossfade; between two zoom levels the
pattern is stretched along the line by up to ~1.41× while the dot's height stays
pinned to the real stroke width. Measured in the browser on a 6px route: round at
z15, a visible egg at z15.5, round again at z16. That is the whole bug, and it is
why it had never been caught — every screenshot taken at a round number looks
right.

A `symbol` layer has no such scale, so the dotted style is now an icon placed
along the line: `symbol-placement: "line"`, one SDF disc from
`packages/shared/dot-line.ts`, `icon-color: ["get", "color"]` so one image serves
every colour on the map, and `icon-size` data-driven off the feature's own width.
`icon-allow-overlap` and `icon-ignore-placement` are both on because this is not a
label — collision detection would drop dots wherever a route passes a place name,
and a dotted line with gaps in it reads as a line that stops. The image is shared
rather than per-renderer, because the publish preview draws the real embed bundle
against the same map the editor is drawing — two dot images that agree today is
exactly the drift `packages/shared` exists to prevent.

**Then the dots were reported as far too sparse, and the number in the source was
not the number on the screen.** The first version of this asked for a flat 14px,
on the reasoning that `symbol-spacing` is a *layout* property and so cannot be
data-driven — true, and it meant the spacing could not follow the stroke. What it
did not account for is that MapLibre then ignored the 14 as well. Two separate
mechanisms sit between the asked-for number and the drawn one, and both had to be
dealt with.

**The label-length floor, which is the whole of the reported bug.** `getAnchors`
refuses to place symbols closer together than the label they carry: if
`spacing − labelLength × boxScale < spacing / 4`, it replaces the spacing with
`labelLength × boxScale + spacing / 4`. For an icon-only symbol `labelLength` is
the image's **raw pixel width** — 32 here, `icon-size` ignored entirely — and
`boxScale` is `tilePixelRatio × text-size / 24`. At the default `text-size` of 16
that is 32 × 16/24 = 21.3px, so *every* spacing below about 28px came out as
`21.3 + asked/4`. Asking for 14 drew 24.8; asking for 6 drew 22.8. Measured in the
browser by reading the bucket's own `symbolInstances` on a 6px route at z17 —
anchors 365.5 tile units apart against a `tilePixelRatio` of 16. The layers now
declare `text-size: 1` (`DOT_TEXT_SIZE`), which puts the floor at 1.3px where
nothing can reach it; the same measurement then read 11.96px for a request of 12.
It is a layer with no text on it at all, so nothing else reads the property.

**The tile-scale swing, which is inherent and is not a bug.** A tile's symbols are
laid out once, in tile units, at that tile's integer zoom, and the tile is then
scaled — so the on-screen spacing is what was asked for at an integer zoom and up
to *twice* that just below the next one. Measured asking for 12px: 11.96 at z17,
17.0 at z17.5, 22.4 at z17.9, 12.0 again at z18. Layout properties are evaluated
at the bucket's zoom, which is that same integer, so a zoom expression cannot
correct it. `DOT_SPACING_RATIO` is therefore chosen for the *tight* end — 1.5
widths centre to centre, so half a dot of gap at an integer zoom opening to two —
rather than being right in the middle and sparse for most of a zoom level.

With the floor gone the spacing does follow the stroke after all, at the cost of
**one symbol layer per integer stroke width**: twelve of them, the whole range
`MIN_STROKE_WIDTH`..`MAX_STROKE_WIDTH`, each with its own constant
`symbol-spacing` and a filter (`dotWidthFilter`) matching that width. Exact match
rather than a handful of buckets, because twelve needs no argument about where a
boundary should sit, and a layer no shape on the map matches builds no bucket at
all. The filter rounds and clamps rather than comparing straight: an unmatched
feature is a dotted shape that draws *nothing*, which looks like one somebody
deleted. `MIN_STROKE_WIDTH` and `MAX_STROKE_WIDTH` moved into
`packages/shared/shapes.ts` for this — `lib/validation/shape.schema.ts`
re-exports them and is still the only thing that enforces them — because the
embed cannot import `/lib` and now needs to know how many layers there are.

**A dotted shape in a published map could not be clicked at all, and that was the
same commit's doing.** `embed/src/map.ts` hit-tests `OUTLINE_LAYERS`, and dotted
left that table when it stopped being a line layer — so the comment above the
query still promised all three markings while the query tested two. The twelve
symbol layers are listed there now. A zero-opacity line over the same geometry was
built first and then deleted: out of ~2,400 sample points on a 4px area edge and a
6px route at z15 it answered where the dots did not **zero** times with `TAP_SLOP`
applied and three times without, which is what the tight spacing buys, and the
embed has 0.2KB of headroom (§4) rather than bytes to spend on a layer that agrees
with the one above it.

**Routes became a container in the sidebar, and the membership was already
there.** `LineGeometry.route.stops` is ordered, is what the engine is re-sent, and
is what `routeThrough` rewrites — so making the route the parent of the pins it
connects needed no column, no migration and no cleanup pass. Dropping the route
into an ordinary group is already `dropAction`'s `join`; what is new is that the
stops then take that group's colour, which is the whole of "a sub-group recolours
its pins". `lib/map/group-colors.ts` is where that precedence lives now, and the
canvas, the PNG export and *publish* all read it.

The reorder gestures are a drag between two rows and two menu items, and the drag
needed no change to the shared pointer gesture. `components/groups/use-row-drag.ts`
hit-tests with `elementFromPoint` and hands a target only the payload — there is
no "which half of the row" in that contract, and the card designer shares the file.
Two absolutely-positioned halves per row, each its own registered target, answer
the same question with no change to it at all; they are `pointer-events: none`
until a stop of that same route is in the air.

**Shapes are the one thing the editor draws as style layers, and that has a trap.** A location is a DOM `Marker`; an *area* cannot be, so circles and polygons are a GeoJSON source with fill and line layers (`components/map/shapes/`) — the pattern that until now lived only in the embed. `setStyle`, which `use-maplibre.ts` calls on every basemap or theme change, discards every source and layer on the map. Pins survive it precisely because they are DOM; these do not, so `use-shape-layers.ts` re-adds them on `styledata`. That is the first thing to test after touching any of this. The handles *are* DOM markers, so a drag inherits the machinery the pins already use, and a drag paints through a preview channel that writes straight to the source — the PATCH fires once, on release.

**A circle is stored as a centre and a radius in metres, and drawn as 64 points.** MapLibre has no geographic circle: its `circle` layer sizes itself in pixels, so a 2km delivery radius drawn that way would be a different distance at every zoom. `packages/shared/shapes.ts` turns one into the other, and it lives there for the reason `darken-style.ts` does — the preview panel renders the real embed beside the editor's own canvas, so a ring of 64 points in one and 32 in the other would be two visibly different circles on one screen. The radius handle sits due east of the centre, which is also where a card anchored 22px from that centre used to land: `useMapAnchor` now takes the shape's extent and pushes the card clear of it, clamped so it never leaves the frame.

**A route is a line whose points came from an engine, and that is the whole
design.** `ShapeKind` already had `line` — an open path whose two ends bond to
locations by id — so a route is not a new entity, a new table, a new layer or a
new byte in the embed. `LineGeometry.route` is an optional block holding the
*stops* (2..25, each a location), the profile
and the drive time; absent means hand-drawn, which is every line ever written, so
this shipped with no migration and no republish. The engine runs **once**, on
commit, behind `/api/maps/[id]/directions` → `lib/routing/` (modelled on
`lib/geocoding/` down to the throttle, which it imports rather than copies). A
published route is plain coordinates, so a map with one costs a visitor exactly
what a map without one costs — §2, and the reason the feature can exist here at
all when the rival charges per view for it.

Three things about it are load-bearing.

**`resolveGeometry` must not rubber-band a routed line, and one line in
`lib/map/line-endpoints.ts` is what stops it.** A hand-drawn line's endpoint is a
*fallback* and the pin is the truth, which is what makes it follow a pin somebody
drags. A route's points follow real roads: overwriting point 0 with a pin two
streets away does not reroute anything, it draws a straight kink from the pin to
wherever the road geometry starts — on the canvas *and* in a snapshot that live
customer sites read forever. A routed line's **stops** rubber-band instead
(`lib/map/route-staleness.ts`), and a stop that has drifted past 25m marks the
route stale. Nothing recomputes on its own: a pin drag must never reach a metered
upstream, which is the shape of the cost §2 exists to keep out of the product.

**Duration is baked; distance is not.** The embed already sums a line's length
from its own points, and `embed/src/popup.ts` argues in place against shipping a
number beside the geometry it describes. No arrangement of coordinates says how
fast you may drive along them, so `durationS` is the one measurement that travels
— optional, omitted for a hand-drawn line, on the immutability rule every other
optional snapshot field follows. Total embed cost: three lines in the popup and a
`formatDuration` beside `formatDistance`, 0.2KB gzipped against 1.4KB of headroom.
That headroom is why "extend the line kind" was not merely the elegant option but
the only one that fit — a new source, layer or interaction branch would have
tripped `check-embed-size.mjs`.

**`draw-route` is an `EditorMode` and *not* a `ShapeKind`.** It saves as a line,
so making it a kind would earn it a fill layer, an Appwrite enum value and a
second line branch in every switch that reads geometry — and would arm the plain
line tool alongside it, handling every click twice. The gesture is
`use-draw-line.ts`'s with one change that carries the whole feature: **a stop is
a location, and only a location.** It bonds *every* stop rather than only the two
ends, and a click that lands on no pin adds nothing at all — `lib/map/route-stops.ts`
holds that rule along with the two other clicks that change nothing (the pin
that is already the last stop, which is the second half of every double-click,
and the 25-stop cap). Free waypoints were offered first and withdrawn on use: a
route through arbitrary ground looks like a route and is not one, because no pin
moving can ever make it stale and the card has nothing to call its stops. Rows
already holding one still load and still draw — `placeId` stays optional in
storage — they are simply never produced again. The tool lives inside the
existing Draw menu rather than on the toolbar, for the reason
`shape-tools-button.tsx` already gives about phones.

**`draw-route` not being a `ShapeKind` has a cost, and it is paid in every flag
derived from `drawMode`.** Four of them read the kind and so were silently false
for the whole length of a route gesture, and the symptom was one bug: *clicking a
pin did not add a stop.* `drawing-shapes` is the class that makes markers
`pointer-events: none`, and a pin is ~26px against a 12px snap radius — so every
click landed on the marker, opened that location's card and never reached the
map. Only clicks on empty ground became stops, which is exactly why the first
route anyone drew came out as "Waypoint, Waypoint". The other three: the
crosshair cursor, the place card that must not open over a gesture, and
`drawingRef` in `map-canvas-impl.tsx` — which let each route click fall through
to the browse-mode branch and select whatever shape lay under it. A fifth,
`handleClick` in `use-shape-layers.ts`, had no guard at all and selected a shape
on top of every drawing click, route or not. All of them now ask an `isArmed`
that names the route tool. **Adding anything to `EditorMode` that is not a
`ShapeKind` means auditing every `drawMode` read**, and the guards are worth
grepping for before the next one.

**A routed line has no drag handles, and the card's stop list is the grip
instead.** Same argument as `resolveGeometry`'s, one step further: if the engine's
points are not ours to rubber-band, they are not ours to drag either — a handle
would write a geometry the renderer and the publisher both decline to trust. So
`map-shapes.tsx` hands `useShapeHandles` a null shape for anything with a
`route`, and `route-stops-list.tsx` grew the two gestures that replace it. A row
flies the map to that stop (through `resolvedStops`, so a moved pin is found
where it moved to, and without selecting it — `selectPlace` would close the card
being read). Its × drops the stop and reroutes through the rest, down to a floor
of two. Both go through one `routeThrough`, which is also Recalculate's, so
neither can forget the profile.

Removal is decided **per stop, not per route**, and the round trip is why. A→B→A
is an ordinary delivery loop, and taking B out of it leaves A→A: nought metres,
and no × left to undo it with, since two stops is the floor. So `removeStopAt`
collapses consecutive repeats before checking that floor and returns null when
nothing survives — the middle × is simply not offered, and both ends still are.
It only ever collapses stops that name the *same location id*; a free waypoint is
always kept, because every waypoint on a legacy route has no id at all and
comparing on that alone would delete a stop nobody touched.

**Recalculate is offered only when the route is stale, and that is a §2 rule
wearing a UI costume.** It used to stand under every route's stop list; pressed
on a route nothing had moved on, it spent a metered request to be handed back the
geometry already on screen. So `route-summary.tsx` gates it on the same `isStale`
the warning above it reads — the message says what is wrong and the button is the
one thing that fixes it, which is why they now share a condition instead of each
having their own. `isRecalculating` is in that condition too: `onUpdateShape`
lands the new geometry before the request settles, so on staleness alone the
button would vanish out from under the pointer that was still watching its
spinner.

**Everything being drawn is dashed and thin, and it is one layer rather than one
rule per tool.** A draft carries `selected: true`, so the boldest outline on the
map was the one thing that had no row yet — and for a route it was worse than
loud, it was a lie: `use-draw-route.ts` draws a deliberately *straight* run
between stops because until the engine answers nobody knows where the roads go,
and a solid straight line reads as a worked-out route that drives through
buildings. `ShapeProperties` therefore carries `draft`, `SHAPE_LINE_LAYER`
filters it out, and `SHAPE_DRAFT_LINE_LAYER` paints it at width 2 with a `[2, 2]`
dash. Every tool paints through the one draft channel (`draw` in
`use-shape-layers.ts`), so circle, polygon, line and route all inherit it and a
new tool inherits it without being told. **A second layer and not a `case` on the
first**, even though `line-dasharray` is data-driven in maplibre-gl 6: a `case`
puts every feature in that layer through the SDF line shader, saved shapes
included, and those are drawn beside the real embed's copy of themselves in the
preview panel. `line-cap` is `butt` there — a round cap adds half a width at each
end of every dash and closes the gaps at this size.

**The pins a route has been drawn through breathe, and publishing that list is
the whole change.** `useDrawRoute` keeps `stops` as a local inside its effect;
`onPreview` strips every `placeId` on the way out (it feeds a GeoJSON source that
knows nothing about locations) and `onDraw` fires when the gesture is already
over. `onStopsChange` is the third channel, called from every assignment to
`stops` so the marks and the list cannot drift, and `map-canvas-impl.tsx` holds
the answer as state because it is the nearest component owning both the gesture
(`MapShapes`) and the markers (`usePlaceMarkers`) — the same shape as
`checkingId`, and for the same reason. The animation is infinite where the
ambient `.picking-pins` ripple is a bounded burst, and the difference is
`MAX_ROUTE_STOPS`: 25 elements against the 3,000 markers §6 allows. It also
carries a static `scale(1.4)` under the animation, because the blanket
`prefers-reduced-motion` rule cuts every animation to one 0.01ms pass and a state
told only in motion is told to nobody.

The default engine is the **public OSRM demo server, and it is development only**
— ~1 req/s, reselling forbidden, access withdrawable without notice, with
commercial users warned by name. Same trap as Nominatim (§12), same answer:
`ROUTING_URL`, self-host before a paying customer, `docs/self-hosting-routing.md`.
**`ROUTING_PROVIDER=geoapify` is the other answer, and the one that needs no
machine** — `lib/routing/geoapify.ts` behind the same `RouteProvider`, which is
what that interface has always been for. Two things about it are specific to
Geoapify rather than incidental. Its geometry is a `MultiLineString`, one
LineString per leg with the joint coordinate repeated, so the reader joins them;
and it has no `nearest` service, so the routability probe asks the reverse
geocoder for the nearest *street* instead — a slightly different question,
answered against a deliberately generous 2km threshold, which is why the two
indexes agreeing at the margins does not matter.
Only `car` is offered, because OSRM runs one process per profile and the demo
server serves driving alone; a picker that 400s is a broken control. (Geoapify
serves all three from one endpoint, so that reason lapses the moment
`ROUTING_PROVIDER` is set — the control is simply not built yet, and would have
to grey itself against OSRM.) The engine
is **not** credited anywhere: a line naming OSRM sat under the route summary and
was removed on request, so while the default endpoint is in use we are using that
server without the credit its policy asks for — an accepted debt that self-hosting
settles, recorded in `docs/self-hosting-routing.md` rather than left implicit.
OpenStreetMap attribution is untouched and non-negotiable (§12); it comes from
the tile source's TileJSON on every rendered map, which nothing in this feature
goes near.

**A pin the engine cannot reach is refused before it is clicked, and `NoSegment`
is not how you find one.** The obvious design — let the route fail, read OSRM's
`NoSegment` and blame the coordinate it names — is built (`noSegmentIndex` in
`lib/routing/osrm.ts`, carried to the client as `RouteOutcome.unreachableStop`)
and **almost never fires**, because OSRM's default snapping radius is unlimited.
Measured against the demo server: a point in the middle of the Baltic, 60km from
any land, routes happily — it snaps to the coast and returns a 73km drive. So the
failure this feature exists for is not a refusal at all, it is a *nonsense route*
drawn from a road the pin has nothing to do with, and nothing in the answer says
so. What actually distinguishes the two is OSRM's `nearest` service, which
reports how far the snap was: `lib/routing/routable.ts` holds the one number that
decides (`ROUTE_SNAP_MAX_DISTANCE_M`, 2km — generous on purpose, because a farm
shop up an unmapped track is a real customer's real location). `/api/maps/[id]/routable`
asks it, `use-routability.ts` remembers the answers for the session, and
`.picking-pins .map-pin--unroutable` draws the verdict. Both paths are kept: the
probe is what greys a pin *before* a click, and the `NoSegment` reader is what a
self-hosted engine passing `radiuses` would actually return.

**Which pins get asked about is three answers, not one, and the first version
had only the weakest of them.** Arming the tool asked about pins with *no
address* alone — a location the reverse geocoder found nothing within 300m of is
very often one with no road either — which is a sound argument and was still the
bug that killed the feature: every pin that arrives by geocode, search or import
has an address, so on a real map it asked about nothing and nothing ever greyed.
So: a **sweep** of every pin when the tool arms, address-less first and then
outward from the centre of the map, capped and ordered by `lib/map/probe-order.ts`;
the **hover** pre-warm, one pin at a time as the pointer settles; and a **check
on click**, which is the one that makes the rule true rather than likely. The
first two are races a deliberate click wins — the public engine answers one
coordinate a second and a click lands about 300ms after the pointer stops — so a
pin nobody has an answer for blocks its own click until there is one, and wears
`.map-pin--checking` while it waits. That check reads the boolean it was handed
and **not** `unroutableIds`, which is React state and is one render behind at
that exact moment.

Three more things about it. `useRoutability` holds its verdicts in a ref *and* in
state for that same reason, with one writer. `asked` is written before a request
goes out, so it is not the same thing as `answered` — reading it as one waved
through every pin a sweep was still holding — and anything a failure or an abort
leaves unanswered comes back out of it, or the next arming asks about nothing.
And the sweep's cancellation token belongs to the *gesture*, not to the call:
bumped from inside `probe` it would have every hovered pin cancel the sweep
greying the rest of the map.

A refused click is the one click in the route tool that *speaks*;
`route-stops.ts`'s three silent cases are still silent, and the refusal lives in
`use-draw-route.ts` above them so it stays that way. The grey itself is written
as `--pin-color`, `--pin-ring` and `--pin-icon-color` **on the pin's children**,
because `setPinVars` writes those same properties inline on the marker and inline
wins on the element it is written on; on `.map-pin__shape` and `.map-pin__dot`
they beat the inherited value instead. It replaced a `grayscale(1)` plus a fade,
which preserved luminance and left a white glyph white, and made a pin that could
not be clicked look faint rather than off.

**A marker is inert during a drawing gesture only because that rule is
`!important`.** `Marker._onUp` in maplibre-gl 6.2.0 ends with
`this._element.style.pointerEvents = "auto"`, and `_onUp` runs on the mouseup
after any mousedown inside a draggable marker — a plain click included. So every
pin the owner had ever clicked carried an inline declaration that beat
`.drawing-shapes .maplibregl-marker`, permanently. The symptom was the route tool
on a page that had been used: a freshly loaded map took every stop, and a pin
clicked once stopped taking them and started being grabbed instead. Second
instance of MapLibre writing a property inline in this file's way — the first is
the `opacity: 1` it writes on every marker, which is why the pin fades live on
the children too. `usePlaceMarkers` also takes an `isArmed` and both stops
selecting on a marker click and calls `setDraggable(false)`, so the behaviour
does not rest on a stylesheet alone.

**Two upstreams cost money per call, and a plan is what stands in front of both.**
Neither is in a visitor's path — both run on the dashboard, once, when an owner
imports or draws (§2) — so the exposure is bounded by what a *signed-up account*
can provoke, which makes it a §6 question rather than a §2 one. The two guards
are not symmetrical, because the two costs are not.

Geocoding already had a ceiling in the shape of the place limit, but it was
enforced at the wrong end: the batch route checked ownership alone, so a free map
with ten slots could walk a 500-row CSV through a shared instance and be refused
at the *insert*, having spent all 500 requests on an endpoint whose policy bans
exactly that. `assertPlaceHeadroom` was hoisted out of `createPlaces` for it, and
the batch route now asks before the first lookup instead of after the last. What
it does not close is a scripted caller re-sending chunks that each fit on their
own — geocoding writes nothing, so the server cannot see how far an import has
already got, and bounding that needs a per-user counter with somewhere durable to
live. Worth building before signup is open to strangers.

Routing had no ceiling at all and could not borrow one: a map with three pins can
be rerouted all afternoon, and arming the tool probes every pin besides. So
routes are a **paid feature** — `PLAN_FEATURES` beside `PLAN_LIMITS`, enforced on
both endpoints that reach the engine (`directions`, and the `routable` sweep,
which is the bigger spender of the two). The gate is the pricing decision and the
spend cap in one object. `PlanFeatureError` is its own error rather than a
`PlanLimitError` with a different noun, because the sentences differ in shape: a
limit offers a delete *and* an upgrade, a gate offers only the upgrade. The Draw
menu greys the Route row and says why rather than hiding it — a paid feature
invisible from the plan below it is one nobody upgrades for — and Recalculate
needs no separate handling, since `toastError` already renders the server's own
sentence verbatim.

## The round trip that selected two rows

A route's stop has no id of its own. The row key is `route:<shapeId>:<index>`, which is
correct and was never the problem; selection is the other half, and selection in this panel
is keyed on the **location**, because that is what the map, the marquee and the place card
all agree a selection is.

A round trip ends where it started. `stops[0].placeId === stops[n-1].placeId`, `from === to`,
and both rows are honest rows for one honest location. So one selected id matched two of
them, and pressing the row chipped **Start** lit the row chipped **End** as well — on a panel
where lighting a row is the whole of how you say "this one". Found on a real map: a four-stop
loop through three pins, `Location 9` at both ends.

The fix is not to key selection on the row. Clicking a stop selects the *location* — the
marker breathes, the card opens — and a selection that only the sidebar understood would
leave the map with nothing to highlight. So the location stays the selection and the panel
breaks the tie: `sidebarRows` marks each stop `isFirstVisit` (the first row on *that route*
naming *that* location), and `lightsThisStop` picks the pressed row when one was pressed here
and the first visit otherwise. A marquee, a click on the pin, a selection from anywhere else
lights exactly one row, and nothing had to learn about routes to do it.

The press carries the location id with it rather than a key alone, which is what makes it
self-expiring: select anything else and the id stops matching, so there is no state to clear
and no way for a stale press to light a row nobody chose. It is matched on the route too —
one location can be a stop on two routes, and a press on one says nothing about the other.

## Why the stops vanished, and why opening the route is the answer

"One row per location" is right and stays. What it cost was legibility at the one moment it
does the most work: drawing a route moves every pin it connects out of the loose run and out
of any group, and routes are shut by default, so the gesture's visible result was five rows
disappearing and a `· 5 stops` appearing on a row that was folded. Reported as the pins
having been deleted — and from outside, that is exactly what it looks like. The panel's own
header disagreed with it the whole time: nine locations counted, three rows drawn.

Opening the route on arrival turns the same change into a move you can watch. It is done from
the ids present at mount rather than by reasserting an open set, so a route that already
existed keeps the shut default and a route the owner folded stays folded — the effect fires
for shapes that appear *after* the panel did, which is exactly "just drawn". The seen-ids ref
is replaced rather than added to, because an optimistic shape id is swapped for the server's
on success and a set that only grew would hold every temporary id the session ever minted.
