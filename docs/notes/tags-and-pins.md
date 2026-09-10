# Tags, pins and groups — design notes

Moved out of CLAUDE.md on 2026-09-05 so that file stays cheap to load. Nothing here is
rewritten; it is the record of why this area is shaped as it is.

## Invariants

### Pins

- Pin geometry lives once, in `packages/shared/pin-icons.ts`. The editor emits SVG and
  colours it with CSS custom properties (`components/map/pin-marker.ts`); the embed
  rasterises the same paths through Canvas2D (`packages/shared/pin-raster.ts`). Not a
  `data:` URI — a host CSP can block it — and not an external sprite, which is a request
  in the visitor's path (§2).
- `icon-allow-overlap` is on deliberately: symbol collision would silently hide a real
  location on a customer's site.
- Every `CustomPinIcon` field is optional and **absent means the pin as it was before
  that field existed** — which is what let it ship with no migration and no republish.
  `usedPinIcons` in `lib/snapshot/build.ts` drops any field left at its default.
- `ResolvedPin.key` must fold in every field. It is what `setPinIcon` diffs on, so a
  field missing from the key is a pin restyled in the studio that never changes.
- Whatever writes pin CSS vars onto a **recycled** element must clear what it doesn't set
  (`setPinVars` in `use-place-markers.ts`) — markers outlive the pin they were drawn for.
- The pin is centred on its coordinate and `icon-anchor` is `center`. Adding a shape whose
  anchor is not its centre re-costs five places (marker CSS, drag ghost, embed canvas
  crop, popup offset, symbol anchor).
- A group has no pin. "Change pins" writes each member's own `icon` through one
  `setGroupPin` `updateRows` scoped by `mapId` *and* `groupId` — not one PATCH per member.

### Tags

- **`places.tags` is ordered and the order is load-bearing**: the first tag colours the
  pin. Nothing between the form and the snapshot may sort it.
- Tag **groups are AND, tags inside one group are OR** (`packages/shared/tags.ts`, shared
  with the embed so the dashboard list and the embed filter agree).
- A category became a tag **keeping its own `cat-xxxx` id** — the one id in the system
  breaking `newTagId`'s never-reuse rule, safe only because nothing mints a `cat-` id again.
- `maps.categories` and `places.category` are **retired, not dropped**.
- Published snapshots keep reading the old shape: `SnapshotSchema.categories`,
  `SnapshotPlace.category`, `colorOf`'s fallthrough in `embed/src/map.ts`, one chip in
  `list.ts`, the retired `category` block in `popup.ts`, and the legacy branch in
  `packages/shared/search-text.ts`. `embed/dev/dev-legacy.html` is what guards it.
- **Dangling tag ids are the normal state**, not an error — nothing sweeps a deleted tag
  off the places wearing it. `placeTagsSchema` deliberately does not validate against the
  map's list, `buildSnapshot` narrows them away, and the drawing helpers drop them.
- `pinColorOfTags` **walks** rather than reading `tags[0]`, or a dangling id at the front
  leaves a pin grey while the card draws three chips.
- **An untagged pin has three answers, not two, and only the last is a constant.** The
  editor falls back to `var(--accent)`; a published map falls back to
  `settings.pinColor`, which `DEFAULT_EMBED_SETTINGS` seeds from the same accent; and
  `UNTAGGED_PIN_COLOR` is what is left for a snapshot written before that field, which is
  every file already on a customer's site (§7). `colorOf` in `embed/src/map.ts` puts the
  published colour *below* tags and below the legacy categories, so it only ever answers
  for a place the map says nothing about. The card's Logo block reaches the same colour
  through `--lm-pin` rather than through `colorOf`, because that one renderer is CSS and
  the other two are canvas.
- `newTagId` must never reuse or derive an id from a label — a label-derived id handed out
  twice resurrects a deleted tag onto every location that once wore it.
- `components/tags/tag-picker.tsx` is the one control. Quick-add PATCHes the **whole**
  `tagGroups` array (the column is one JSON blob) and parses it through `tagGroupsSchema`
  first, so a duplicate name is refused in the dialog instead of as a 400.
- Chips reorder by drag (`use-chip-reorder.ts`); `Alt` + arrow does the same from the
  keyboard and is **not optional**.
- The picker's popover anchors to the **field** via an explicit `triggerRef`, not to the
  button — the trigger changes shape once the first chip appears.
- **No chip anywhere carries a colour dot**, and filter chips carry no colour: a chip is a
  control, and pressed-or-not is what it has to communicate.
- The `category` card block is retired, not deleted — it draws the location's first tag.
- Bulk tagging **adds and removes**, neither is a toggle, and both skip places the write
  would not change (a no-op PATCH bumps `updatedAt`, which the publish tab reads).

## Notes

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
