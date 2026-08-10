import { isValidLngLat, roundCoord } from "@/lib/map/geo";
import {
  ATTRIBUTION_HTML,
  AUTO_STYLE,
  STYLE_URLS,
  isAutoMapStyle,
  isDarkMapStyle,
  resolveMapStyle,
  type MapStyleKey,
} from "@/lib/map/style";
import type { AppMap, Place } from "@/lib/repositories/types";
import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";
import { isEmptyHours } from "@/packages/shared/hours";
import type {
  MapSnapshot,
  SnapshotBounds,
  SnapshotCategory,
  SnapshotPlace,
} from "@/packages/shared/snapshot";

/**
 * Map + places → the static JSON a visitor's browser downloads.
 *
 * Pure on purpose: no Appwrite, no clock, no network. Publishing is the one
 * operation whose output lands on strangers' websites, so it has to be testable
 * without provisioning anything (CLAUDE.md §9). The upload lives in publish.ts.
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
      bounds: boundsOf(usable),
      categories: map.categories
        .filter((category) => used.has(category.id))
        .map(toSnapshotCategory),
      places: usable.map(toSnapshotPlace),
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
    return { styleUrl: STYLE_URLS[AUTO_STYLE], autoDark: true };
  }

  const resolved = resolveMapStyle(style);

  return {
    styleUrl: STYLE_URLS[resolved],
    theme: isDarkMapStyle(resolved) ? "dark" : "light",
  };
}

function toSnapshotCategory(category: SnapshotCategory): SnapshotCategory {
  return { id: category.id, label: category.label, color: category.color };
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

function boundsOf(places: Place[]): SnapshotBounds | null {
  if (places.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const place of places) {
    if (place.lng < west) west = place.lng;
    if (place.lng > east) east = place.lng;
    if (place.lat < south) south = place.lat;
    if (place.lat > north) north = place.lat;
  }

  return {
    west: roundCoord(west),
    south: roundCoord(south),
    east: roundCoord(east),
    north: roundCoord(north),
  };
}

