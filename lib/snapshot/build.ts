import { isValidLngLat, roundCoord } from "@/lib/map/geo";
import { ATTRIBUTION_HTML, STYLE_URLS } from "@/lib/map/style";
import type { AppMap, Place } from "@/lib/repositories/types";
import type {
  MapSnapshot,
  SnapshotBounds,
  SnapshotCategory,
  SnapshotPlace,
  SnapshotSettings,
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

const DEFAULT_SETTINGS: SnapshotSettings = {
  clustering: true,
  search: true,
  filters: true,
  nearest: true,
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
      styleUrl: STYLE_URLS[map.style],
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
      settings: readSettings(map.settings),
      allowedDomains: map.allowedDomains,
    },
    skipped,
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

/**
 * `settings` is a free-form JSON column that may have been written by an older
 * build or edited in the console, so every flag falls back to its default
 * rather than trusting the stored shape.
 */
function readSettings(settings: Record<string, unknown>): SnapshotSettings {
  return {
    clustering: readFlag(settings.clustering, DEFAULT_SETTINGS.clustering),
    search: readFlag(settings.search, DEFAULT_SETTINGS.search),
    filters: readFlag(settings.filters, DEFAULT_SETTINGS.filters),
    nearest: readFlag(settings.nearest, DEFAULT_SETTINGS.nearest),
  };
}

function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
