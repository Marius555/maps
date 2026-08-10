/**
 * Choosing which of Photon's reverse results is the address at a pin.
 *
 * Photon's `/reverse` answers "what OSM objects are near this point", ranked by
 * distance — and the nearest object is usually a building or a POI. Its `street`
 * property is the street *that object* is addressed on, which is not the same
 * question as "what street is this pin standing on". Asking for `limit=1` and
 * taking the first feature therefore reads a shop's postal address off the
 * corner building and files the pin under a street it is nowhere near. Because
 * which object is nearest changes as the pin moves, it is right about as often as
 * it is wrong, which is the worst way for it to be wrong.
 *
 * So we ask for many features in the same request — one round trip either way,
 * same throttle slot — and decide here. Pure and dependency-free: the selection
 * rules *are* the behaviour, and they are unreachable through `reverse()`
 * without a network round trip.
 */

import { metresBetween, metresToBounds } from "@/lib/geo/metres";
import { matchesRoad } from "@/lib/map/nearest-road";
import type { NearestRoad } from "@/lib/map/nearest-road";

/** Photon's address parts. `extent` is `[west, north, east, south]`. */
export type PhotonProperties = {
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  /** Present for ways and relations, absent for nodes — a node has no footprint. */
  extent?: [number, number, number, number];
  /** Kept so a saved row can be traced back to the OSM object it came from. */
  osm_type?: string;
  osm_id?: number;
};

export type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
};

export type ReverseMatch = {
  properties: PhotonProperties;
  /** Metres from the pin — to the feature's footprint when it has one. */
  distanceM: number;
};

/**
 * How close a feature with no footprint has to be to count as the thing the pin
 * is on. A node is a single coordinate, so containment is not available and
 * proximity is all there is.
 */
const POINT_HIT_M = 10;

/**
 * Past this, nothing found is an answer about this pin.
 *
 * A pin dropped offshore or on a moor used to come back with whatever Photon had
 * nearest, stated as confidently as a rooftop match. Nothing is the honest reply:
 * the row then says "Couldn't find an address" and offers a retry, which is a
 * small piece of work rather than a quiet lie.
 */
export const REVERSE_MAX_DISTANCE_M = 300;

/**
 * The address at `point`, or null when nothing near it is one.
 *
 * Two rules, in order:
 *
 * 1. **The thing the pin is on.** Someone marking their shop drops the pin on the
 *    building, so a feature whose footprint contains the point is what they meant
 *    — full address, house number included. Containment first and proximity only
 *    after it: a pin inside one building and eight metres from a doorway node
 *    belonging to the next is on the first.
 *
 * 2. **Otherwise the nearest street.** The pin is on a roadway, a square or a car
 *    park, and the truthful answer is the street without a number. We do not
 *    borrow the house number of a building nearby: a number nobody placed is a
 *    guess, and a guessed number is this bug in miniature — it looks answered, so
 *    nobody checks it.
 *
 * `road` is the street measured off the basemap's own tiles, when the caller had
 * a map to measure against. It is the tiebreak Photon cannot provide: see the
 * comment on `agreesWith` below, and lib/map/nearest-road.ts for why.
 */
export function selectReverseFeature(
  features: readonly PhotonFeature[],
  point: { lat: number; lng: number },
  road?: NearestRoad | null,
): ReverseMatch | null {
  const candidates = features
    .map((feature) => describe(feature, point))
    .filter((candidate): candidate is Candidate => candidate !== null);

  const match =
    onSite(candidates, road) ?? nearestStreet(candidates, road) ?? fromRoad(road, candidates);
  if (!match) return null;

  return match.distanceM > REVERSE_MAX_DISTANCE_M ? null : match;
}

/**
 * A building the geocoder picked is only believable if the tiles agree the pin is
 * on its street.
 *
 * Photon returns a bounding box per feature, never the polygon. An angled corner
 * block's box covers the pavement and part of the road beside it, so a pin on the
 * road lands "inside" the building and inherits a street 51m away. That is the
 * whole reported bug, and it cannot be settled from Photon's response: measured
 * against a nine-point sample, every correct answer agreed with the tiles and
 * only the broken one disagreed.
 *
 * With no `road` — no map, no tiles loaded, nothing named nearby — this is not a
 * disagreement, it is an absence, and the geocoder's answer stands as before.
 */
function agreesWith(
  properties: PhotonProperties,
  road: NearestRoad | null | undefined,
): boolean {
  if (!road) return true;
  return matchesRoad(properties.street, road);
}

type Candidate = {
  properties: PhotonProperties;
  /** To the footprint when there is one, to the feature's own point otherwise. */
  distanceM: number;
  /** To the feature's own point, always. What ranking within a class uses. */
  centroidM: number;
  /** The pin is inside this feature's footprint. */
  containsPin: boolean;
  /** A footprintless feature close enough to be what the pin is on. */
  isNearNode: boolean;
  isStreet: boolean;
};

function describe(
  feature: PhotonFeature,
  point: { lat: number; lng: number },
): Candidate | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const [lng, lat] = coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const properties = feature.properties ?? {};
  const extent = validExtent(properties.extent);
  const centroidM = metresBetween(point, { lat, lng });

  const distanceM = extent ? metresToBounds(point, extent) : centroidM;

  /*
   * A street is never a site hit, and neither is anything without a street of its
   * own.
   *
   * A street's extent is the bounding box of a way, and the box of anything
   * diagonal covers a great deal of ground the road does not touch — measured in
   * Vilnius, a pin inside a building had a street 60m away "containing" it.
   * Streets are ranked in rule 2 instead, by their own point, which is close
   * enough because Photon indexes each OSM way separately rather than the street
   * as a whole.
   *
   * The `street` requirement excludes two kinds of thing that would otherwise
   * win outright: a sculpture or a bench, which can sit right under the pin and
   * carry no address at all, and a postcode polygon — the same response for a
   * Vilnius pin contained one covering 99 square kilometres.
   */
  const canBeSite = !isStreet(properties) && Boolean(properties.street);

  return {
    properties,
    distanceM,
    centroidM,
    containsPin: canBeSite && extent !== null && distanceM === 0,
    isNearNode: canBeSite && extent === null && centroidM <= POINT_HIT_M,
    isStreet: isStreet(properties),
  };
}

/**
 * What the pin is standing on, if anything is.
 *
 * Containment is a whole class above proximity, not a tiebreak within it. Ranking
 * the two together let a shop's doorway node 19m away beat the building the pin
 * was actually inside — a different street, from a feature that never contained
 * the point.
 *
 * Within a class, nearest centroid wins. Real footprints overlap: two adjacent
 * Vilnius buildings both contained the same pin, at 1,577m² and 1,781m², and
 * picking the smaller got the wrong one by a 200m² margin that means nothing.
 * The nearer centroid got it right, and it also settles the case the size rule
 * was for — a unit inside a block sits nearer to a pin dropped on the unit than
 * the block's own middle does.
 */
function onSite(
  candidates: readonly Candidate[],
  road: NearestRoad | null | undefined,
): ReverseMatch | null {
  // Anything the tiles contradict is not a site hit at all — a box that reaches
  // across a road is not a building the pin is standing on.
  const onStreet = candidates.filter((candidate) =>
    agreesWith(candidate.properties, road),
  );

  const containing = onStreet.filter((candidate) => candidate.containsPin);
  const nearNodes = onStreet.filter((candidate) => candidate.isNearNode);

  const best = nearest(containing.length > 0 ? containing : nearNodes);
  if (!best) return null;

  /*
   * The footprint distance, not the centroid's — zero for anything containing the
   * pin. Ranking wants to know which building is nearer; confidence wants to know
   * whether we are on one at all, and a warehouse whose middle is 40m away is
   * still the building the pin is inside.
   */
  return { properties: best.properties, distanceM: best.distanceM };
}

/**
 * The nearest street Photon knows of, preferring the one the tiles measured.
 *
 * Photon indexes a street way by one representative point, so its idea of
 * "nearest" is a centroid comparison between road segments — good enough when it
 * is all we have, and beaten outright by a real centreline when it is not. When
 * the tiles named a road, take Photon's matching street feature: it carries the
 * town, postcode and country that the tiles do not.
 */
function nearestStreet(
  candidates: readonly Candidate[],
  road: NearestRoad | null | undefined,
): ReverseMatch | null {
  const streets = candidates.filter(
    (candidate) => candidate.isStreet && candidate.properties.name,
  );

  const measured = road
    ? streets.filter((candidate) => matchesRoad(candidate.properties.name, road))
    : [];

  const best = nearest(measured.length > 0 ? measured : road ? [] : streets);
  if (!best) return null;

  // A street's own point, for the reason its bounding box is not used to rank it.
  return { properties: asStreet(best.properties), distanceM: best.centroidM };
}

/**
 * The tiles named a road that Photon has nothing matching for.
 *
 * Rare but real: the geocoder's nearest street way can be a different road
 * entirely, and answering with that one would be the original bug wearing a
 * different hat. The street name is the tiles'; the town, postcode and country
 * are borrowed from whichever nearby Photon feature carries them, since every
 * feature around a pin agrees about those.
 */
function fromRoad(
  road: NearestRoad | null | undefined,
  candidates: readonly Candidate[],
): ReverseMatch | null {
  const name = road?.names[0];
  if (!road || !name) return null;

  const nearby = nearest(candidates);

  return {
    properties: {
      type: "street",
      street: name,
      city: nearby?.properties.city,
      district: nearby?.properties.district,
      postcode: nearby?.properties.postcode,
      state: nearby?.properties.state,
      country: nearby?.properties.country,
      countrycode: nearby?.properties.countrycode,
    },
    distanceM: road.distanceM,
  };
}

/** Nearest by the feature's own point, which is the measure they all share. */
function nearest(candidates: readonly Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((winner, candidate) =>
    candidate.centroidM < winner.centroidM ? candidate : winner,
  );
}

/**
 * A street feature carries its name in `name` and leaves `street` empty, which is
 * the opposite of what the formatters read. Rewritten here so they keep one rule
 * instead of learning about Photon's feature types.
 *
 * `housenumber` is cleared rather than trusted: whatever a street way happens to
 * carry is not the number at this pin.
 */
function asStreet(properties: PhotonProperties): PhotonProperties {
  return {
    ...properties,
    street: properties.name,
    name: undefined,
    housenumber: undefined,
  };
}

function isStreet(properties: PhotonProperties): boolean {
  return properties.type === "street";
}

function validExtent(
  extent: PhotonProperties["extent"],
): [number, number, number, number] | null {
  if (!extent || extent.length < 4) return null;
  return extent.every(Number.isFinite) ? extent : null;
}

