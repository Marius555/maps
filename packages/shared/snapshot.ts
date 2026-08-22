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

import type { OpeningHours } from "./hours";
import type { MapAppearance } from "./map-appearance";
import type { PinRingWidth, PinShape, PinSize } from "./pin-icons";

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
  /** Category id, matching SnapshotCategory.id. Absent when uncategorised. */
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
  /** Public storage URL, composed on the server so no bucket id ships. */
  photoUrl?: string;
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
  /** 0–1. The fill only; the outline is always drawn solid. */
  opacity: number;
  description?: string;
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
   */
  | { kind: "line"; points: [number, number][] }
);

/** Which of the embed's optional controls are switched on. */
export type SnapshotSettings = {
  clustering: boolean;
  search: boolean;
  filters: boolean;
  nearest: boolean;
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
  categories: SnapshotCategory[];
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
  settings: SnapshotSettings;
  /**
   * Hostnames allowed to embed this map. Empty means "anywhere".
   * Anti-abuse, not security — anyone can copy the snapshot URL (§7).
   */
  allowedDomains: string[];
};
