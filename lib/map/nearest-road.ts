/**
 * Which street is this pin standing on, read off the basemap's own tiles.
 *
 * The geocoder cannot answer this. Photon publishes a bounding box per feature
 * and never the polygon or the road centreline, so a pin on the pavement beside
 * an angled corner block falls inside that block's *box* and gets filed under the
 * building's street. Measured on the reported case: the pin was 1.2m from the
 * centreline of Sinagogų g. and 4.6m outside the walls of "Galinio Pylimo g. 7",
 * whose box nonetheless contained it.
 *
 * The tiles have what Photon lacks. `transportation_name` carries real
 * LineStrings, and the tile covering that pin is already downloaded and parsed to
 * draw the map — so this is a synchronous read of memory, not a request. Measured
 * at 0.9ms over one tile's 57 features, against an HTTP round trip to the
 * geocoder that takes hundreds of milliseconds. It costs nothing a person can
 * perceive, and it puts nothing in a visitor's path (CLAUDE.md §2): the editor is
 * the only thing that runs it.
 *
 * Pure and free of MapLibre types on purpose — it takes plain GeoJSON so it can
 * be tested against geometry lifted straight out of a real tile.
 */

import { metresToSegment } from "@/lib/geo/metres";
import type { LngLat } from "@/lib/geo/metres";

/** As much of a GeoJSON feature as this needs. MapLibre's own shape fits. */
export type RoadFeature = {
  properties?: Record<string, unknown> | null;
  geometry?: {
    type?: string;
    /** LineString, or MultiLineString one level deeper. */
    coordinates?: unknown;
  } | null;
};

export type NearestRoad = {
  /**
   * Every name the tile has for this road, in the order they should be preferred
   * for display: the English name first when there is one, then the local name.
   *
   * A list rather than a string because the geocoder answers in English —
   * "Gediminas Avenue" — while a tile's `name` is local: "Gedimino pr.". Both are
   * the same street, and comparing only one field would call that a disagreement
   * and throw away a correct address. OpenMapTiles carries `name`, `name:en`,
   * `name_en` and `name:latin`, so we keep them all and match on any.
   */
  names: string[];
  /** Shortest distance from the pin to this road's centreline. */
  distanceM: number;
};

/**
 * How far around the pin to consider roads at all.
 *
 * `querySourceFeatures` hands back every loaded tile's worth of roads, which is
 * the whole viewport — most of it nowhere near the pin. This bounds both the work
 * and the answer: past it, no road is the one the pin is on.
 */
const SEARCH_RADIUS_M = 250;

/** Rough degrees for the bbox pre-filter. Generous on purpose — it only prunes. */
const DEGREES_PER_METRE_LAT = 1 / 111_320;

/** Combining marks, so "Sinagogų" and "Sinagogu" fold to the same thing. */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function nearestRoad(
  features: readonly RoadFeature[],
  point: LngLat,
): NearestRoad | null {
  const latPad = SEARCH_RADIUS_M * DEGREES_PER_METRE_LAT;
  // Widened by latitude so the box stays at least as wide as it is tall.
  const lngPad = latPad / Math.max(Math.cos((point.lat * Math.PI) / 180), 0.01);

  let best: NearestRoad | null = null;

  for (const feature of features) {
    const names = namesOf(feature.properties);
    if (names.length === 0) continue;

    for (const line of linesOf(feature.geometry)) {
      for (let i = 0; i < line.length - 1; i++) {
        const from = line[i];
        const to = line[i + 1];

        // Cheap rejection before the trigonometry: a segment whose own box is
        // clear of the padded search box cannot be the nearest.
        if (
          Math.min(from.lng, to.lng) > point.lng + lngPad ||
          Math.max(from.lng, to.lng) < point.lng - lngPad ||
          Math.min(from.lat, to.lat) > point.lat + latPad ||
          Math.max(from.lat, to.lat) < point.lat - latPad
        ) {
          continue;
        }

        const distanceM = metresToSegment(point, from, to);
        if (distanceM > SEARCH_RADIUS_M) continue;
        if (best && distanceM >= best.distanceM) continue;

        best = { names, distanceM };
      }
    }
  }

  return best;
}

/**
 * Does the geocoder's street refer to the same road the tiles found?
 *
 * Compared loosely, because the two sources spell the same street differently:
 * different languages, diacritics, stray punctuation and case. Anything that
 * survives folding is a real disagreement.
 */
export function matchesRoad(
  street: string | undefined,
  road: { names: readonly string[] } | null | undefined,
): boolean {
  if (!street || !road) return false;

  const target = fold(street);
  if (!target) return false;

  return road.names.some((name) => fold(name) === target);
}

/** Casefolded, diacritics stripped, punctuation dropped, spaces collapsed. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Name variants, English first.
 *
 * The geocoder is asked with `lang=en`, so preferring the English spelling keeps
 * the street consistent with the town and country beside it in the same label.
 */
function namesOf(properties: RoadFeature["properties"]): string[] {
  if (!properties) return [];

  const seen = new Set<string>();
  const names: string[] = [];

  for (const key of ["name:en", "name_en", "name", "name:latin", "name_int"]) {
    const value = properties[key];
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    seen.add(trimmed);
    names.push(trimmed);
  }

  return names;
}

/** LineString and MultiLineString, as one shape. Anything else has no line. */
function linesOf(geometry: RoadFeature["geometry"]): LngLat[][] {
  const coordinates = geometry?.coordinates;
  if (!Array.isArray(coordinates)) return [];

  if (geometry?.type === "MultiLineString") {
    return coordinates.map(toLine).filter((line) => line.length > 1);
  }

  const line = toLine(coordinates);
  return line.length > 1 ? [line] : [];
}

function toLine(value: unknown): LngLat[] {
  if (!Array.isArray(value)) return [];

  const line: LngLat[] = [];

  for (const pair of value) {
    if (!Array.isArray(pair) || pair.length < 2) continue;

    const [lng, lat] = pair as [unknown, unknown];
    if (typeof lng !== "number" || typeof lat !== "number") continue;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    line.push({ lng, lat });
  }

  return line;
}
