import { describe, expect, it } from "vitest";

import { HIGH_CONFIDENCE } from "./confidence";
import {
  formatTitle,
  needsStreet,
  precisionFor,
  selectReverse,
  toAddressParts,
  toCandidate,
  type GeoapifyProperties,
} from "./geoapify";
import { REVERSE_MAX_DISTANCE_M } from "./reverse-select";

/**
 * The mapping, not the transport.
 *
 * Same split the Photon adapter's tests make: what this adapter decides is how a
 * Geoapify feature becomes a candidate, and none of it is reachable through
 * `search()` without a network round trip.
 */

function props(overrides: Partial<GeoapifyProperties> = {}): GeoapifyProperties {
  return {
    lat: 54.687,
    lon: 25.28,
    formatted: "Gedimino pr. 1, 01103 Vilnius, Lithuania",
    address_line1: "Gedimino pr. 1",
    housenumber: "1",
    street: "Gedimino pr.",
    postcode: "01103",
    city: "Vilnius",
    country: "Lithuania",
    country_code: "lt",
    result_type: "building",
    rank: { match_type: "full_match" },
    ...overrides,
  };
}

describe("precisionFor", () => {
  it("maps Geoapify's result types onto the precision ladder", () => {
    expect(precisionFor(props({ result_type: "building" }))).toBe("house");
    expect(precisionFor(props({ result_type: "amenity" }))).toBe("house");
    expect(precisionFor(props({ result_type: "street" }))).toBe("street");
    expect(precisionFor(props({ result_type: "city" }))).toBe("city");
    expect(precisionFor(props({ result_type: "country" }))).toBe("country");
  });

  /*
   * The whole reason match_type is read. A street-shaped answer reached only by
   * matching the city is not an answer about that street, and without the ceiling
   * it scores 0.7 and sails past the review step.
   */
  it("caps a fine result type by how coarsely the query actually matched", () => {
    expect(
      precisionFor(
        props({ result_type: "street", rank: { match_type: "match_by_city_or_district" } }),
      ),
    ).toBe("city");
  });

  it("does not promote a coarse result because the match claimed to be finer", () => {
    expect(
      precisionFor(props({ result_type: "city", rank: { match_type: "match_by_street" } })),
    ).toBe("city");
  });

  it("falls back to the match ceiling when the result type is unknown", () => {
    expect(
      precisionFor(
        props({ result_type: "unheard_of", rank: { match_type: "match_by_postcode" } }),
      ),
    ).toBe("district");
  });

  it("has no opinion when neither field says anything", () => {
    expect(precisionFor(props({ result_type: undefined, rank: undefined }))).toBeNull();
  });
});

describe("toCandidate", () => {
  it("reads the coordinates off lat/lon", () => {
    const candidate = toCandidate(props());

    expect(candidate?.lat).toBe(54.687);
    expect(candidate?.lng).toBe(25.28);
  });

  it("uses Geoapify's own formatted line as the label", () => {
    expect(toCandidate(props())?.label).toBe(
      "Gedimino pr. 1, 01103 Vilnius, Lithuania",
    );
  });

  it("scores a rooftop match high enough to accept without review", () => {
    const candidate = toCandidate(props());

    expect(candidate?.confidence).toBeGreaterThanOrEqual(HIGH_CONFIDENCE);
  });

  /*
   * The line the import review step depends on: a city centroid must still be
   * flagged for a human, whichever provider produced it.
   */
  it("keeps a city-level match below the review threshold", () => {
    const candidate = toCandidate(
      props({
        result_type: "city",
        housenumber: undefined,
        street: undefined,
        rank: { match_type: "match_by_city_or_district" },
      }),
    );

    expect(candidate?.confidence).toBeLessThan(HIGH_CONFIDENCE);
  });

  /*
   * Measured against the live API: "Gedimino pr. 99999, Vilnius" — a house number
   * that does not exist — answers `result_type: "building"` with
   * `match_type: "full_match"`, which the precision ladder alone scores 0.95 and
   * waves straight past the review step. Geoapify says 0.5 in `rank.confidence`.
   */
  it("lets Geoapify's own doubt push an invented house number into review", () => {
    const candidate = toCandidate(
      props({
        housenumber: "99999",
        rank: { match_type: "full_match", confidence: 0.5 },
      }),
    );

    expect(candidate?.confidence).toBeLessThan(HIGH_CONFIDENCE);
  });

  it("does not penalise a result the provider is sure of", () => {
    const sure = toCandidate(props({ rank: { match_type: "full_match", confidence: 1 } }));
    const silent = toCandidate(props({ rank: { match_type: "full_match" } }));

    expect(sure?.confidence).toBe(silent?.confidence);
    expect(sure?.confidence).toBeGreaterThanOrEqual(HIGH_CONFIDENCE);
  });

  it("refuses a feature with no usable coordinates", () => {
    expect(toCandidate(props({ lat: undefined }))).toBeNull();
    expect(toCandidate(props({ lon: Number.NaN }))).toBeNull();
    expect(toCandidate(undefined)).toBeNull();
  });
});

describe("toAddressParts", () => {
  it("renames Geoapify's keys to this codebase's spelling", () => {
    expect(toAddressParts(props())).toMatchObject({
      housenumber: "1",
      street: "Gedimino pr.",
      postcode: "01103",
      city: "Vilnius",
      country: "Lithuania",
      countryCode: "LT",
    });
  });

  it("drops empty fields rather than storing them as blanks", () => {
    const parts = toAddressParts(props({ postcode: "", city: undefined }));

    expect(parts).not.toHaveProperty("postcode");
    expect(parts).not.toHaveProperty("city");
  });

  /*
   * Geoapify's `place_id` is not an OSM object id, and a row traced back through
   * one written into `osmId` would resolve to nothing.
   */
  it("never writes an OSM id it does not have", () => {
    const parts = toAddressParts(props({ place_id: "51a0..." }));

    expect(parts).not.toHaveProperty("osmId");
    expect(parts).not.toHaveProperty("osmType");
  });
});

describe("formatTitle", () => {
  /*
   * The Kasiulis Museum rule, kept across the provider swap: `address_line1`
   * leads with the amenity name, and a title that names a museum without saying
   * where it is is memorable and not an address.
   */
  it("leads with the street, not the venue name", () => {
    expect(formatTitle(props({ name: "Vytautas Kasiulis Museum of Art" }))).toBe(
      "Gedimino pr. 1, Vilnius",
    );
  });

  it("leads with the name when there is no street at all", () => {
    expect(
      formatTitle(
        props({ name: "Vingis Park", street: undefined, housenumber: undefined }),
      ),
    ).toBe("Vingis Park, Vilnius");
  });
});

describe("needsStreet", () => {
  const at = (distance: number, street = "Gedimino pr.") =>
    props({ distance, street, result_type: "building" });

  it("does not ask when the pin is standing on a building", () => {
    expect(needsStreet([at(3)])).toBe(false);
  });

  /*
   * The measured case: at a pin on Gedimino pr. the nearest building was 33m
   * away across the road, and the street the pin was 8m from appears in no
   * unfiltered reverse response at all.
   */
  it("asks when the nearest building is across the road", () => {
    expect(needsStreet([at(32.7, "V. Kudirkos a.")])).toBe(true);
  });

  it("asks when there is nothing near at all", () => {
    expect(needsStreet([])).toBe(true);
  });

  it("asks when a near building disagrees with the road the tiles measured", () => {
    expect(
      needsStreet([at(3, "Galinio Pylimo g.")], {
        names: ["Sinagogu g."],
        distanceM: 1.2,
      }),
    ).toBe(true);
  });
});

describe("selectReverse", () => {
  const building = (distance: number, street: string) =>
    props({ distance, street, result_type: "building", housenumber: "11B" });

  const street = (distance: number, name: string) =>
    props({ distance, street: name, result_type: "street", housenumber: undefined });

  /* Vilnius Cathedral, measured: building 8.2m, nearest street 24.9m. */
  it("takes the building the pin is standing on over a further street", () => {
    const chosen = selectReverse([building(8.2, "Katedros a.")], street(24.9, "Cathedral Square"));

    expect(chosen?.street).toBe("Katedros a.");
    expect(chosen?.housenumber).toBe("11B");
  });

  /*
   * Gedimino pr., measured: nearest building 32.7m on another street, the street
   * itself 8.3m. Answering with the building files the pin under a street it is
   * nowhere near, with a house number nobody placed.
   */
  it("takes the street when the nearest building is across the road", () => {
    const chosen = selectReverse(
      [building(32.7, "V. Kudirkos a.")],
      street(8.3, "Gediminas Avenue"),
    );

    expect(chosen?.street).toBe("Gediminas Avenue");
    expect(chosen?.housenumber).toBeUndefined();
  });

  /*
   * The tiles carry the road's real centreline and the geocoder carries a point,
   * so when they disagree about which street a pin is on, the tiles win.
   */
  it("prefers whatever agrees with the street measured off the tiles", () => {
    const chosen = selectReverse(
      [building(4, "Galinio Pylimo g."), building(9, "Sinagogų g.")],
      null,
      { names: ["Sinagogu g."], distanceM: 1.2 },
    );

    expect(chosen?.street).toBe("Sinagogų g.");
  });

  it("falls back to the nearest when nothing agrees with the tiles", () => {
    const chosen = selectReverse([building(4, "Galinio Pylimo g.")], null, {
      names: ["Somewhere else"],
      distanceM: 4,
    });

    expect(chosen?.street).toBe("Galinio Pylimo g.");
  });

  it("takes the street when there is no building at all", () => {
    expect(selectReverse([], street(40, "Gediminas Avenue"))?.street).toBe(
      "Gediminas Avenue",
    );
  });

  /* Past this, nothing found is an answer about this pin. */
  it("answers null when the nearest thing is too far to be about the pin", () => {
    expect(
      selectReverse([building(REVERSE_MAX_DISTANCE_M + 1, "Gedimino pr.")], null),
    ).toBeNull();
  });

  it("answers null for an empty response and for one with no distance", () => {
    expect(selectReverse([], null)).toBeNull();
    expect(selectReverse([props({ distance: undefined })], null)).toBeNull();
  });
});
