/**
 * The published snapshot format — the only contract between the dashboard and
 * the embed.
 *
 * Type-only by rule (CLAUDE.md §4): no runtime value may cross this boundary, or
 * the embed would start pulling dashboard code in behind it. That includes the
 * version number, which is expressed as the literal type `1` and written by the
 * generator rather than exported as a const.
 *
 * Everything a visitor's browser needs is in here. The embed fetches this file
 * and static tiles, and makes no other request — that is CLAUDE.md §2, and it is
 * the reason this type carries resolved values (styleUrl, photoUrl, attribution)
 * instead of ids the embed would have to look up.
 *
 * Optional fields are omitted rather than written as null. On a 3,000-place map
 * the empty strings add up, and the embed treats absent and empty the same way.
 */

import type { CardBlock, CardLayout } from "./card-layout";
import type { OpeningHours } from "./hours";
import type { MapAppearance } from "./map-appearance";
import type { PinRingWidth, PinShape, PinSize } from "./pin-icons";
import type { ShapeStrokeStyle } from "./shapes";

/**
 * **Legacy, read-only.** See `MapSnapshot.categories`.
 */
export type SnapshotCategory = {
  id: string;
  label: string;
  /** Hex, already resolved. The embed colours markers straight from this. */
  color: string;
};

/**
 * One of the map's own pins, flattened for the embed.
 *
 * No label: the legend is built from categories, and a pin's name exists only so
 * its owner can tell two of them apart in the dashboard. Sending it would be
 * bytes on every visitor's download for something nothing renders.
 *
 * `image` is the whole logo, inlined as a data URI. That is a deliberate cost —
 * a few KB per pin, once, rather than a request per visitor (§2) — and it is the
 * only form the embed can draw with no CSP surface: handed to `createImageBitmap`
 * through a Blob, it loads no URL at all.
 */
export type SnapshotPinIcon = {
  /** Matches the `custom:<id>` a place carries in `icon`. */
  id: string;
  /** Hex. Overrides the category colour — a custom pin is a finished design. */
  color: string;
  /** A built-in icon id from ./pin-icons.ts. Absent when this pin is an image. */
  glyph?: string;
  /** A `data:image/…;base64,…` URI. Absent when this pin is a glyph. */
  image?: string;
  /**
   * The pin's design, and every one of these is absent when it is the default —
   * the same rule the empty `glyph` and `image` follow. Across a map's pins the
   * dropped keys are download the visitor does not pay for, and the embed reads
   * absent and default identically (`pinsOf` in embed/src/map.ts).
   *
   * They are optional for a second reason too, and it is the harder one:
   * snapshots are immutable and live customer sites keep reading the file they
   * were published with (§7), so every snapshot written before these existed is
   * still being parsed today and must keep parsing.
   */
  ring?: string;
  ringWidth?: PinRingWidth;
  iconColor?: string;
  size?: PinSize;
  shape?: PinShape;
};

/**
 * One answer in the map's filter vocabulary, and the question it answers.
 *
 * Groups are the point. The embed reads them as **AND across groups, OR within
 * one** — "sells bikes OR sells skis, AND opens on Sundays" — which one flat
 * list of chips cannot express. A place stores bare tag ids and never says which
 * group they came from, which is why tag ids are unique across the whole map.
 */
export type SnapshotTag = {
  id: string;
  label: string;
  /**
   * Hex, already resolved. The embed colours the chip from this, and the pin
   * from whichever tag the place wears first.
   *
   * Optional, and it has to be: a snapshot published while tags were colourless
   * and categories carried the colour is still live on a customer's site (§7).
   * Absent means the embed falls back the way it always has.
   */
  color?: string;
};

export type SnapshotTagGroup = {
  id: string;
  label: string;
  tags: SnapshotTag[];
};

/** How a custom field's value is rendered, and what it links to. */
export type SnapshotFieldType = "text" | "url" | "tel" | "email";
/** `row` is a labelled line among the details; `button` is the call to action. */
export type SnapshotFieldDisplay = "row" | "button";

/**
 * One extra field these locations carry, defined once for the whole map.
 *
 * The definition travels separately from the values for the reason it is stored
 * that way: a label is a promise about the whole set, and per-place labels would
 * let two locations spell one field differently with no way to tell which was
 * meant. The order here is the order the popup renders.
 */
export type SnapshotField = {
  id: string;
  label: string;
  type: SnapshotFieldType;
  showAs: SnapshotFieldDisplay;
};

export type SnapshotPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  /**
   * **Legacy, read-only.** Category id, matching `SnapshotCategory.id`. Nothing
   * writes this since categories merged into tags; the embed reads it only to
   * keep colouring maps published before the merge (§7).
   */
  category?: string;
  /**
   * Icon id: a built-in from ./pin-icons.ts, or `custom:<id>` matching a
   * SnapshotPinIcon below. Absent for a plain pin, which is what the embed draws
   * for an id it doesn't recognise too.
   *
   * Optional, and it has to stay that way for the same reason `hours` does:
   * snapshots are immutable, so every file published before this field existed
   * is still live on a customer's site and must keep parsing.
   */
  icon?: string;
  /**
   * This pin's colour, when a group decided it rather than the pin itself.
   *
   * **Absent means the pin's own colour**, which is what every snapshot ever
   * published says and what the embed has always worked out for itself —
   * `resolvePin`'s colour, then the first defined tag's. So a map with no groups
   * publishes exactly the bytes it published before this field existed, and
   * nothing on a live site moves until its owner republishes (§7).
   *
   * Written only when there is an override, and the override is a *group's*
   * colour: the group the location is in, or the group a route it is a stop on
   * is in. The group's **id** still does not travel — a visitor cannot see a
   * group or act on one, and `lib/snapshot/build.ts` says so at more length. It
   * is the colour that is a fact about the pin.
   */
  color?: string;
  description?: string;
  phone?: string;
  email?: string;
  url?: string;
  /**
   * Seven entries, Monday first, `null` for a closed day — see ./hours.ts.
   *
   * Optional, and it has to stay that way: snapshots are immutable, so every file
   * published before this field existed is still live on a customer's site and
   * must keep parsing.
   */
  hours?: OpeningHours;
  /**
   * The cover photo. Public storage URL, composed on the server so no bucket id
   * ships. Always `photoUrls[0]` when there is a gallery.
   */
  photoUrl?: string;
  /**
   * The whole gallery, cover first, and only when there is more than one photo
   * — a place with a single picture says so in `photoUrl` alone and pays no
   * duplicate bytes for it.
   *
   * `photoUrl` is kept beside this rather than replaced by it, and the small
   * redundancy is the point: snapshots are immutable and every file published
   * before galleries existed is still live on a customer's site reading
   * `photoUrl` (§7). Leaving its meaning exactly as it was is what lets those
   * keep rendering, and what lets the dashboard's own card code stay unchanged.
   *
   * Optional, on that same rule.
   */
  photoUrls?: string[];
  /**
   * This location's own brand mark, when a Logo block is set to draw one.
   *
   * A public storage URL like the photos above, and for the same reason: a logo
   * per location cannot ride inside the file the way the map's shared custom
   * pins do (`pinIcons`, capped at 6KB of base64 each), or a map of three
   * thousand stockists would hand every visitor megabytes of it (§2).
   *
   * Optional, and written only when the location has one — so a map whose owner
   * has never uploaded a logo publishes exactly the bytes it always did, and
   * every file published before this field existed still parses (§7).
   */
  logoUrl?: string;
  /**
   * How this location's card differs from the one in `cardLayout`, keyed by the
   * id of the block it stands in for -- see `mergeCardBlocks`.
   *
   * Present only on a location somebody singled out in the editor's edit mode,
   * which is a handful on a map of three thousand, and **already narrowed and
   * resolved**: `buildSnapshot` drops any id the published layout does not have
   * and clamps what is left, because the embed draws these bytes as they were
   * published and never runs them back through the resolver (§7). So the whole
   * of the embed's side of this is `overrides[block.id] ?? block`.
   *
   * Optional, on the rule every field above follows: a map whose owner has never
   * opened edit mode publishes exactly the bytes it always did.
   */
  cardBlocks?: Record<string, CardBlock>;
  /**
   * Tag ids, already narrowed to ones the map still defines — a place may be
   * storing ids for tags that were deleted, and those are dropped here rather
   * than shipped for the embed to fail to match.
   *
   * Optional, and it has to stay that way for the same reason `hours` does:
   * snapshots are immutable, so every file published before this field existed
   * is still live on a customer's site and must keep parsing.
   */
  tags?: string[];
  /**
   * Answers to the map's extra fields, keyed by field id and narrowed the same
   * way. Same optionality, same reason.
   */
  fields?: Record<string, string>;
};

/**
 * An area on the published map — a delivery radius, a service region, a boundary.
 *
 * A discriminated union rather than a flat row of optional numbers, so the embed
 * gets the same exhaustive `kind` switch the editor does and cannot read a
 * radius off a polygon. The geometry is turned into points by ./shapes.ts, which
 * both targets call — a circle drawn with a different number of segments in each
 * would be two visibly different circles in the editor's preview panel.
 *
 * The ring itself is not stored here. A 64-point circle is 64 coordinates the
 * embed can generate from three numbers, and shipping them would be about 1.5KB
 * per circle on every visitor's download to save a loop.
 */
export type SnapshotShape = {
  id: string;
  name: string;
  /** Hex, already resolved — the embed fills straight from this. */
  color: string;
  /** 0–1. The fill only; the outline is always drawn at full opacity. */
  opacity: number;
  description?: string;
  /**
   * The outline's width in pixels.
   *
   * Optional, and omitted whenever it is the default for this kind — 4px for a
   * line, 2px for an area's edge. `strokeWidthOf` in ./shapes.ts is what fills
   * it back in, so absent draws exactly what every snapshot written before this
   * field existed draws. Same immutability rule as `hours` and `durationS`:
   * those files are live on customers' sites and must keep parsing.
   */
  strokeWidth?: number;
  /** How the outline is marked out. Absent means solid, which is every old file. */
  strokeStyle?: ShapeStrokeStyle;
} & (
  | { kind: "circle"; lat: number; lng: number; radius: number }
  | { kind: "polygon"; points: [number, number][] }
  /**
   * An open path. Drawn as a LineString, never filled.
   *
   * Its points are already resolved: an endpoint bonded to a location in the
   * editor is written here as the coordinates that location was at when the map
   * was published. The bond itself never ships — the embed would have to look an
   * id up to use it, and it has nothing to look it up in.
   *
   * `durationS` is how long the route takes, in seconds, and is present only for
   * a path that came out of a routing engine. It is the one measurement stored
   * rather than derived: the popup works a line's *length* out from these very
   * points, but no arrangement of coordinates says how fast you may drive along
   * them.
   *
   * Optional, and it has to stay that way for the same reason `hours` and
   * `pinIcons` are: snapshots are immutable, so every file published before
   * routes existed is still live on a customer's site and must keep parsing.
   * Absent means a hand-drawn line, which is what every one of them holds.
   */
  | { kind: "line"; points: [number, number][]; durationS?: number }
);

/** Which side of the map the results panel sits on. */
export type SnapshotPanelSide = "left" | "right";

/**
 * How a results row's Directions and phone links are painted.
 *
 * Absent — the outlined pill — is deliberately not a member, the same way
 * `CardButtonVariant` leaves its filled default out: it is the state the field
 * says by not being there, and every snapshot already on a customer's site says
 * it with silence.
 */
export type SnapshotRowLinkStyle = "outline" | "soft" | "solid" | "plain";

/** A corner of the map, for MapLibre's own control stack. */
export type SnapshotCorner =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/**
 * The embed's own colour tokens, overridden by the owner.
 *
 * These are written straight onto `.lm-root` as the custom properties the whole
 * stylesheet is built from (`embed/src/styles.css`), so each one must be a hex
 * colour and is validated as such before it is stored — this is a string going
 * into a stylesheet on a stranger's website.
 *
 * Every field is absent unless the owner picked something, and absent means the
 * stylesheet's own value. That is what keeps an unstyled embed theme-aware:
 * `.lm-root--dark` redefines exactly these tokens, and a stored `#ffffff` could
 * not follow it.
 */
export type SnapshotColors = {
  surface?: string;
  foreground?: string;
  muted?: string;
  border?: string;
  accent?: string;
};

/**
 * Which of the embed's optional controls are switched on, and what the chrome
 * around the map looks like.
 *
 * **Everything added after the first four is optional, and absent means what the
 * embed did before that field existed.** Snapshots are immutable and live
 * customer sites keep reading the file they were published with (§7), so a map
 * whose owner has never opened the designer publishes exactly the bytes it
 * always did and keeps rendering exactly what it always rendered. The new look
 * arrives through `DEFAULT_EMBED_SETTINGS`, on the owner's next publish — never
 * by us redefining what absent means.
 */
export type SnapshotSettings = {
  clustering: boolean;
  search: boolean;
  nearest: boolean;
  /**
   * **Legacy, read-only — and not even read.** The tag filter chips were removed
   * from the embed: their question ("show me the retail ones") is answered by
   * typing the word, because tag labels are part of the search index. Nothing
   * writes this and nothing reads it; it stays in the type only because every
   * snapshot published before the removal still carries it and must keep
   * parsing.
   */
  filters?: boolean;
  /**
   * The results panel beside the map.
   *
   * Optional, and it has to stay that way for the same reason `hours`, `theme`,
   * `pinIcons` and `shapes` are: snapshots are immutable, so every file
   * published before this field existed is still live on a customer's site and
   * must keep parsing. Absent means **off** here rather than "the default",
   * which is the one place this rule bites: the default for a new map is on, but
   * a map published a year ago must keep rendering what its owner last saw, and
   * growing a panel on someone's website without them republishing is not that.
   */
  list?: boolean;
  /**
   * Whether clicking a pin opens its card.
   *
   * `false` is a map that is pins and nothing else — which is a real product for
   * an owner whose locations are a picture rather than a directory, and who has
   * the results panel beside the map to carry the words. The pin still *says*
   * which location it is: a click marks that location's row in the panel, so the
   * information moves rather than disappearing.
   *
   * Spelled as the card being shown rather than as `hideCard`, because absent
   * has to keep meaning what the embed has always done — every published map
   * opens a card, and a flag whose absence meant "hidden" would empty every one
   * of them on the next deploy of the bundle (§7).
   *
   * A shape's own popup is not this. It is a name and a sentence about an area
   * the owner drew, not a location card, and it stays.
   */
  card?: boolean;

  /* The results panel — absent is the docked left column it has always been. */

  /** Absent means left, which is where every published panel sits today. */
  panelSide?: SnapshotPanelSide;
  /** Over the map rather than beside it. Absent means beside. */
  panelFloat?: boolean;
  /** Percent of the embed's own width. Absent means 40. */
  panelWidth?: number;
  /** Percent. Absent means opaque, and only a floating panel can be less. */
  panelOpacity?: number;
  /** Pixels of backdrop blur behind a see-through panel. Absent means none. */
  panelBlur?: number;
  /** Pixels. Absent means square, which is what a docked column is. */
  panelRadius?: number;
  /**
   * `false` hides the results list's own scrollbar. Absent means shown — every
   * published panel draws one, so this can only ever be written by an owner who
   * turned it off and republished.
   */
  panelScrollbar?: boolean;
  /**
   * Below the embed's own 768px drawer query, open the list in a drawer instead
   * of stacking it under the map.
   *
   * Absent means **stacked**, which is what every published map does on a phone
   * today: the list comes back into the flow and takes the bottom 40% of the
   * box — and it does so below 640px, its own narrower breakpoint, because
   * moving that one would edit maps already on customer sites. Growing a drawer
   * over somebody's live site without them republishing is the same thing `list`
   * refuses to do, for the same reason.
   *
   * Read only below that width. Above it this is not consulted at all — the
   * panel is the panel, and the side, placement and width settings are what
   * describe it.
   */
  panelDrawer?: boolean;
  /**
   * Give the search box, find-nearest and the drawer's trigger the same glass
   * the panel is designed in, for as long as they are floating over the map.
   *
   * Only ever read on a *floating* toolbar — with the list on and the map wide
   * the toolbar is docked inside the panel and is already on that surface. What
   * this answers is the two arrangements where it is not: a map with the results
   * panel switched off, and a narrow map whose list is a drawer, where three
   * opaque white boxes sat on the basemap beside a panel made of glass.
   *
   * It carries no colours of its own. The controls read `panelOpacity`,
   * `panelBlur` and `panelRadius` — the owner's own answers — so there is one
   * design here rather than two that agree today.
   *
   * Absent means the solid controls every published map draws, which is why this
   * is spelled as the glass being on: the bundle is shared, and a flag whose
   * absence meant glass would frost every live map on the next deploy (§7).
   */
  toolbarGlass?: boolean;

  /* One results row — absent is the row as it was before any of this. */

  /** Draw the location's own pin at the head of its row. Absent means no pin. */
  rowPin?: boolean;
  /** Pixels. Absent means 28, and only read when `rowPin` is on. */
  rowPinSize?: number;
  /** `false` hides it. Absent means shown — every published row shows these. */
  rowAddress?: boolean;
  rowDistance?: boolean;
  /** The Directions and phone links under a row. `false` hides them. */
  rowActions?: boolean;
  /**
   * How those two links are painted. Absent means the outlined pill, which is
   * what every published row draws — see `SnapshotRowLinkStyle`.
   *
   * Only read when `rowActions` leaves them on the row at all.
   */
  rowLinkStyle?: SnapshotRowLinkStyle;
  /**
   * Their corner radius, in pixels. Absent means 999 — the pill above — and a
   * `0` here is the square-cornered chip an owner asks for by picking it.
   *
   * A number rather than a member of the style union, because the two questions
   * are genuinely separate: a solid chip and an outlined one both have a corner,
   * and folding them together would be eight names for four answers.
   */
  rowLinkRadius?: number;

  /* MapLibre's own controls. */

  /** Absent means top-right, where they have always been. */
  controlsCorner?: SnapshotCorner;
  compass?: boolean;
  /** `false` hides it. Absent means shown, which is what ships today. */
  geolocate?: boolean;
  fullscreen?: boolean;
  scale?: boolean;
  /**
   * Let the wheel zoom without ctrl/meta.
   *
   * Absent means it is held back, and that default is not cosmetic: a map on
   * someone's landing page must not swallow the page scroll.
   */
  scrollZoom?: boolean;

  /* Colour. */

  colors?: SnapshotColors;

  /**
   * What a location with no tag and no pin colour of its own is drawn in.
   *
   * Absent means `UNTAGGED_PIN_COLOR`, the flat grey in
   * `packages/shared/pin-icons.ts` — which is what every snapshot published
   * before this field drew, and must keep drawing.
   *
   * It exists because that grey was the *only* answer a published map had. The
   * editor draws the same pin in `var(--accent)` and a snapshot has no theme to
   * read, so the Publish tab showed a grey version of the map the editor next
   * door showed in colour. Publishing the colour is what lets the two agree —
   * `colorOf` in `embed/src/map.ts` reads it, and it is the last link before the
   * grey rather than the first, so a tag still wins.
   */
  pinColor?: string;

  /* Measurement. */

  /**
   * Whether this map reports what its visitors do.
   *
   * The owner's switch, and it lives here because it is one of the embed's
   * optional behaviours like every other key in this object. What the embed
   * actually reads is `MapSnapshot.analytics`, which is written only when this
   * is true — so a map with the switch off carries no endpoint at all rather
   * than an endpoint it has been told not to use.
   *
   * Absent means **off**, which is what every map published before this existed
   * did, and turning it on is a republish. That is deliberate: nothing may start
   * measuring a stranger's visitors because we shipped a default.
   */
  analytics?: boolean;
};

/**
 * Where to look up a place name or postcode the visitor types.
 *
 * The embed's search filters the snapshot's own locations by text; that finds a
 * shop *called* Manchester and nothing else. Real proximity search needs a table
 * of place names to coordinates, and geocoding one at view time is a metered
 * call in the visitor's path, which CLAUDE.md §2 rules out.
 *
 * So the table ships as static files, fetched lazily and cached by the browser —
 * the same thing this snapshot already is. `countries` is only the ones this
 * map's own locations sit in, so a UK map never fetches a byte of anything else,
 * and it is derived for free from `addressParts` at publish time.
 *
 * `base` is absolute: the embed runs on a customer's page, where a relative URL
 * would resolve against their domain. Baking it in means moving the files later
 * is a republish rather than a redeploy of every customer's embed — the same
 * trade `styleUrl` makes.
 */
export type SnapshotGazetteer = {
  /** Absolute, no trailing slash. Shards live at `{base}/{cc}/cities.json`. */
  base: string;
  /** ISO-2, uppercase, sorted. Empty means the block is omitted entirely. */
  countries: string[];
};

export type SnapshotBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type SnapshotCenter = {
  lat: number;
  lng: number;
  zoom: number;
};

export type MapSnapshot = {
  version: 1;
  /** ISO timestamp. Also the filename, which is what makes snapshots immutable. */
  generatedAt: string;
  mapId: string;
  name: string;
  slug: string;
  /**
   * Fully resolved basemap URL, not a style key. Moving from OpenFreeMap to our
   * own PMTiles on R2 (CLAUDE.md §7) then becomes a republish, not a redeploy of
   * every customer's embed.
   */
  styleUrl: string;
  /**
   * The owner chose "Auto", so the visitor decides.
   *
   * When true the embed reads the visitor's own `prefers-color-scheme`, and if
   * it says dark it recolours `styleUrl` in the browser rather than fetching a
   * different one — there is no second URL, because the dark basemap *is* the
   * light one inverted (lib/map/darken-style.ts). Absent means the owner pinned
   * one basemap and every visitor gets it, so read `theme` instead.
   */
  autoDark?: boolean;
  /**
   * Whether the pinned basemap is dark enough that the embed's panels have to be
   * too. Meaningless — and omitted — when `autoDark` is set, because then the
   * answer is only known at view time.
   *
   * Optional, and absent means light. Snapshots are immutable and live customer
   * sites keep reading the one they were published with (§7), so a new *required*
   * field would break every map published before this shipped until its owner
   * happened to republish.
   */
  theme?: "light" | "dark";
  /** OSM and tile-provider credit. Non-negotiable on every render (§12). */
  attribution: string;
  center: SnapshotCenter;
  /** Extent of the places, or null when the map has none. */
  bounds: SnapshotBounds | null;
  /**
   * **Legacy, read-only.** Categories were merged into tags: a tag now carries
   * its own colour and a location wears as many as apply. Nothing writes this
   * any more, and it is optional so a snapshot published today says nothing at
   * all about it — but every file published before the merge still has it, and
   * the embed still reads it to colour those maps (§7).
   */
  categories?: SnapshotCategory[];
  /**
   * The map's own pins, and only the ones a published place actually wears.
   *
   * Optional, and it has to stay that way for the same reason `hours` and `theme`
   * are: snapshots are immutable, so every file published before this field
   * existed is still live on a customer's site and must keep parsing.
   */
  pinIcons?: SnapshotPinIcon[];
  /**
   * The filter vocabulary, narrowed to tags a published place actually wears —
   * the same filter `categories` gets, and for the same reason: a chip that
   * matches nothing is a dead control on someone else’s website. Groups left
   * empty by that narrowing are dropped whole.
   *
   * Optional, on the immutability rule above.
   */
  tagGroups?: SnapshotTagGroup[];
  /**
   * The extra-field definitions, narrowed to ones at least one published place
   * fills in. Same rule: an empty field label on a card is a promise the map
   * does not keep.
   *
   * Optional, on the immutability rule above.
   */
  fields?: SnapshotField[];
  places: SnapshotPlace[];
  /**
   * Areas drawn on the map, under the pins.
   *
   * Optional, and it has to stay that way for the same reason `hours`, `theme`
   * and `pinIcons` are: snapshots are immutable, so every file published before
   * this field existed is still live on a customer's site and must keep parsing.
   * The version stays `1` — the embed's fetch rejects anything else outright.
   */
  shapes?: SnapshotShape[];
  /**
   * What the owner did to the basemap itself: the theme's recolouring, the label
   * level, the layer toggles. Applied to `styleUrl`'s style document before the
   * map is built (packages/shared/map-appearance.ts).
   *
   * The **resolved tint** travels here, not the theme's key. Snapshots are
   * immutable and a key is a promise that the key will still exist and still
   * mean the same thing years from now; fifteen numbers promise nothing and
   * cannot be broken by renaming a theme. It also keeps the theme table out of
   * the embed bundle — the embed needs the transform, never the catalogue.
   *
   * Optional, and omitted entirely when it would change nothing, for the same
   * reason `pinIcons` and `shapes` are: every file published before this existed
   * is still live on a customer's site and must keep rendering what it always
   * rendered. Mutually exclusive with `autoDark` in practice — Auto has no theme
   * to resolve, and its dark half is decided in the visitor's browser.
   */
  appearance?: MapAppearance;
  /**
   * Static place-name lookup for the search box — see SnapshotGazetteer.
   *
   * Optional, and omitted when the map has no locations we know the country of,
   * for the same reason `pinIcons`, `shapes` and `appearance` are: every file
   * published before this existed is still live on a customer's site and must
   * keep rendering what it always rendered. Absent means the search behaves
   * exactly as it did before this shipped.
   */
  gazetteer?: SnapshotGazetteer;
  /**
   * How the location card itself is laid out — which blocks it holds, in which
   * of its three zones, and how big each one is.
   *
   * Designed in the dashboard and baked in here, so the visitor's browser gets a
   * finished card and never a designer. The blocks are resolved and clamped
   * before they are written (packages/shared/card-layout.ts), which is what lets
   * the embed render one without re-deciding any of the rules.
   *
   * Optional, and **omitted entirely when it is the default** — for the same
   * reason `appearance`, `pinIcons` and `shapes` are: snapshots are immutable and
   * every file published before this existed is still live on a customer's site.
   * A map whose owner never opened the designer must keep publishing the bytes it
   * always did, and the embed must keep drawing the card it always drew.
   */
  cardLayout?: CardLayout;
  settings: SnapshotSettings;
  /**
   * Where to report what visitors do, when the owner has asked us to.
   *
   * **Absent means no tracking at all** — the behaviour of every map published
   * before this field existed, and of every map whose owner has left the switch
   * off. The embed reads this and nothing else: no endpoint, no beacon, no
   * listeners, no session id. `createTracker` returns a no-op and the call sites
   * cost a function call each (embed/src/track.ts).
   *
   * It carries the URL rather than a bare boolean because the embed cannot
   * derive one. It runs on a stranger's domain, so a relative path would post to
   * *their* server; and `NEXT_PUBLIC_EMBED_SCRIPT_URL` may point at a CDN that
   * is not the dashboard, so the script's own origin is not the answer either.
   * Baking the absolute URL at publish time is what makes both cases work, and
   * it is one field instead of two.
   */
  analytics?: SnapshotAnalytics;
  /**
   * Hostnames allowed to embed this map. Empty means "anywhere".
   * Anti-abuse, not security — anyone can copy the snapshot URL (§7).
   */
  allowedDomains: string[];
};

/** Where the embed posts what it saw. See `MapSnapshot.analytics`. */
export type SnapshotAnalytics = {
  /** Absolute, because the embed runs on somebody else's origin. */
  url: string;
};
