import { gazetteerCountries } from "@/lib/gazetteer/config";
import { isValidLngLat, roundCoord } from "@/lib/map/geo";
import { placeIndex, resolveGeometry } from "@/lib/map/line-endpoints";
import {
  ATTRIBUTION_HTML,
  isAutoMapStyle,
  isDarkMapStyle,
  resolveMapStyle,
  resolveStyleUrl,
  resolveTint,
  type MapStyleKey,
} from "@/lib/map/style";
import type {
  AppMap,
  MapField,
  MapTagGroup,
  Place,
  Shape,
} from "@/lib/repositories/types";
import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";
import { isDefaultCardLayout } from "@/lib/validation/card-layout.schema";
import { readMapAppearance } from "@/lib/validation/map-appearance.schema";
import { resolveCardLayout, type CardLayout } from "@/packages/shared/card-layout";
import {
  isPlainAppearance,
  type MapAppearance,
} from "@/packages/shared/map-appearance";
import { isEmptyHours } from "@/packages/shared/hours";
import {
  CUSTOM_PIN_PREFIX,
  DEFAULT_PIN_SHAPE,
  DEFAULT_PIN_SIZE,
  DEFAULT_RING_WIDTH,
} from "@/packages/shared/pin-icons";
import {
  MIN_LINE_POINTS,
  MIN_POLYGON_POINTS,
  shapeBounds,
} from "@/packages/shared/shapes";
import type {
  MapSnapshot,
  SnapshotBounds,
  SnapshotField,
  SnapshotPinIcon,
  SnapshotPlace,
  SnapshotShape,
  SnapshotTagGroup,
} from "@/packages/shared/snapshot";

/**
 * Map + places → the static JSON a visitor's browser downloads.
 *
 * Pure on purpose: no Appwrite, no clock, no network. Publishing is the one
 * operation whose output lands on strangers' websites, so it has to be testable
 * without provisioning anything (CLAUDE.md §9). The upload lives in publish.ts.
 *
 * Groups are absent, and that is deliberate rather than unfinished. A group is
 * how the owner organises the editor's sidebar; a visitor cannot see one or act
 * on one, and every field here is bytes downloaded by everyone who loads the
 * customer's page. `groupId` is on the `Place` and `Shape` domain types and must
 * not be copied through.
 */

export type BuildSnapshotResult = {
  snapshot: MapSnapshot;
  /**
   * Places left out because their coordinates were unusable. Surfaced so the
   * publish response can say "42 of 43 locations published" rather than quietly
   * dropping one.
   */
  skipped: Place[];
};

export function buildSnapshot(
  map: AppMap,
  places: Place[],
  shapes: Shape[],
  generatedAt: string,
  /**
   * Absolute base URL for the search gazetteer, or omitted for none.
   *
   * Injected rather than read from the environment here, for the same reason
   * `generatedAt` is injected rather than read off the clock: this function has
   * to stay pure and testable without provisioning anything (§9). The caller
   * resolves it — `lib/gazetteer/config.ts` — because only the caller knows the
   * origin, and on the server that comes off the request.
   */
  gazetteerBase?: string,
  /**
   * The account's own card design, or `null`/omitted for none.
   *
   * Passed in rather than read off `map`: the card design moved from a per-map
   * column to one design per account (lib/repositories/card-design.repository.ts),
   * and this function has to stay pure — it cannot look the account up itself,
   * for the same reason `generatedAt` and `gazetteerBase` are injected above.
   */
  cardLayout?: CardLayout | null,
): BuildSnapshotResult {
  const usable: Place[] = [];
  const skipped: Place[] = [];

  for (const place of places) {
    // The only correctness filter worth applying. Status is not one: a row the
    // geocoder failed on but a human then dragged into position is saved as
    // "manual", so a surviving "failed" really does mean unplaced.
    (isValidLngLat(place.lng, place.lat) ? usable : skipped).push(place);
  }

  const pinIcons = usedPinIcons(map, usable);

  /*
   * The filter vocabulary and the extra fields, narrowed to what the published
   * places actually use: a chip that matches nothing is a dead control on
   * someone else's website. Both also decide what a *place* may carry — a
   * location can be storing a tag id or a field value the map no longer defines
   * (nothing sweeps those up on delete, see maps.repository.ts), and those must
   * not reach a visitor who has nothing to resolve them against.
   */
  const tagGroups = usedTagGroups(map.tagGroups, usable);
  const definedTags = new Set(
    tagGroups.flatMap((group) => group.tags.map((tag) => tag.id)),
  );

  const fields = usedFields(map.fields, usable);
  const definedFields = new Set(fields.map((field) => field.id));

  /*
   * Bonded lines are pinned down before anything measures or publishes them.
   *
   * A line that connects two locations stores their ids and treats its own
   * coordinates as a fallback, so publishing it as stored would ship whatever it
   * was drawn against rather than where those locations ended up. Resolved
   * against `usable`, not `places`: an endpoint bonded to a location that never
   * got coordinates has nothing to resolve to, and falling back to the stored
   * point is the right answer there.
   */
  const located = placeIndex(usable);
  const resolved = shapes.map((shape) => ({
    ...shape,
    geometry: resolveGeometry(shape.geometry, located),
  }));

  /*
   * A shape with no size is not publishable. A circle can be stored at radius
   * zero only if something has gone wrong upstream — the drawing tool floors it
   * — and a polygon under three points encloses nothing. Neither would draw, and
   * both would still cost bytes on every visitor's download.
   */
  const drawable = resolved.filter(isDrawableShape);

  return {
    snapshot: {
      version: 1,
      generatedAt,
      mapId: map.id,
      name: map.name,
      slug: map.slug,
      ...basemapFields(map.style),
      attribution: ATTRIBUTION_HTML,
      center: {
        lat: map.defaultLat,
        lng: map.defaultLng,
        zoom: map.defaultZoom,
      },
      // Over the shapes as well as the pins. A map whose content is one delivery
      // radius has no places to frame, and used to open on `center` at whatever
      // zoom happened to be saved — often nowhere near the thing it is about.
      bounds: boundsOf(usable, drawable),
      /*
       * `categories` is not written any more, and its absence is the point.
       *
       * The field stays *readable* on `MapSnapshot` because a file published
       * before tags absorbed categories is live on somebody's site and is read
       * forever (§7) — but a map republished from here on carries its whole
       * vocabulary in `tagGroups`, so writing an empty array would only be bytes
       * saying nothing.
       */
      // Dropped entirely when empty, like every other optional field: on a map
      // with no custom pins this would be a bare `[]` on every visitor's
      // download, and an unused logo is measured in kilobytes, not bytes.
      ...(pinIcons.length > 0 ? { pinIcons } : {}),
      ...(tagGroups.length > 0 ? { tagGroups } : {}),
      ...(fields.length > 0 ? { fields } : {}),
      places: usable.map((place) =>
        toSnapshotPlace(place, definedTags, definedFields),
      ),
      // Dropped entirely when empty, like every other optional field — and this
      // one has to be, because absent is also what every snapshot published
      // before shapes existed says.
      ...(drawable.length > 0 ? { shapes: drawable.map(toSnapshotShape) } : {}),
      // Same rule again, and this one carries it furthest: a map whose owner
      // never opened the appearance menu publishes the exact bytes it published
      // before any of this existed.
      ...appearanceField(map),
      ...cardLayoutField(cardLayout),
      ...gazetteerField(gazetteerBase, usable),
      settings: readEmbedSettings(map.settings),
      allowedDomains: map.allowedDomains,
    },
    skipped,
  };
}

/**
 * The basemap half of the snapshot: one resolved URL, plus either "the visitor
 * decides" or the fixed answer.
 *
 * Auto ships a single URL and `autoDark`, with no `theme`. There is no second
 * URL to ship, because Auto's dark half is this same style recoloured in the
 * browser (lib/map/darken-style.ts) — and whether to recolour it is only known
 * once a visitor's browser reports its colour scheme. A pinned basemap ships the
 * URL and the answer, because it is the same for everyone.
 *
 * Resolved to a URL rather than a key for the same reason as before: moving to
 * our own PMTiles on R2 becomes a republish, not a redeploy of every customer's
 * embed (packages/shared/snapshot.ts).
 */
function basemapFields(
  style: MapStyleKey,
): Pick<MapSnapshot, "styleUrl" | "autoDark" | "theme"> {
  if (isAutoMapStyle(style)) {
    return { styleUrl: resolveStyleUrl(style), autoDark: true };
  }

  return {
    styleUrl: resolveStyleUrl(style),
    theme: isDarkMapStyle(resolveMapStyle(style)) ? "dark" : "light",
  };
}

/**
 * The appearance half: the theme's tint resolved to numbers, plus whatever the
 * owner did to labels and layers.
 *
 * Resolved here rather than in the embed because a theme key is a name we own
 * and could rename, while a published snapshot is read forever by sites we do
 * not control (§7). Shipping the numbers means a renamed or retired theme leaves
 * every live map exactly as it was.
 */
function appearanceField(map: AppMap): { appearance?: MapAppearance } {
  const stored = readMapAppearance(map.appearance);
  const tint = resolveTint(map.style);

  const appearance: MapAppearance = {
    ...(tint ? { tint } : {}),
    labels: stored.labels,
    layers: stored.layers,
  };

  return isPlainAppearance(appearance) ? {} : { appearance };
}

/**
 * The card design, or nothing at all.
 *
 * Resolved on the way out — every number clamped, every misplaced block dropped
 * — so the embed reads a layout it can draw without re-deciding any of the
 * rules. `resolveCardLayout` runs regardless of whether the caller already
 * resolved its input, which is what keeps this safe against a hand-edited
 * value and idempotent against an already-clamped one.
 *
 * Omitted when it is the untouched default, which is the load-bearing half. An
 * account that has never opened the designer publishes the exact bytes it
 * published before any of this existed, on every map it owns, and the embed
 * falls back to the card it has always drawn (§7).
 */
function cardLayoutField(
  cardLayout: CardLayout | null | undefined,
): { cardLayout?: CardLayout } {
  const layout = resolveCardLayout(cardLayout ?? {});

  return isDefaultCardLayout(layout) ? {} : { cardLayout: layout };
}

/**
 * The search gazetteer, or nothing at all.
 *
 * Omitted in two cases, and both matter. Without a base there is nowhere to
 * fetch from, so publishing one would be a URL the embed 404s on every
 * keystroke. Without countries there is nothing to fetch — a map whose pins were
 * all dropped by hand has no `addressParts` and we genuinely do not know where
 * they are — and an empty list would have the embed asking for shards it can
 * never name.
 *
 * Only `usable` places count. A row we could not place is not on the published
 * map, and its country is not one a visitor can search into.
 */
function gazetteerField(
  base: string | undefined,
  places: Place[],
): { gazetteer?: MapSnapshot["gazetteer"] } {
  if (!base) return {};

  const countries = gazetteerCountries(places);
  if (countries.length === 0) return {};

  // Trailing slash stripped here rather than at every join site in the embed.
  return { gazetteer: { base: base.replace(/\/+$/, ""), countries } };
}

/**
 * The map's own pins, narrowed to the ones a published place actually wears.
 *
 * The same filter the tag vocabulary gets, and for a sharper reason: an unused
 * tag is a dead chip in the filter row, but an unused custom pin is a whole logo
 * — a few kilobytes of base64 — downloaded by every visitor to draw nothing.
 */
function usedPinIcons(map: AppMap, places: Place[]): SnapshotPinIcon[] {
  const worn = new Set(
    places
      .map((place) => place.icon)
      .filter((icon) => icon.startsWith(CUSTOM_PIN_PREFIX))
      .map((icon) => icon.slice(CUSTOM_PIN_PREFIX.length)),
  );

  return map.pinIcons
    .filter((icon) => worn.has(icon.id))
    .map((icon) => ({
      id: icon.id,
      color: icon.color,
      // Exactly one of these is set, and the empty one is dropped rather than
      // serialised as "" — the embed reads absent and empty the same way.
      ...(icon.glyph ? { glyph: icon.glyph } : {}),
      ...(icon.image ? { image: icon.image } : {}),
      // The design fields, on the same rule: a pin that took the default said
      // nothing, so the snapshot says nothing either and the embed defaults to
      // the same value. Most pins are the default on most of these.
      ...(icon.ring ? { ring: icon.ring } : {}),
      ...(icon.ringWidth && icon.ringWidth !== DEFAULT_RING_WIDTH
        ? { ringWidth: icon.ringWidth }
        : {}),
      ...(icon.iconColor ? { iconColor: icon.iconColor } : {}),
      ...(icon.size && icon.size !== DEFAULT_PIN_SIZE ? { size: icon.size } : {}),
      ...(icon.shape && icon.shape !== DEFAULT_PIN_SHAPE ? { shape: icon.shape } : {}),
    }));
}

/**
 * Empty strings and nulls are dropped rather than serialised. Across 3,000
 * places the absent keys are a meaningful slice of the download, and the embed
 * reads absent and empty identically.
 */
/**
 * The map's tag groups, narrowed to tags a published place actually wears.
 *
 * The same filter categories get, and it does two jobs at once. It drops chips
 * that would match nothing — a dead control on someone else's website — and it
 * is also what defines "a real tag" for the places below: an id that survives
 * this is one the map still lists *and* someone still uses.
 *
 * A group left with no tags is dropped whole. A heading over an empty row is
 * worse than no heading.
 */
function usedTagGroups(
  groups: MapTagGroup[],
  places: Place[],
): SnapshotTagGroup[] {
  const worn = new Set(places.flatMap((place) => place.tags));

  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      tags: group.tags
        .filter((tag) => worn.has(tag.id))
        // The colour travels, because since categories merged into tags it is
        // what the embed draws the *pin* from, not only the chip.
        .map((tag) => ({ id: tag.id, label: tag.label, color: tag.color })),
    }))
    .filter((group) => group.tags.length > 0);
}

/**
 * The map's extra fields, narrowed to ones at least one published place fills in.
 *
 * An empty value is not a filled-in one: `placeFieldsSchema` already strips
 * those on the way in, but a row written before that existed — or by an older
 * build — can still hold `""`, and a field label with nothing under it on every
 * card is a promise the map does not keep.
 */
function usedFields(fields: MapField[], places: Place[]): SnapshotField[] {
  const answered = new Set(
    places.flatMap((place) =>
      Object.entries(place.fields)
        .filter(([, value]) => value !== "")
        .map(([id]) => id),
    ),
  );

  return fields
    .filter((field) => answered.has(field.id))
    .map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      showAs: field.showAs,
    }));
}

function toSnapshotPlace(
  place: Place,
  definedTags: ReadonlySet<string>,
  definedFields: ReadonlySet<string>,
): SnapshotPlace {
  const snapshot: SnapshotPlace = {
    id: place.id,
    name: place.name,
    // Trimmed to ~1cm. Full float precision is noise that gzip can't remove.
    lat: roundCoord(place.lat),
    lng: roundCoord(place.lng),
  };

  if (place.address) snapshot.address = place.address;
  if (place.icon) snapshot.icon = place.icon;
  if (place.description) snapshot.description = place.description;
  if (place.phone) snapshot.phone = place.phone;
  if (place.email) snapshot.email = place.email;
  if (place.url) snapshot.url = place.url;
  // An all-closed week is the same as no hours at all, and shipping seven nulls
  // per place would be pure weight on a 3,000-place map.
  if (!isEmptyHours(place.hours)) snapshot.hours = place.hours ?? undefined;
  /*
   * The cover always, the gallery only when there is one.
   *
   * `photoUrl` keeps exactly the meaning it has always had, so a card built by
   * an embed published before galleries existed still finds its picture — and a
   * place with a single photo pays no duplicate bytes for saying so twice.
   */
  if (place.photoUrl) snapshot.photoUrl = place.photoUrl;
  if (place.photoUrls.length > 1) snapshot.photoUrls = place.photoUrls;

  /*
   * Narrowed, not copied: a place can be wearing a tag the map deleted, and the
   * embed has nothing to resolve that id against. Omitted entirely when nothing
   * survives, like every other optional field here.
   *
   * `filter` and not a re-sort, and that is load-bearing rather than incidental:
   * the location's own order decides which tag colours its pin, so publishing
   * these in the map's vocabulary order would repaint pins at publish time.
   */
  const tags = place.tags.filter((id) => definedTags.has(id));
  if (tags.length > 0) snapshot.tags = tags;

  const fields = Object.fromEntries(
    Object.entries(place.fields).filter(
      ([id, value]) => definedFields.has(id) && value !== "",
    ),
  );
  if (Object.keys(fields).length > 0) snapshot.fields = fields;

  return snapshot;
}

/**
 * Would this shape draw anything?
 *
 * Publishing is the last place to catch a shape that cannot be seen. A polygon
 * under three points has no interior, and a circle at radius zero is a dot — both
 * are rows that would be downloaded by every visitor to render nothing.
 */
function isDrawableShape(shape: Shape): boolean {
  if (shape.geometry.kind === "circle") return shape.geometry.radius > 0;

  // Two points for a line, three for an area. A line of two is a real line; a
  // polygon of two is a line pretending to be one.
  const floor =
    shape.geometry.kind === "line" ? MIN_LINE_POINTS : MIN_POLYGON_POINTS;

  return shape.geometry.points.length >= floor;
}

/**
 * Empty strings and nulls are dropped rather than serialised, as everywhere else
 * here, and the geometry is flattened into the union the embed reads.
 */
function toSnapshotShape(shape: Shape): SnapshotShape {
  /*
   * The stroke is written only where it says something.
   *
   * `strokeWidth` is null for every shape whose owner has never opened the
   * control, and `strokeStyle` is "solid" for every one of them — so a map that
   * predates these fields, or simply never used them, publishes byte-identical
   * JSON to the file it published before they existed. That is the same
   * discipline `description` and `durationS` already follow, and it is what
   * keeps a republish from being a change to a customer's live site.
   */
  const common = {
    id: shape.id,
    name: shape.name,
    color: shape.color,
    opacity: shape.opacity,
    ...(shape.description ? { description: shape.description } : {}),
    ...(shape.strokeWidth ? { strokeWidth: shape.strokeWidth } : {}),
    ...(shape.strokeStyle !== "solid" ? { strokeStyle: shape.strokeStyle } : {}),
  };

  if (shape.geometry.kind === "circle") {
    return {
      ...common,
      kind: "circle",
      lat: roundCoord(shape.geometry.lat),
      lng: roundCoord(shape.geometry.lng),
      // Whole metres. A boundary specified to the millimetre is precision nobody
      // drew and gzip cannot compress away.
      radius: Math.round(shape.geometry.radius),
    };
  }

  const points: [number, number][] = shape.geometry.points.map(([lng, lat]) => [
    roundCoord(lng),
    roundCoord(lat),
  ]);

  /*
   * `from`, `to` and a route's `stops` are deliberately not carried across. They
   * name rows in a database the embed has no access to and no reason to want one
   * — the points above are already resolved, so the bond has nothing left to
   * contribute except bytes on every visitor's download.
   *
   * `durationS` is the exception, and the reason is that it is the one thing the
   * geometry cannot give back. A line's *length* is a sum over its own points,
   * measured wherever it is drawn (packages/shared/geo.ts), which is why no
   * distance is written here — a number shipped beside the geometry it describes
   * is one republish away from disagreeing with it. How long the drive takes
   * depends on speed limits and turn penalties that never reach the points, so
   * either it travels or the visitor never learns it.
   *
   * Omitted for a hand-drawn line, on the rule every optional field here follows:
   * a line published before routes existed must keep publishing the same bytes.
   */
  return shape.geometry.kind === "line"
    ? {
        ...common,
        kind: "line",
        points,
        ...(shape.geometry.route
          ? { durationS: Math.round(shape.geometry.route.durationS) }
          : {}),
      }
    : { ...common, kind: "polygon", points };
}

/**
 * The extent of everything on the map, or null when there is nothing on it.
 *
 * Shapes count. The embed opens by fitting these bounds, and a map that is one
 * service area with no pins in it would otherwise have no extent at all.
 */
function boundsOf(places: Place[], shapes: Shape[]): SnapshotBounds | null {
  if (places.length === 0 && shapes.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const extend = (box: { west: number; south: number; east: number; north: number }) => {
    if (box.west < west) west = box.west;
    if (box.east > east) east = box.east;
    if (box.south < south) south = box.south;
    if (box.north > north) north = box.north;
  };

  for (const place of places) {
    extend({
      west: place.lng,
      east: place.lng,
      south: place.lat,
      north: place.lat,
    });
  }

  for (const shape of shapes) {
    // A circle's box is its diameter, not its centre — the same function the
    // renderers use, so the frame agrees with what gets drawn in it.
    const box = shapeBounds(shape.geometry);
    if (box) extend(box);
  }

  // Every row was unusable in a way boundsOf could not measure.
  if (west === Infinity) return null;

  return {
    west: roundCoord(west),
    south: roundCoord(south),
    east: roundCoord(east),
    north: roundCoord(north),
  };
}

