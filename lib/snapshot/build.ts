import { isValidLngLat, roundCoord } from "@/lib/map/geo";
import {
  ATTRIBUTION_HTML,
  isAutoMapStyle,
  isDarkMapStyle,
  resolveMapStyle,
  resolveStyleUrl,
  resolveTint,
  type MapStyleKey,
} from "@/lib/map/style";
import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";
import { readMapAppearance } from "@/lib/validation/map-appearance.schema";
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
import { MIN_POLYGON_POINTS, shapeBounds } from "@/packages/shared/shapes";
import type {
  MapSnapshot,
  SnapshotBounds,
  SnapshotCategory,
  SnapshotPinIcon,
  SnapshotPlace,
  SnapshotShape,
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
): BuildSnapshotResult {
  const usable: Place[] = [];
  const skipped: Place[] = [];

  for (const place of places) {
    // The only correctness filter worth applying. Status is not one: a row the
    // geocoder failed on but a human then dragged into position is saved as
    // "manual", so a surviving "failed" really does mean unplaced.
    (isValidLngLat(place.lng, place.lat) ? usable : skipped).push(place);
  }

  // Only categories in use. A legend offering a filter that matches nothing is
  // a dead control on someone else's website.
  const used = new Set(usable.map((place) => place.category).filter(Boolean));

  const pinIcons = usedPinIcons(map, usable);

  /*
   * A shape with no size is not publishable. A circle can be stored at radius
   * zero only if something has gone wrong upstream — the drawing tool floors it
   * — and a polygon under three points encloses nothing. Neither would draw, and
   * both would still cost bytes on every visitor's download.
   */
  const drawable = shapes.filter(isDrawableShape);

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
      categories: map.categories
        .filter((category) => used.has(category.id))
        .map(toSnapshotCategory),
      // Dropped entirely when empty, like every other optional field: on a map
      // with no custom pins this would be a bare `[]` on every visitor's
      // download, and an unused logo is measured in kilobytes, not bytes.
      ...(pinIcons.length > 0 ? { pinIcons } : {}),
      places: usable.map(toSnapshotPlace),
      // Dropped entirely when empty, like every other optional field — and this
      // one has to be, because absent is also what every snapshot published
      // before shapes existed says.
      ...(drawable.length > 0 ? { shapes: drawable.map(toSnapshotShape) } : {}),
      // Same rule again, and this one carries it furthest: a map whose owner
      // never opened the appearance menu publishes the exact bytes it published
      // before any of this existed.
      ...appearanceField(map),
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

function toSnapshotCategory(category: SnapshotCategory): SnapshotCategory {
  return { id: category.id, label: category.label, color: category.color };
}

/**
 * The map's own pins, narrowed to the ones a published place actually wears.
 *
 * The same filter categories get, and for a sharper reason: an unused category
 * is a dead chip in the legend, but an unused custom pin is a whole logo — a few
 * kilobytes of base64 — downloaded by every visitor to draw nothing.
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
function toSnapshotPlace(place: Place): SnapshotPlace {
  const snapshot: SnapshotPlace = {
    id: place.id,
    name: place.name,
    // Trimmed to ~1cm. Full float precision is noise that gzip can't remove.
    lat: roundCoord(place.lat),
    lng: roundCoord(place.lng),
  };

  if (place.address) snapshot.address = place.address;
  if (place.category) snapshot.category = place.category;
  if (place.icon) snapshot.icon = place.icon;
  if (place.description) snapshot.description = place.description;
  if (place.phone) snapshot.phone = place.phone;
  if (place.email) snapshot.email = place.email;
  if (place.url) snapshot.url = place.url;
  // An all-closed week is the same as no hours at all, and shipping seven nulls
  // per place would be pure weight on a 3,000-place map.
  if (!isEmptyHours(place.hours)) snapshot.hours = place.hours ?? undefined;
  if (place.photoUrl) snapshot.photoUrl = place.photoUrl;

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
  return shape.geometry.kind === "circle"
    ? shape.geometry.radius > 0
    : shape.geometry.points.length >= MIN_POLYGON_POINTS;
}

/**
 * Empty strings and nulls are dropped rather than serialised, as everywhere else
 * here, and the geometry is flattened into the union the embed reads.
 */
function toSnapshotShape(shape: Shape): SnapshotShape {
  const common = {
    id: shape.id,
    name: shape.name,
    color: shape.color,
    opacity: shape.opacity,
    ...(shape.description ? { description: shape.description } : {}),
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

  return {
    ...common,
    kind: "polygon",
    points: shape.geometry.points.map(([lng, lat]) => [
      roundCoord(lng),
      roundCoord(lat),
    ]),
  };
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

