@AGENTS.md

# CLAUDE.md

Project instructions. Read this fully before writing code.

---

## 0. Where the code actually is

**Weeks 1–3 of §10 are done.** On disk, of §5's layout: `/app`, `/lib`, `/components`, `/scripts`, `/embed`, `/packages/shared` exist. Still absent, and correctly so — they belong to Week 4: `/functions`, and `/app/(marketing)/for/[platform]` + `/pricing`.

What works end to end: email auth, map CRUD, the MapLibre editor (click or drag pins, save the current view as the default), the locations list with search and category filter, per-location editing with search-on-submit geocoding and photo upload, categories with colours, **custom pin icons**, **shapes — circles and polygons, with drag handles and their own cards**, map settings, **sixteen map looks with label and layer controls**, **importing from a CSV, an Excel .xlsx, an XML feed or a shared Google Sheet**, with column detection → a confirm-and-correct step → geocoding → a drag-to-fix review step → bulk insert, **publish → static snapshot, the embed bundle (clustering, popups, category filters, client-side search, find-nearest), the one-line embed snippet, and the domain allowlist**.

**Import reads four formats and detects columns from the data, not just the headers.** `lib/import/` (was `lib/csv/` — the folder now parses XLSX and XML too). Every source adapter in `sources/` returns the same `SourceTable`: a raw grid plus a flag for whether it already knows its header row. XML sets that flag because it *builds* its header row — it finds the repeating record element and flattens each one into dotted columns (`address.street`) — while CSV and XLSX leave it to `detect/header-row.ts`, which walks down from row 0 and takes the first row that could plausibly be one. That walk is deliberately not a "score every row and take the best": scoring made the *second* row of an ordinary file beat the first whenever the first had partial type-contrast and the second had none, which is a bug you cannot diagnose from the symptom (every column named after your first location). The XLSX reader is ours — an .xlsx is a ZIP of XML, `fflate` was already in the tree via pmtiles, and the alternatives ship either unpatched advisories or a CDN-only tarball (§3).

Detection then combines two independent signals, and needs both because each alone is unreliable: what a column is *called* (`detect/synonyms.ts`, now six European languages, matched after accent-folding so "Straße" reaches "strasse") and what it *contains* (`detect/value-signals.ts`). Values are what make a `Column1..Column9` export importable at all. The rule that keeps this honest is in `detect/score.ts`: only `SELF_EVIDENT` fields — the ones with a real signature, like an email, a URL, or a longitude past ±90 — may be assigned on values alone. Name, address, city, state and postcode all look like "short text" or "short alphanumeric code", which equally describes an internal reference and a sales rep, so for those the header has to agree or we leave the field blank and *ask*. That asking is the mapping step itself (`mapping-step/`), which is the file laid out as a table with our reading written across the top: one picker per column, over that column's own real values, because "which one is longitude?" is unanswerable from column names that are already known to be useless. It replaced a modal that could only ask against those same useless names. Two things carry the uncertainty. `confidence-mark.tsx` puts one icon on the field title's own line — grey tick detected, amber tick likely, amber question mark guessed, red cross nothing matched — with the word kept in `sr-only` text, because dropping it leaves colour and shape as the only signal and colour alone fails for some readers. And the picker ranks itself: `detectColumns` scored every field against every column on the way to picking a winner, so `DetectionResult.byHeader` hands that working back to the UI and the two or three fields that actually fit come first, under a heading, ahead of the other eleven. That index is held in the store separately from `detection` and is deliberately *not* cleared when the user answers a column — it describes the file, not our guess, and clearing it would empty the ranking at the one moment someone is using it.

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

**Pin icons are drawn twice, from one source.** A location carries its own `icon` (a string id, empty for a plain pin) while its *colour* still comes from its category. The geometry — the three body outlines, the six lucide glyphs, where a glyph sits inside each — lives in `packages/shared/pin-icons.ts`, because the two targets render it in genuinely different ways: the editor emits SVG and colours it with CSS custom properties (`components/map/pin-marker.ts`), the embed rasterises the same paths through Canvas2D and registers them as MapLibre images (`packages/shared/pin-raster.ts`). Not a `data:` URI and not an external sprite — a host page's CSP can block the first and the second is a request in the visitor's path (§2). Locations with no icon are still circle-layer dots in the embed; the symbol layer's filter is what keeps a place from getting both. `icon-allow-overlap` is on deliberately: symbol collision would silently hide a real location on a customer's site.

**A custom pin carries its own design, and every field of it is optional.** Beyond a colour and a glyph or logo, a `CustomPinIcon` may name a `shape` (circle, square, diamond), a `ringWidth`, a `ring` and `iconColor`, and a `size`. Absent means the default, and the defaults are the pin as it was before any of them existed — which is what lets this ship with no migration and no republish: rows written years apart and snapshots already live on customer sites all still parse and still draw what they drew. `usedPinIcons` in `lib/snapshot/build.ts` drops any field left at its default for the same reason it drops an empty `glyph`. Ring, glyph colour and size reach the dashboard's CSS as custom properties from `pinCssVars`, so the stylesheet's own fallback stays in charge of anything the pin didn't choose — which is what keeps an unstyled ring theme-aware where a stored `#ffffff` could not be. Whatever writes those onto a **recycled** element must clear what it doesn't set (`setPinVars` in `use-place-markers.ts`); markers outlive the pin they were drawn for. And `ResolvedPin.key` has to fold in every one of them — it is what `setPinIcon` diffs on, so a field missing from the key is a pin restyled in the studio that never changes on the canvas.

**The pin is centred on its coordinate, and that is load-bearing.** It was lucide's `map-pin` teardrop, which marks its position with its *tip* at (12, 21.8) — so every renderer carried a correction for that one number: the marker CSS nudged itself up 40.83%, the drag ghost hung 90.8% below the pointer, the embed cropped its canvas at the tip so the symbol layer could anchor `bottom`, and the popup offset assumed the whole pin sat above the point. A centred body marks its position with its middle, so all of those are gone and `icon-anchor` is `center`. All three shapes are centred, which is why adding them cost none of it back; if you ever add one whose anchor is not its centre, those five places are what you are signing up for. Each shape's glyph box and image circle are sized to its own inradius (a diamond holds less than a ball), and `inradiusOf`/`extentOf` exist so the tests hold every shape to that rather than trusting a hand-written path — which is also why the `d` strings are built from numbers instead of quoted. Pins wear the same ring everywhere now, including the dashboard's own tiles and list rows (`.pin-preview`): those are previews of a map pin, and a preview that drops the outline is previewing something that does not exist. On a white dialog the ring only reads because a drop shadow gives it an edge, so the two ship together.

**A group has no pin, and "Change pins" is why that holds.** A group is a name, a colour and an order; membership lives on the members, and *nothing about a group reaches a published snapshot*. So the group row's "Change pins" does not store an icon on the group — it writes each member's own `icon`, once, through `setGroupPin` in `groups.repository.ts`. That is a single `tablesDB.updateRows` scoped by `mapId` *and* `groupId`, not one PATCH per member the way `useAssignToGroup` does membership: a marquee is bounded by a drag box, a group is not, and §6 allows 3,000 locations in one. The trade is that a location added to the group afterwards keeps its own pin, which is the honest consequence of a group not being a thing pins are stored on. Shapes are untouched — a shape wears a colour, not a pin — so the menu item is omitted rather than disabled for a group holding only shapes.

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
Only `car` is offered, because OSRM runs one process per profile and the demo
server serves driving alone; a picker that 400s is a broken control. The engine
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

**The card designer is switched off, and `lib/card/designer-status.ts` is the one
switch.** It is unfinished, and what it stores is read by the editor's popup, the
preview panel and every published snapshot — so an unfinished tool is not a page
nobody has opened, it is what a visitor to a customer's site sees.
`effectiveCardLayout` returns `defaultCardLayout()` while `CARD_DESIGNER_ENABLED`
is false, which `buildSnapshot` then omits from the snapshot entirely, so the
embed falls back to its own copy and the two agree by construction. The PATCH is
refused server-side as well: a disabled control is a courtesy, not a guarantee.
The page stays reachable behind an Alert, because seeing what the blocks do is
most of what it is for.

That promoted the default from "what you get before you design anything" to "the
card", so it grew into the job: `description` and `hours` came out of the fold
onto the card itself, leaving only the map's extra fields behind "More details".
The bytes in `card-layout.test.ts` moved with it, deliberately — that string is
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

**Exactly one element in the editor has a real height, and everything below it depends on that.** From `<body>` down to the locations list, every step of the layout is `min-h-*` or `flex-1` — a floor or a ratio, never a ceiling — and a percentage flex-basis against an indefinite parent resolves to `content`. So the panel's `overflow-y: auto` sat on a box that always grew to fit: adding a location scrolled the *page* rather than the list, and stretched the map taller on the way. `lg:h-[calc(100dvh-3rem)]` on the editor row in `map-editor.tsx` is the one definite height, and the 3rem is `Container`'s own `py-6` — at `lg` there is nothing else above it, since `MobileHeader` is `md:hidden` and `PageTitle` is `sr-only`. Below `lg` the row stacks and the panel caps itself at `max-h-[60dvh]` instead. `app/(dashboard)/maps/[id]/(editor)/loading.tsx` repeats all three strings verbatim and has to keep doing so. The panel scrolls with no visible scrollbar because `ScrollShadow` already had `hideScrollBar`; that was never the missing piece.

A real scroller then created a gap the growing one hid: a drop target can now be off screen, and the drag deliberately `preventDefault`s every `pointermove` so it will never scroll there by itself. `lib/map/edge-autoscroll.ts` pulls the container when the pointer nears an edge — in `lib/` because, like `drop-action.ts`, it is the part of the gesture decidable without a pointer, and so the part worth testing. The same file's arrival is why rows are `touch-action: pan-y` rather than `none` — `none` gave every finger swipe to the drag, which was survivable only while the page scrolled instead. Touch now decides by stillness: movement first is a scroll and the gesture is dropped, 250ms of stillness starts a drag. That ordering is not cosmetic. The browser commits to a pan once the finger travels and ignores `preventDefault` after that, so a drag has to begin from a finger that has not moved, which is the only moment the gesture is still ours to claim.

**Page width is three choices, not seven.** `Container` is `content` (unbounded — the map editor, which needs every pixel), `centered` (`max-w-5xl`, the locations table: things you read and fill in), or `narrow`. `Measure` is still the left-aligned readable column *inside* a full-width page. Switching between a map and its Locations tab does step sideways, and that is accepted rather than overlooked — the alternative was a full-width table or a narrower map. Every `loading.tsx` must pass the same `size` as its page, or the skeleton swap moves.

The import wizard is the one page that varies inside those three, and it has to: its Columns step is a table wider than any laptop and its Review step is a map, while its Source step is a dropzone and its Addresses step a progress bar. So the page is `content` and `import-wizard.tsx` caps itself per step (`isWide`), animating `max-width` between `max-w-5xl` and `max-w-full` — `max-w-full`, because `none` is not a length and will not interpolate. Its `loading.tsx` stands in for the Source step and must carry the same `mx-auto max-w-5xl`.

**A `loading.tsx` covers its segment's page *and every route below it*.** So the Locations skeleton was also the fallback for `places/import`, and clicking Import played two skeletons in a row, out of phase and neither shaped like what arrived. Each page that has routes beneath it therefore sits in a route group with its own skeleton — `maps/(list)`, `maps/[id]/(editor)`, `maps/[id]/places/(list)` — which is Next's documented fix and changes no URLs. Add a nested route under one of these and put it *outside* the group.

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

Also built, out of order and knowingly: **routes** (see below). §11 listed routing as out of scope for v1 and §10 says Week 4 is next; that call was made deliberately, against a rival shipping the feature, and is recorded here rather than quietly overriding either section.

Not built yet, and next: everything in Week 4 — pricing page, plan-limit UI, MoR billing + webhook, the PMTiles archive itself on R2 (the code is ready; see above), landing page, one platform page, docs, transactional email.

Installed since the original scaffold: `zod`, `@tanstack/react-query`, `zustand`, `papaparse`, `date-fns`, `vitest`, `vite`, `fflate` (promoted from a pmtiles transitive — it unzips .xlsx), and `jsdom` as a devDependency only (see Tests).
Still not installed, from §3's "Add these": biome, playwright, sentry, posthog, resend.

### Commands

```
npm run dev          # next dev
npm run build        # builds the embed first (prebuild), then next build
npm run check        # typecheck + lint + tests — run this before calling work done
npm run typecheck    # next typegen && tsc --noEmit
npm run lint         # eslint
npm run test         # vitest run
npm run build:embed  # vite build → public/embed, copy MapLibre runtime, check size
npm run setup:appwrite  # create missing tables/columns/indexes from scripts/appwrite-schema.mjs

npm run build:tile-styles -- https://tiles.example.com   # our own five style documents
npm run mirror:tile-assets      # fonts, sprites, Natural Earth raster -> public/tiles/ (414MB)
npm run migrate:style-host      # move published snapshots to the current tile host
```

`npm run check` does **not** build the embed. After changing anything under `/embed`, run `npm run build:embed` too — that is where the size budget is enforced.

**Testing the embed by hand:** `npm run build:embed`, start the dev server, open
`/embed/dev.html`. It renders the real bundle against a fixture snapshot with no
Appwrite, login or publish involved. Source is `embed/dev/`, committed; Vite's
`publicDir` copies it into the gitignored build output, so it never deploys.

Linting is **ESLint flat config** (`eslint.config.mjs`, `eslint-config-next` core-web-vitals + typescript), not Biome. §3 chooses Biome; when you migrate, swap the `lint` script and delete the ESLint config. Until then `npm run lint` is the check.

Two lint rules bite repeatedly, and both are right:
- **No JSX inside a `try`/`catch`.** React renders children after the handler returns, so the catch never fires. Fetch inside the try, assign to a `let`, return JSX after it — see `app/(dashboard)/maps/[id]/settings/page.tsx`.
- **No `watch()` from react-hook-form.** It returns a fresh function each render, so the React Compiler opts the whole component out of memoization. Use `useWatch({ control, name })`.

Tests are `vitest` (`vitest.config.mts`), unit only, `lib/**/*.test.ts` and `packages/**/*.test.ts`. Single file: `npx vitest run lib/import/detect/score.test.ts`. Covered per §9: import column detection, geocode result handling, plan-limit enforcement. The default environment is `node`; the few files touching `DOMParser` or `File` opt in with a `// @vitest-environment jsdom` docblock. **jsdom, not happy-dom** — happy-dom's XML parser rejects CDATA outright, and store-locator feeds wrap names in it constantly, so it cannot tell us whether the XML source works. `lib/import/pipeline.test.ts` runs bytes-to-drafts over realistically-shaped files; it is the one that catches seam bugs the per-stage tests each miss. Snapshot generation is untested because it doesn't exist yet — add it with Week 3. `server-only` is aliased to a stub (`lib/test/server-only-stub.ts`) so repositories can be tested; the real guard still applies to every Next build.

### Stack specifics that change how you write code

- **Next.js 16.3.** Breaking changes against older App Router knowledge — read `node_modules/next/dist/docs/` before writing route, layout, or caching code (AGENTS.md says the same). Typed route props are globals: `LayoutProps<"/">`, `PageProps<"/maps/[id]">`. Don't hand-write `params` types; `app/layout.tsx` already uses the global form.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.js` and none should be added. `app/globals.css` does `@import "tailwindcss"` then `@import "@heroui/styles"`; the theme is oklch CSS variables under `:root/.light` and `.dark`. Restyle by editing those variables, not by hardcoding colours in components.
- **HeroUI v3** is React Aria under the hood and has a different API from v2. Don't write v2 component code from memory. One consequence bites hard: React Aria owns an input's value, so react-hook-form's `register()` **silently does not work** — a prefilled form renders blank and then saves the blanks. Always bind through `components/ui/form-field.tsx` (`FormTextField` / `FormTextArea`), which wire `Controller` to the TextField's own `value`/`onChange`. The same ownership bites a second way: `usePress` — every HeroUI `Button` — ends its `onPointerDown` with `stopPropagation()`, and React dispatches synthetic events from its root, so **a pointer handler on a wrapper around a Button never fires in the bubble phase**. It fails silently, with no error. Bind it as `onPointerDownCapture` instead; `components/map/add-location/use-drag-to-add.ts` is the working example.
- **MapLibre's worker must be told where it lives.** MapLibre v6 derives its worker URL from `import.meta.url`, bails to `""` when that isn't an http(s) URL (which it isn't under Turbopack), and then constructs `new Worker("")` — loading the HTML page as the worker script. The worker never replies, and because vector tiles are fetched *inside* the worker, every map renders as an empty background with **no error in the console**. `scripts/copy-maplibre-worker.mjs` (via `predev`/`prebuild`) copies the worker into `public/maplibre/`, and `lib/map/worker.ts` sets `config.WORKER_URL`. A blank basemap? Check `public/maplibre/` exists before anything else.
- **The embed is an ES module, and that is forced.** MapLibre v6 ships ESM only — no UMD, no CSP build. So the snippet is `<script type="module">`, `document.currentScript` is always null (the boot code finds its script tag by `[data-snapshot]` instead), and both `/embed` and `/maplibre` need CORS headers, because module scripts and MapLibre's cross-origin worker blob are both CORS fetches. `next.config.ts` sets them.
- **MapLibre is external to the embed bundle, deliberately.** Bundling it inlines `maplibre-gl-shared.mjs`, and the worker then downloads its own copy of the same 131KB chunk — measured at 424KB gzipped total. Shipping MapLibre's dist files beside `map.js` lets the main thread and the worker share one URL: 311.9KB. Don't "simplify" this by removing `external` from `embed/vite.config.mts`.
- **§4's 250KB budget is not reachable and the check knows it.** MapLibre v6 alone is 273.2KB gzipped. `scripts/check-embed-size.mjs` therefore budgets *our* code (40KB, currently 38.8KB) and puts a 320KB ceiling on the total to catch the duplication regression above. See §4.
- **Snapshots are written twice per publish.** An immutable timestamped archive, plus one live file at a fixed id that the embed actually reads. The embed's URL has to be stable across republishes or every customer would re-paste their snippet, and §2 forbids asking us which snapshot is current. `lib/snapshot/storage.ts` explains the delete-then-create window and why the embed retries once.
- Vendored skills in `.agents/skills/`, pinned by `skills-lock.json`: `heroui-react`, `appwrite-typescript`, `next-cache-components-optimizer`. Use them instead of recalling API shapes.

### Environment

`.env` is gitignored and there is no `.env.example`. Names in use:

- Browser-safe: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`
- Server-only: `APPWRITE_API_KEY`, `DATABASE_ID`, `STORAGE_ID` — unprefixed deliberately. These must never reach a client component or the embed bundle (§9).
- Optional, all server-only, all defaulted: `GEOCODER_URL` (defaults to the public Photon instance), `GEOCODER_MIN_INTERVAL_MS` (defaults to 1000, and now spaces request *starts* rather than waiting for each round trip to finish — see `lib/geocoding/throttle.ts`) and `GEOCODER_USER_AGENT`. Point the first at a self-hosted Photon and lower the second before any real import volume. The third exists because public OSM-derived services block unidentified clients and Node's default UA is exactly that: a 403 from a WAF is otherwise indistinguishable from the service being down, and both arrive as a 502.
- Optional, all server-only, all defaulted: `ROUTING_URL` (defaults to the public OSRM demo server), `ROUTING_MIN_INTERVAL_MS` (defaults to 1000) and `ROUTING_USER_AGENT`. Exactly the geocoder's three, for exactly the geocoder's reasons — and with a sharper deadline: the demo server's terms forbid reselling access and warn that it can be withdrawn without notice, so `ROUTING_URL` has to point somewhere of our own before the first paying customer. `docs/self-hosting-routing.md` is the runbook, including why Valhalla beats OSRM the moment coverage goes past one country. Nothing published moves when this changes — a route's geometry is baked at draw time, which is the whole feature.
- Optional, server-only: `SNAPSHOT_STORAGE_ID`, defaulting to `STORAGE_ID`. **Appwrite Cloud's free plan allows one bucket per project**, so published snapshots share the assets bucket, which is why `json` is in its allowed extensions. On a paid plan, point this at a dedicated bucket and add a second entry to `BUCKETS` in `scripts/appwrite-schema.mjs`; nothing else changes.
- Optional, browser-safe: `NEXT_PUBLIC_TILES_URL`. Where the basemaps are served from. **Unset means OpenFreeMap and is the current state**; setting it moves `STYLE_URLS` *and* the attribution together, because both come from one pair in `lib/map/style.ts`. Changing it does not move maps that are already published — `styleUrl` is baked into each snapshot at publish time, which is what makes the switch a republish rather than a redeploy of every customer's embed. `npm run migrate:style-host` is what moves them, in either direction.
- Optional, browser-safe: `NEXT_PUBLIC_EMBED_SCRIPT_URL`. Set it to the CDN origin in production. Unset, the embed snippet points at the dashboard's own origin, which is what makes development and self-hosting work with no config.

`STORAGE_ID` never reaches the browser: photo URLs are composed on the server in `lib/storage/photo-url.ts` and handed to clients as `place.photoUrl`. If you need a bucket id in a component, that's the signal you're building it in the wrong layer.

---

## 1. What this project is

A web app where non-technical people build a custom interactive map of their locations and embed it on their own website with one line of code.

**Target customer:** a brand with 40–500 physical locations (stockists, dealers, venues, campuses) who wants them on a map on their site without hiring a developer.

**Core loop:** sign up → create a map → import places from CSV → style and categorise → publish → paste embed snippet into their site.

**Not in scope:** GIS analysis, routing/directions, layers, shapefiles, CMS page generation, mobile apps.

---

## 2. The one rule that governs everything

> **Nothing we pay for per request may run in the visitor's path.**

This is the entire business model. Competitors pay Google roughly $7 per 1,000 map loads and pass it on as metered pricing. We charge flat and unlimited because our per-view cost is ~zero.

**Concretely:**

- On **Publish**, generate a static JSON snapshot of the map and write it to CDN storage.
- The embed fetches that snapshot + static PMTiles. Nothing else.
- Appwrite serves the **dashboard only**. It must never be queried by a map visitor.
- Geocoding runs **once at import time**. Never at view time. Ever.

If a change would put a database query, an API call, or a serverless function into the visitor path, stop and flag it instead of implementing it.

---

## 3. Tech stack

### Already decided
| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript, `strict: true` |
| Backend | Appwrite (Auth, Databases, Storage, Functions) |
| UI | HeroUI |
| Styling | Tailwind CSS (required by HeroUI) |
| Forms | React Hook Form |
| Animation | Motion (`motion` package — the current name for Framer Motion) |

### Add these
| Purpose | Package | Why |
|---|---|---|
| Schema validation | `zod` + `@hookform/resolvers` | One schema validates form input, server actions, and CSV rows |
| Server state | `@tanstack/react-query` | Caching, optimistic updates, no hand-rolled loading state |
| Editor state | `zustand` | Map editor has lots of transient local state; Context will re-render too much |
| Map rendering | `maplibre-gl` | No API key, no per-view cost |
| Tile protocol | `pmtiles` | Registers the `pmtiles://` protocol with MapLibre |
| CSV parsing | `papaparse` | Handles messy real-world CSVs, streams large files |
| Appwrite (client) | `appwrite` | Browser SDK |
| Appwrite (server) | `node-appwrite` | Server actions and Functions |
| Billing | Paddle **or** Lemon Squeezy | Merchant of Record — handles EU VAT for us. **Not raw Stripe.** |
| Email | `resend` + `@react-email/components` | Transactional only |
| Errors | `@sentry/nextjs` | |
| Analytics | `posthog-js` | Funnel: signup → first place → publish → paid |
| Dates | `date-fns` | Opening-hours formatting |
| Embed build | `vite` | Separate build target, see §4 |
| Lint/format | `biome` | One tool, fast |
| Unit tests | `vitest` | |
| E2E | `@playwright/test` | Only for: signup, CSV import, publish, embed loads |

### Do not add
Redux, Prisma, tRPC, a UI kit other than HeroUI, Leaflet, Mapbox GL JS, `react-map-gl`, any Google Maps SDK, any ORM. Ask before adding anything not listed above.

---

## 4. Two build targets — do not merge them

This is the most important structural rule after §2.

**A. Dashboard** (`/app`) — Next.js, React, HeroUI, Motion. Bundle size doesn't matter much; only paying customers load it.

**B. Embed** (`/embed`) — a standalone vanilla TypeScript bundle built with Vite, served from CDN, loaded on strangers' websites.

The embed must **never** import React, HeroUI, Motion, TanStack Query, Zustand, or the Appwrite SDK. It gets MapLibre, pmtiles, and our own code. Nothing else.

Target: **under 250KB gzipped including MapLibre.** If a change pushes it over, flag it.

**Measured, that target is unreachable with MapLibre v6** — its own dist files are 273.2KB gzipped (`maplibre-gl.mjs` 136.4 + `maplibre-gl-shared.mjs` 131.0 + the worker 5.8), minified already, with no slim build. Actual total is **311.9KB**, of which ours is 38.8KB. `npm run build:embed` enforces a 40KB budget on our code and a 320KB ceiling on the total; it does not pretend 250KB is achievable. Getting under 250KB means changing the map library, which is a §3 decision — raise it rather than shaving our 38.8KB.

`/packages/shared` is the **only** directory both targets may import from. `@/lib`, `@/components` and `@/app` are closed to the embed, and `eslint.config.mjs` enforces both halves of that.

It started type-only. It now also holds a little runtime — `color.ts`, `darken-style.ts`, `load-style.ts`, `shapes.ts` — because the editor and the embed must run *the same* dark-basemap transform and turn a circle into *the same* ring of points, not two that agree today: the preview panel renders the real embed bundle beside the editor's own canvas, so any drift is two differently-coloured or differently-shaped maps on one screen. The condition for putting runtime here is **zero dependencies, vanilla TS**, since whatever this directory imports the embed inherits. ESLint holds `/packages/shared` to the embed's own import ban for exactly that reason. Anything needing a package belongs in `/lib`.

---

## 5. Project structure

```
/app                      Next.js App Router — dashboard + marketing
  /(marketing)            Public pages, statically rendered
    /page.tsx             Landing
    /for/[platform]       "Map for Webflow" etc. — one per platform
    /pricing
  /(dashboard)
    /maps
    /maps/[id]            Map editor
    /maps/[id]/places
    /maps/[id]/settings
    /account
  /api
    /webhooks/billing     MoR webhook → subscription state
/embed                    Vite build, vanilla TS, ships to CDN
  /src/index.ts
  /src/map.ts
  /src/filters.ts
  /src/search.ts
/lib
  /appwrite               Client + server SDK setup
  /repositories           ALL Appwrite access goes through here
  /geocoding              Provider-agnostic interface
  /snapshot               Publish → static JSON generator
  /validation             Zod schemas, shared by forms + server
/components
  /ui                     HeroUI wrappers, app-specific primitives
  /map                    Editor map canvas (client-only)
  /places                 List, import wizard, review step
/packages/shared          Imported by both targets — types, plus zero-dependency vanilla TS
/functions                Appwrite Functions (geocode queue, snapshot)
```

**Repository pattern is mandatory.** No component or route calls the Appwrite SDK directly. Everything goes through `/lib/repositories`. This keeps the database swappable and keeps query logic testable.

---

## 6. Data model (Appwrite)

Use plain `lat` / `lng` doubles, **not** spatial Point columns. Spatial types exist in Appwrite now, but "find nearest" runs client-side against the published snapshot, so a spatial index buys nothing and constrains self-hosting (geo-queries need MariaDB; MongoDB-backed self-hosted Appwrite doesn't support them).

### `maps`
`userId` · `name` · `slug` (unique) · `style` · `defaultLat` · `defaultLng` · `defaultZoom` · `categories` (JSON) · `settings` (JSON) · `appearance` (JSON) · `allowedDomains` (string[]) · `publishedAt` · `snapshotUrl`

`appearance` is the label level and the layer toggles. Its own column rather than another key
in `settings`, and the reason is mechanical: `settings` means "which of the embed's optional
controls are on", it belongs to the Publish tab's form, and `updateMap` writes it by
serialising the **whole** object — two forms writing one blob is a lost update, and the
appearance controls are on two screens at once. `style` stays where it is: still one choice
from one list, and moving it would orphan every map already saved. It is a `varchar(32)`, so
theme keys stay short.

### `places`
`mapId` · `name` · `lat` · `lng` · `address` · `category` · `description?` · `phone?` · `email?` · `url?` · `hours?` (JSON) · `photoId?` · `sortOrder` · `geocodeConfidence?` · `geocodeStatus` (`ok` | `low` | `failed` | `manual`)

### `shapes`
`mapId` · `name` · `kind` (`circle` | `polygon` | `line`) · `description?` · `color` · `opacity` · `geometry` (JSON) · `sortOrder`

A row per shape rather than JSON on the map, because a polygon ring is unbounded
text and dragging a vertex would otherwise rewrite the whole map document. `kind`
is the discriminator and lives only in that column; `geometry` holds the payload
alone (`{lng,lat,radius}` or `{points}`), so there is no second copy to disagree
with it. The domain type recombines them into the union in
`packages/shared/shapes.ts`.

### `subscriptions`
`userId` · `billingCustomerId` · `billingSubscriptionId` · `plan` · `status` · `currentPeriodEnd`

Provider-neutral field names — do not name them after Paddle or Stripe.

### Plan limits
| Plan | Maps | Places/map | Shapes/map | Views |
|---|---|---|---|---|
| Free | 1 | 10 | 3 | unlimited (badge shown) |
| Starter €19 | 3 | 300 | 50 | unlimited |
| Pro €39 | 15 | 3,000 | 250 | unlimited |

Enforce limits **server-side** in repositories, never only in the UI.

---

## 7. Critical implementation notes

**MapLibre cannot server-render.** Always `dynamic(() => import(...), { ssr: false })`. It touches `window` at module load.

**Register the pmtiles protocol once**, at app init, not per component mount.

**Appwrite pagination defaults to 25 documents.** Any place list must use cursor pagination. A 500-place map is 20 requests — batch it in a repository method, don't scatter calls through components.

**Geocoding is provider-agnostic.** `/lib/geocoding` exports one interface; implementations sit behind it. We may swap between hosted providers and a self-hosted Photon instance. Never import a provider SDK outside that folder.

**Never save geocode results silently.** After import, show a review step: results on a map, low-confidence rows flagged, drag-to-fix. Set `geocodeStatus` accordingly.

**Autocomplete is not in v1.** Use search-on-submit — user types a full address, presses enter, picks from 3–5 results. One request instead of ten.

**Domain allowlist** is enforced in the embed against the snapshot's `allowedDomains`. It's anti-abuse, not security — don't pretend otherwise.

**Snapshots are immutable and versioned.** Write to `snapshots/{mapId}/{timestamp}.json`, then update `snapshotUrl`. Never overwrite in place — a half-written file would break live customer sites.

**Tiles:** point at OpenFreeMap's public instance in development. Before any paying customer, switch to our own PMTiles extract on Cloudflare R2. Public instances carry no uptime guarantee.

**Motion must not run in the embed.** Editor animations only.

---

## 8. UI and copy conventions

HeroUI defaults are the starting point, not the destination. Pick a type pairing and an accent that aren't the stock palette, and keep the rest quiet.

**Motion is for feedback, not decoration.** Import success, publish confirmation, pin drop. Respect `prefers-reduced-motion` everywhere. If an animation doesn't tell the user something happened, remove it.

**Copy rules:**
- Name things by what the user controls, never by how the system works. "Locations", not "documents". "Categories", not "enums".
- Active voice on every control. "Publish", "Import places", "Save changes" — never "Submit".
- An action keeps its name through the whole flow: the button says **Publish**, the toast says **Published**.
- Errors state what happened and how to fix it. Not "Something went wrong" — "Couldn't read row 42: no address column found. Map your columns and try again."
- Empty states are invitations to act, with the primary action right there.
- Sentence case. No filler.

**Quality floor, unannounced:** responsive to mobile, visible keyboard focus, reduced motion respected, forms usable with a keyboard alone.

---

## 9. Working conventions

- Server Actions for mutations; Route Handlers only for webhooks and public endpoints.
- Zod schema per feature in `/lib/validation`, used by both React Hook Form and the server action. Never validate only on the client.
- Every Appwrite call is wrapped in a repository method with an explicit return type.
- Appwrite secrets are server-only. The browser SDK gets the public endpoint and project ID, nothing else.
- Feature branches, conventional commits.
- Write tests for: CSV column mapping, geocode result handling, plan-limit enforcement, snapshot generation. Skip tests for UI layout.

---

## 10. Build order

Do not start a phase before the previous one works end to end.

**Week 1 — Skeleton. ✅ Done.** Next.js + Appwrite + auth. Map CRUD. MapLibre canvas rendering OpenFreeMap. Click to drop a pin, persist it, survive a refresh.

**Week 2 — Editor. ✅ Done.** Place list with add/edit/delete. CSV import with column mapping. Geocoding + review step. Categories with colours. Map settings. Photo upload.

**Week 3 — Embed. ✅ Done.** Publish → snapshot generation. Vite embed bundle. Popups, category filters, search, find-nearest, clustering. Embed code generator. Domain allowlist.

One deviation worth knowing: **the embed's search does not geocode.** It filters the places already in the snapshot by name and address. Geocoding a visitor's typed query would be a metered call in the visitor's path, which §2 forbids outright — the geocoder runs at import time and never again. "Find nearest" uses the browser's own geolocation, which is free and more accurate than resolving a typed address anyway.

**Week 4 — Business layer. ← next.** Pricing page, plan limits, MoR integration + webhook, own PMTiles on R2, landing page, one platform page (Webflow first), docs with screenshots, transactional email.

**Then stop building and go get ten customers.** What they ask for decides Phase 2 — not this file.

---

## 11. Explicitly out of scope for v1

Teams and permissions · public API · **turn-by-turn directions** (a route's line, distance and drive are in — see §0; step-by-step navigation is not, and we link out to a maps app for that) · analytics dashboards · custom styling beyond 3–4 presets · uploaded image/floor-plan maps · mobile apps · white-labelling · multi-language UI · autocomplete · SEO location pages.

Each of these is a week not spent getting a paying customer. If one seems necessary, say why and ask first.

--- 

## 12. Known constraints

- **Vercel Hobby prohibits commercial use** and caps cron at once daily. Use Vercel Pro or self-host.
- **Google Maps is not an option anywhere in this codebase.** Their terms forbid storing business names and addresses, cap coordinate caching at 30 days, and require Places results to be shown on a Google map. Our model breaks all three.
- **Nominatim's public API forbids autocomplete and bulk use.** If we self-host geocoding, use Photon (prebuilt GraphHopper dumps, runs as a separate service on its own VPS — it is not loaded into Appwrite).
- **OpenStreetMap's ODbL is copyleft on databases.** Rendering and displaying places is fine. Offering customers a bulk export of OSM-derived data may trigger share-alike. Flag before building any export feature.
- Attribution for OpenStreetMap and the tile provider must be visible on every rendered map, including the embed. Non-negotiable.

---

## 13. When in doubt

1. Does this put a metered call in the visitor's path? → Don't.
2. Does this add weight to the embed bundle? → Justify it.
3. Is this in the §11 out-of-scope list? → Ask first.
4. Does this get us closer to a stranger paying us? → If not, deprioritise it.

## Reminders

- Use REST patterns, avoid server actions where ever possible
- When building components always make them mobile friendly
- Dont build large components, divide large components into smaller peases and create folder inside /components folder for grouping
- If you need to login in chrom use these cridencials email: Daktaras@gmail.com, password: Daktaras123