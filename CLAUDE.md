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

**Tags are the map's one filter axis, and they absorbed categories.** There were two vocabularies. A category answered "what kind of place is this?" and there was exactly one per location because it coloured the pin; a tag answered what a location stocks or offers and there were as many as applied. On one screen that read as the same question asked twice under two names — and the *weaker* of the two was the one every owner reached for first, precisely because it was the one that changed what the map looked like. The argument for keeping them apart was that merging would make a stockist carrying three product lines need three pins at one address. The merge answers that instead: **a tag carries a colour, and a location's pin takes the colour of its first tag.** Three product lines, one pin, one colour, three chips.

`places.tags` is therefore **ordered**, and that order is load-bearing: nothing between the form and the snapshot may sort it. `placeTagsSchema`'s dedupe is a `Set` spread (insertion order preserved), `buildSnapshot` narrows with `filter` and not a re-map, and `tagChipsOf` reads the *place's* order where `tagLabelsOf` reads the map's — which is why the card's first chip is the colour the pin beside it is wearing.

Tags live in **groups**, and the grouping is load-bearing rather than tidy: a group is one *question*, and `packages/shared/tags.ts` reads groups as AND and the tags inside one as OR — "sells bikes OR skis, AND opens Sundays" is the shape of a real search, and both simpler rules are wrong in ways a visitor notices (AND everywhere makes ticking a second product line return *fewer* shops). That file is shared with the embed for the same reason `shapes.ts` is: the dashboard's Locations list filters by tag too, and two copies of the rule would be two different sets of the same locations on one screen. The vocabulary is `maps.tagGroups` (JSON) and a place's tags are `places.tags`, a real Appwrite string array.

**The migration is what made the merge cheap, and one decision is the whole of it: a category becomes a tag that keeps its own id.** `places.category` already held `cat-xxxx`, so `scripts/migrate-categories-to-tags.mjs` (`npm run migrate:tags`, `--dry-run` first) mints the tag as `{id: "cat-xxxx", label, color}` and folds the column into `tags` **first** — no id remapping anywhere, and every existing pin comes out the exact colour it already had. That is the one id in the system breaking `newTagId`'s never-reuse rule, and it is safe only because nothing will mint a `cat-` id again. `maps.categories` and `places.category` are **retired, not dropped**: still in `scripts/appwrite-schema.mjs`, emptied per row by the migration, written by nothing.

**Published snapshots keep reading the old shape, and that is not optional.** `SnapshotSchema.categories` and `SnapshotPlace.category` are now optional and marked legacy; a file published before the merge is live on a customer's site and is read forever (§7). The whole of the back-compatibility is three reads in the embed — `colorOf` in `embed/src/map.ts` falling through to the category after the tags, one chip in `list.ts`, and the retired `category` card block in `popup.ts` — plus the legacy branch in `packages/shared/search-text.ts`. `embed/dev/dev-legacy.html` renders the real bundle against a pre-merge fixture, and is the only thing standing between that promise and a silent regression.

**A tag id is random, is never derived from its label, and nothing sweeps a deleted tag off the places wearing it.** The two facts are one decision. `clearFromPlaces` sets a scalar column to `""` where it equals a value, and `tags` is an array Appwrite cannot remove a single element from — so tidying up would mean rewriting up to 3,000 rows to fix ids no visitor can see. Dangling ids are therefore the *normal* state: `placeTagsSchema` deliberately does not validate against the map's list, `buildSnapshot` narrows them away at publish, and `tagLabelsOf` / `tagChipsOf` drop them when drawing. It is also why `pinColorOfTags` *walks* rather than reading `tags[0]`: a dangling id at the front would otherwise leave a pin grey while the card beside it drew three chips. And it is exactly why `newTagId` must never reuse or derive an id — a label-derived id handed out twice would resurrect a deleted tag onto every location that once wore it. That is the bug the `pinIcons` cleanup exists to prevent, avoided here with no cleanup at all.

**One control asks the tag question, and creating a tag is the first row of it.** `components/tags/tag-picker.tsx` sits in the location dialog where the Category select used to, and the Tags fold under it is gone: two controls for one question, with the better one hidden, is what made the dialog incoherent. Its dropdown opens with **+ New tag** above the vocabulary — a map whose owner has never opened Settings has no tags, and a picker opening onto nothing reads as broken rather than empty, while a button beside the field is a second thing to find that says nothing about where tags come from. `tag-quick-add.tsx` is that form, in three rows: **name full width, colours, buttons.** No group picker — a new tag joins the map's first group, or a new one labelled `IMPORTED_TAG_GROUP_LABEL` ("Tags"), the same one `resolveTags` uses, so a hand-made tag and an imported one land in one place. Asking which *question* a tag answers, mid-form, is a concept lesson at the wrong moment; regrouping is one drag in Settings.

Selected tags render **inside the field** as chips in pick order, and **dragging one to the front is what makes it the pin's colour** (`use-chip-reorder.ts`; `Alt` with an arrow does the same from the keyboard, which is not optional — the thing it replaced was a real button). A rule ("the first one") is only usable if there is a way to say which one that is, and the ordering gesture says it with the chips themselves. Every chip used to carry a coloured dot instead — solid on the leading one as a legend, faded on the rest as a promote button — and it read as a row of bubbles nobody had asked for; the sentence under the field says the rule now. The field is painted from the **field** tokens (`bg-field`, `rounded-field`, `shadow-field`, no border), which is what `.input-group` does, so it sits flush with the Name box above rather than being a grey box in a column of white ones. Its popover is anchored to the field with an explicit `triggerRef` and **not** to the button that opens it: the trigger has two shapes — the whole field when empty, a chevron at the end once there are chips — so the menu jumped the width of the field the moment the first tag was picked. The quick-add PATCHes the whole `tagGroups` array, because the column is one JSON blob, and parses it through `tagGroupsSchema` first: the uniqueness rules and the ceilings are questions about the *set*, so parsing is what refuses a duplicate name in the dialog instead of as a 400. Renaming, recolouring and removing stay in Settings → Filters, now the map's **only** vocabulary editor, where the usage counts are and where removal's consequences belong.

**The card's Tags block is what stops the filters being a question with no answer on screen.** The embed could always filter by tag and never showed which tags the pin you clicked wears, so "why did this one match?" was answerable nowhere. It sits after the description: it is the one text block whose height varies with the *location* rather than its words, and a stockist with six tags directly under the name would push the street off a 440px card.

**No chip on it carries a dot, and the pill is the owner's to design.** The first chip used to wear the pin's colour, as the card answering "which of these explains the marker I just clicked?". It was removed on request: it read as a stray bubble of a colour nobody had chosen, inside a pill whose colours are now set in the designer — and the pin it explains is on screen beside the card it opened from. In its place the Tags block (and the retired Category block, which draws one chip of the same kind) carries a **Chip colour** and a **Chip padding** control, and its **Alignment** finally moves the chips: `align` reaches a block as `text-align`, which cannot move a flex item, so those three buttons did nothing at all until `chipStyleOf` started handing back a `justify-content` as well. Both renderers read that one function (`TagChips` in `components/card/card-block.tsx`, `buildTags` in `embed/src/popup.ts`), which is what the preview panel would otherwise expose — and the same audit found the two drawing *different pills*, a soft grey one in the studio against a transparent outlined one in the embed. The embed moved to the studio's, since that is what an owner designs against. Absent is absent in both: a block nobody has styled stores nothing and draws exactly the pill it always drew (§7).

**The `category` card block is retired, not deleted.** It stays in `CardBlockType` and `CARD_BLOCKS`, marked `retired: true` so `availableBlocks` stops offering it, and it draws the location's first tag. A layout saved while categories existed still parses and still names it, and a block that stopped being a block would silently drop a row out of somebody's design — the same §7 rule the snapshot fields follow. It also came off `defaultCardLayout()`, so every account that has never opened the designer gets the new arrangement immediately — and an account with a *saved* layout keeps the card it arranged, drawing its Category block as the tag that now colours the pin. That asymmetry is the rule, not an oversight: quietly editing a design somebody made is the one thing this function must never do.

**The filter chips still carry no colour.** A filter chip is a control and pressed-or-not is what it has to communicate; a tag's colour answers "which pin is this?" and belongs where that is asked — on the card and the list row, beside the thing wearing it. Eight palette colours competing with the on/off state for the same edge would make the row unreadable.

**Bulk tagging adds *and* removes, and neither is a toggle.** A marquee selection is a mixed bag — some of it wears the tag, some doesn't — so a toggle has to pick a meaning for that and then silently does the opposite of what half the selection needed. "Add" and "Remove" each have one meaning whatever the selection started as, which is the property that made add-only safe to ship first; removing always had it and only lacked a button. Both skip the places the write would not change, because a no-op PATCH still bumps `updatedAt` and that is what the publish tab reads to decide whether the map has unpublished changes.

**Edit means the dialog, and only the dialog.** The Locations panel's row menu used to call `focusPlace` before `setEditingId`, so choosing Edit also selected the pin — drawing its card on the canvas *behind* the modal and flying the camera to something the user was about to stop looking at. Shapes had the same pair. Selecting is what clicking the row means; the menu item means what it says, and both dialogs carry their own view of the thing being edited.

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
`bg-default`, a `GripVertical`, the glyph in a tile of its own, and the hint on
screen at two lines before it clamps. Eleven of those is a wall, which is what
the folds are for: `BLOCK_GROUPS` in `block-labels.ts` shelves them by the
question each answers, **a shelf holding nothing renders nothing at all**
(`PropertyGroup`'s rule), and the palette therefore shrinks as the card fills up
until it is the two or three blocks that genuinely repeat.

`PropertyFold` — the publish designer's own `Fold`, lifted to
`components/ui/properties/property-fold.tsx` — is what both now use, because that
`Accordion.Item` → `Heading` → `Trigger` / `Panel` → `Body` anatomy is
load-bearing and a hand-copied second version is a trigger with no accessible
heading. It is **not** a replacement for `PropertyGroup`: that one is always open
and its argument still holds where it is, on the Modify tab, which is a
fixed-height panel about one selected block. The two folds also differ in what
they open with — publish opens on one, because comparing a panel setting against
a colour is real; the palette opens on all of them, because nothing is being
compared across shelves and hiding the block you came for is a click for nothing.

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

One thing found in the browser and left alone, because it predates all of this:
**the embed's popup has `max-width` and no `width`, so a card with little in it
is narrow** — a location with a short address and one link draws at 133px against
the studio's 320px. It reproduces on `dev-legacy.html`, which has no `cardLayout`
at all. Real drift between the twins, and worth fixing when somebody is next in
`buildPopup`.

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
location and this one latches and is about the card) turns every block into
something with a pencil in its corner, and the pencil opens **the designer's own
properties panel** pointed at this location instead of at the account.

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
design being edited is not the one on screen. The pencil is a **corner badge and
not the whole box**, which is not a style choice: an empty block already gives
its entire box to the dashed `+` that fills it in, and two press targets stacked
on a 24px line is a control nobody can hit on purpose. One rule for every block
instead. The `+` slots are untouched by any of this and still work with edit mode
off.

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
pencil badge is `min(1.125rem, 100%)` on both axes, because the block's box is
`overflow-hidden` and a one-line block is shorter than a fixed 18px square — the
address row clipped it. The popover is a **bounded, clipping flex column**, so
React Aria's own computed `maxHeight` reaches the form's scroller: the cap used
to be a `dvh` on an element inside the dialog and `.popover` has no `overflow` of
its own, so a tall panel overflowed a body-level absolutely positioned element
and gave the *whole page* a scrollbar that came and went with it. And the panel
is **24rem, the width the studio documents**, with `overflow-x-hidden` written
out beside `overflow-y-auto` — a lone `overflow-y: auto` leaves the other axis
`visible`, which computes to `auto`, so a one-axis scroller quietly gets both.

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

So `PlaceCard` owns the panel (`BlockEditorPopover`), the badge is a trigger and
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

**The gallery's badge is the one that leaves the corner**, because the gallery is
the one block that reaches the card's own chrome: `PlaceCardChrome` draws the
close X at `top-1.5 right-1.5` at `z-10`, over the card rather than in it, so the
badge underneath it was not merely overlapped but unpressable —
`elementFromPoint` at its own centre answered "Close". It moves two ways, because
an empty gallery has neither of the other corners free: with a picture the middle
is clear, and with none the middle belongs to the dashed `+` that adds one while
the corner is still the X, so the badge goes to the bottom. `.card-edit-target`
is a one-cell grid and all three placements are one `place-items` declaration, so
there is no second set of insets to keep in step. `CardView` is what knows a block
is drawing a `+`, which is why `renderOverlay` is handed that fact rather than
guessing at it. Every other block keeps the corner, where nothing is in its way.

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

**No tag chip carries a colour dot.** `TagDot` is gone, and with it the swatch on
every chip in the picker's dropdown, the Locations filter menu and the bulk-tag
menu. Each of those is a *control*, and pressed-or-not is the one thing it has to
communicate; the accent that says "on" is itself a colour, so eight palette
colours were answering at the same volume. A tag's colour belongs where "which
pin is this?" is asked — the card, the list row — and where it is being edited,
in Settings → Filters.

**A tag group is a thing you create, and the picker never said so.** The dropdown
shows group names as `<legend>`s and offers only "+ New tag", so the groups read
as a second, uncreatable vocabulary — which is exactly the "categories" a user
reported being unable to add to, on a map whose own first group happens to be
*named* Categories. The fix is one muted line under the groups naming Settings →
Filters, and a real **Add group** button in that panel's empty state, which said
"Add a group" and rendered nothing to press. Deliberately *not* a group picker in
the quick-add: asking which question a tag answers, mid-way through filling in a
location, is a concept lesson at the wrong moment.

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

Not built yet, and next: everything in Week 4 — pricing page, plan-limit UI, MoR billing + webhook, landing page, one platform page, docs, transactional email. Plus the two upstreams §12 says are forced before anyone pays us — **which are now a switch rather than two machines**: `GEOCODER_PROVIDER=geoapify` and `ROUTING_PROVIDER=geoapify` move both off the demo endpoints onto a service that permits commercial use and permits results to be stored. What is still owed there is a plan decision, not a build: Geoapify's free tier requires its attribution, and a route drawn on it is published onto a customer's site. Self-hosted Photon and OSRM stay in the tree as the fallback, with their runbooks intact. The PMTiles archive on R2 is ready and deliberately *not* on that list (§7).

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
npm run migrate:tags            # fold categories into tags (--dry-run first)
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
- **MapLibre is external to the embed bundle, deliberately.** Bundling it inlines `maplibre-gl-shared.mjs`, and the worker then downloads its own copy of the same 131KB chunk — measured at 424KB gzipped total. Shipping MapLibre's dist files beside `map.js` lets the main thread and the worker share one URL: 314.5KB. Don't "simplify" this by removing `external` from `embed/vite.config.mts`.
- **§4's 250KB budget is not reachable and the check knows it.** MapLibre v6 alone is 273.2KB gzipped. `scripts/check-embed-size.mjs` therefore budgets *our* code (46KB, currently **42.7KB**) and puts a 320KB ceiling on the total to catch the duplication regression above. See §4.
- **Snapshots are written twice per publish.** An immutable timestamped archive, plus one live file at a fixed id that the embed actually reads. The embed's URL has to be stable across republishes or every customer would re-paste their snippet, and §2 forbids asking us which snapshot is current. `lib/snapshot/storage.ts` explains the delete-then-create window and why the embed retries once.
- Vendored skills in `.agents/skills/`, pinned by `skills-lock.json`: `heroui-react`, `appwrite-typescript`, `next-cache-components-optimizer`. Use them instead of recalling API shapes.

### Environment

`.env` is gitignored and there is no `.env.example`. Names in use:

- Browser-safe: `NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`, `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`
- Server-only: `APPWRITE_API_KEY`, `DATABASE_ID`, `STORAGE_ID` — unprefixed deliberately. These must never reach a client component or the embed bundle (§9).
- Optional, all server-only, all defaulted: `GEOCODER_URL` (defaults to the public Photon instance), `GEOCODER_MIN_INTERVAL_MS` (defaults to 1000, and now spaces request *starts* rather than waiting for each round trip to finish — see `lib/geocoding/throttle.ts`) and `GEOCODER_USER_AGENT`. Point the first at a self-hosted Photon and lower the second before any real import volume. The third exists because public OSM-derived services block unidentified clients and Node's default UA is exactly that: a 403 from a WAF is otherwise indistinguishable from the service being down, and both arrive as a 502.
- Optional, all server-only, all defaulted: `ROUTING_URL` (defaults to the public OSRM demo server), `ROUTING_MIN_INTERVAL_MS` (defaults to 1000) and `ROUTING_USER_AGENT`. Exactly the geocoder's three, for exactly the geocoder's reasons — and with a sharper deadline: the demo server's terms forbid reselling access and warn that it can be withdrawn without notice, so `ROUTING_URL` has to point somewhere of our own before the first paying customer. `docs/self-hosting-routing.md` is the runbook, including why Valhalla beats OSRM the moment coverage goes past one country. Nothing published moves when this changes — a route's geometry is baked at draw time, which is the whole feature.
- Optional, all server-only, all defaulted: `GEOAPIFY_API_KEY`, `GEOCODER_PROVIDER` and `ROUTING_PROVIDER`. Set either provider variable to `geoapify` and that half moves onto Geoapify (`lib/geoapify/client.ts`, plus a thin adapter in each folder); unset, Photon and OSRM answer exactly as they always did, which is what makes this switchable per half and reversible. The two switches are deliberately independent — they share an account and a credit budget but not a decision, since geocoding is judged on an import of real addresses and routing on a drawn line. `GEOAPIFY_MIN_INTERVAL_MS` paces **both**, out of one process-wide throttle, because one account has one rate limit; it defaults far below the demo servers' 1000ms since arming the route tool sweeps up to 200 pins. The key is unprefixed and belongs to `APPWRITE_API_KEY`'s class — it must never reach a client component or the embed (§9), and `geoapifyGet` appends it last and keeps it out of every error message so an upstream failure cannot log it.
- **Temporary, and testing only: `DISABLE_ALL_PLAN`.** Set to `1`/`true`/`yes`, every
  account reads as `pro` — so every quantity limit and the routes feature gate is
  bypassed. It exists because routes are a paid feature on an account that has no
  billing yet (§10 Week 4), which makes the routing half of a provider swap
  unreachable by hand, and by hand is the only way that half's failures show:
  they are plausible wrong answers, not errors. It is one early return in
  `getUserPlan` — the single point the plan is resolved — so §6's rule that the
  checks live in the repositories is intact and every one of them still runs; they
  are simply asked about a different plan, which is why the ceilings become pro's
  3,000 places rather than none. Honoured in every environment and it warns once
  per process when it is on. **Delete it with the pricing work.**
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

**Measured, that target is unreachable with MapLibre v6** — its own dist files are 273.2KB gzipped (`maplibre-gl.mjs` 136.4 + `maplibre-gl-shared.mjs` 131.0 + the worker 5.8), minified already, with no slim build. Actual total is **315.9KB**, of which ours is 42.7KB. `npm run build:embed` enforces a 46KB budget on our code and a 320KB ceiling on the total; it does not pretend 250KB is achievable. Getting under 250KB means changing the map library, which is a §3 decision — raise it rather than shaving our 42.7KB.

**The own-code budget was raised from 42KB to 46KB for the map designer**, and that is the second and last time it should happen casually. It was at *exactly* 43,008 of 43,008 bytes — passing only because the check compares with `>` — and the designer needed a floating panel, a pin per results row and a dozen settings reads. Two things made 46 honest rather than a shrug: the **total**, which is what §4 actually protects and what a visitor downloads, had the room (315.9KB against the 320KB ceiling); and it was part-paid by deleting the tag filter chips rather than borrowed whole. The reasoning is written out in `scripts/check-embed-size.mjs`. Do not raise it again to get past a binding budget — it exists to catch the MapLibre duplication regression above, and a budget that moves whenever it binds is not one. Trim, or keep the addition on the dashboard side of the seam.

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
`userId` · `name` · `slug` (unique) · `style` · `defaultLat` · `defaultLng` · `defaultZoom` · `tagGroups` (JSON) · `fields` (JSON) · `pinIcons` (JSON) · `settings` (JSON) · `appearance` (JSON) · `allowedDomains` (string[]) · `publishedAt` · `snapshotUrl` · ~~`categories`~~ (JSON, retired)

`settings` is the whole map designer: which of the embed's optional controls exist, the results panel's side, placement, width, transparency, blur and corners, what a results row draws, which of MapLibre's own controls are on the map and in which corner, and the embed's five colour tokens. Every field beyond the original booleans is optional in `SnapshotSettings` and absent means what the embed did before it existed — see §0. One writer only (`useEmbedDesign`), because the column is one JSON blob written whole.

`tagGroups` is the map's whole filter vocabulary: `[{id, label, tags: [{id, label, color}]}]`. It absorbed `categories`, which is left in place holding nothing — see §0. Do not drop a column with data in it.

`appearance` is the label level and the layer toggles. Its own column rather than another key
in `settings`, and the reason is mechanical: `settings` means "which of the embed's optional
controls are on", it belongs to the Publish tab's form, and `updateMap` writes it by
serialising the **whole** object — two forms writing one blob is a lost update, and the
appearance controls are on two screens at once. `style` stays where it is: still one choice
from one list, and moving it would orphan every map already saved. It is a `varchar(32)`, so
theme keys stay short.

### `places`
`mapId` · `name` · `lat` · `lng` · `address` · `tags` (string[]) · `fields?` (JSON) · `icon?` · `groupId?` · `description?` · `phone?` · `email?` · `url?` · `hours?` (JSON) · `photoIds?` (string[]) · `photoId?` (retired) · `logoId?` · `sortOrder` · `geocodeConfidence?` · `geocodeStatus` (`ok` | `low` | `failed` | `manual`) · ~~`category`~~ (retired) · `cardBlocks?` (JSON)

`cardBlocks` is how *this* location's card differs from the account's design:
`{ [blockId]: CardBlock }`, a whole resolved block per entry rather than a diff
— see §0. It can change what a block *is* and nothing else; which blocks a card
has, where they sit and in what order stay in `cardDesigns`, one row per account.

`logoId` is this location's own brand mark, as a storage file id — not the image
on the map's custom pin, which is `pinIcons` and is shared by every location
wearing it. A file rather than an inline data URI because a snapshot names it by
URL; see §0.

**`tags` is ordered and the order means something**: the first tag is what colours the pin. Nothing may sort it on the way to storage or to a snapshot.

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

**Tiles:** point at OpenFreeMap's public instance. **This is not a launch blocker and used to be written as though it were.** OpenFreeMap's FAQ permits commercial use in as many words, sets no request limit, and asks for no key — the only thing missing is an SLA ("I don't offer SLA guarantees"). So owning the tiles is insurance against one volunteer-funded service disappearing, not a policy requirement, and it costs about a dollar a month whenever you decide to buy it (`docs/self-hosting-tiles.md`). Move when OpenFreeMap wobbles or when a customer is paying enough that a blank map on their site is unacceptable — not on a date.

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

**Week 4 — Business layer. ← next.** Pricing page, plan limits, MoR integration + webhook, landing page, one platform page (Webflow first), docs with screenshots, transactional email. **Our own geocoding and routing instances belong here too and are the two that are actually forced** — the public Photon and OSRM endpoints both forbid what a paying customer would make us do with them (§12). Own PMTiles on R2 is *not* on this list any more: OpenFreeMap permits commercial use, so that one is insurance to buy when it suits, not a gate to pass.

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
- **A licence and a demo server's usage policy are different things, and confusing them has cost time.** Every component of this stack — OSM data (ODbL), OpenFreeMap, OSRM (BSD-2), MapLibre and PMTiles (BSD-3/MIT) — permits commercial use outright, and nothing here has ever claimed otherwise. What is restricted is running production traffic through the free *demo endpoints* those projects host. Verified September 2026, and the three do not have the same answer:

  | Service | Public endpoint | Commercial traffic on it |
  |---|---|---|
  | Tiles — OpenFreeMap | `tiles.openfreemap.org` | **Allowed.** No keys, no request limit, no SLA. |
  | Geocoding — Photon | `photon.komoot.io` | **No.** "Extensive usage will be throttled or completely banned" — a CSV import is extensive usage. |
  | Routing — OSRM | `router.project-osrm.org` | **No.** Reselling forbidden, ~1 req/s, withdrawable without notice. |

  So the order before charging anyone is **geocoding first, routing with it, tiles when it suits** — not the other way round, which is how §10 used to read. Only tiles are in a visitor's path, which is why only they are forced to be flat-cost (§2); the other two run once, on the dashboard, when an owner imports or draws. Each has a runbook: `docs/self-hosting-geocoding.md`, `docs/self-hosting-routing.md`, `docs/self-hosting-tiles.md`.
- **Geoapify is the hosted answer to the two forced ones, and the property that decided it is storage.** `GEOCODER_PROVIDER=geoapify` and `ROUTING_PROVIDER=geoapify` move geocoding and routing off the demo endpoints without a VPS. What makes it usable *here* specifically is that it permits results to be stored and redistributed: this app writes a geocode onto the row and bakes a route's geometry into a static snapshot that customer sites read forever (§7), which Google's terms forbid outright and Mapbox's published terms decline to answer — the same trap this section already records for Google Maps. Two consequences to keep in view. **Geoapify attribution is mandatory on the free plan**, and a route drawn on it is published onto a customer's site, so a paid plan (or the credit) is owed before routes reach a customer; OpenStreetMap attribution is unchanged and already carried by every rendered map. And **their map tiles are not an option** — tiles are the one part of this stack in a visitor's path, so a metered tile host is exactly what §2 exists to forbid. Basemaps stay on OpenFreeMap. Self-hosting stays in the tree and stays reachable: Photon and OSRM are still what an unset switch builds.
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