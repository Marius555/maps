import { describe, expect, it } from "vitest";

import {
  REVERSE_MAX_DISTANCE_M,
  selectReverseFeature,
  selectVenue,
} from "./reverse-select";
import type { PhotonFeature } from "./reverse-select";

/**
 * The reported bug in one sentence: a pin dropped on one street came back
 * addressed on another, and moving the pin changed the answer.
 *
 * Photon ranks its reverse results by distance, so the first one is the nearest
 * *object* — and a building's `street` is the street it is addressed on, not the
 * one the pin is standing on. These cases are built from real responses captured
 * from photon.komoot.io around Vilnius old town, coordinates and extents intact,
 * because the shape of the data is the whole reason the old selection failed.
 */

/** Where the pin goes in most of these: on the roadway, on no building. */
const PIN = { lat: 54.6744, lng: 25.2852 };

function street(
  name: string,
  centre: [number, number],
  extent: [number, number, number, number],
): PhotonFeature {
  return {
    geometry: { coordinates: centre },
    properties: { type: "street", name, city: "Vilnius", extent },
  };
}

function building(
  properties: {
    housenumber?: string;
    street?: string;
    name?: string;
  },
  centre: [number, number],
  extent?: [number, number, number, number],
): PhotonFeature {
  return {
    geometry: { coordinates: centre },
    properties: { type: "house", city: "Vilnius", ...properties, extent },
  };
}

describe("selectReverseFeature", () => {
  it("takes the address of the building the pin is standing inside", () => {
    // The pin is within this footprint, so this is the building someone marking
    // their shop meant — house number included.
    const inside = building(
      { housenumber: "56", street: "Pylimo g.", name: "Centro poliklinika" },
      [25.28515, 54.67445],
      [25.2849, 54.6746, 25.2856, 54.6742],
    );

    const match = selectReverseFeature(
      [
        street("Sodų g.", [25.28535, 54.67452], [25.2851, 54.6748, 25.2857, 54.6743]),
        inside,
      ],
      PIN,
    );

    expect(match?.properties.street).toBe("Pylimo g.");
    expect(match?.properties.housenumber).toBe("56");
    // Inside the footprint, so distance zero however far off the middle is —
    // the confidence must not be docked for a wide building.
    expect(match?.distanceM).toBe(0);
  });

  it("prefers the nearer of two overlapping footprints", () => {
    /*
     * Real buildings overlap. This pair is from Vilnius: both boxes contain the
     * same pin at 1,577m² and 1,781m², so size decides nothing — picking the
     * smaller named the wrong street by a 200m² margin. The nearer middle is the
     * building the pin is on.
     */
    const nearer = building(
      { housenumber: "4", street: "Šv. Stepono g." },
      [25.2829018, 54.6749972],
      [25.2826, 54.67515, 25.2833, 54.67485],
    );
    const overlapping = building(
      { housenumber: "45", street: "Pylimo g." },
      [25.2830204, 54.6752704],
      [25.2827, 54.67545, 25.2834, 54.67505],
    );
    const pin = { lat: 54.6751, lng: 25.283 };

    expect(
      selectReverseFeature([overlapping, nearer], pin)?.properties.street,
    ).toBe("Šv. Stepono g.");
    // Order in the response must not decide it.
    expect(
      selectReverseFeature([nearer, overlapping], pin)?.properties.street,
    ).toBe("Šv. Stepono g.");
  });

  it("picks the unit the pin is on rather than the block around it", () => {
    // The nested case the size rule was written for. A pin dropped on the unit
    // is nearer to the unit's middle than to the block's.
    const block = building(
      { housenumber: "12", street: "Pylimo g." },
      [25.2848, 54.6740],
      [25.2840, 54.6752, 25.2864, 54.6736],
    );
    const unit = building(
      { housenumber: "12A", street: "Pylimo g." },
      [25.28521, 54.67441],
      [25.2851, 54.67445, 25.2853, 54.67435],
    );

    expect(selectReverseFeature([block, unit], PIN)?.properties.housenumber).toBe(
      "12A",
    );
  });

  it("puts containment above proximity", () => {
    /*
     * A doorway node belonging to the building next door can be closer to the pin
     * than the middle of the building the pin is standing inside. Containment is
     * the stronger claim, and treating the two as one ranking picked the
     * neighbour's street.
     */
    const containing = building(
      { housenumber: "4", street: "Šv. Stepono g." },
      [25.28535, 54.67432],
      [25.2849, 54.6746, 25.2856, 54.6742],
    );
    const closerNode = building({ housenumber: "45", street: "Pylimo g." }, [
      25.28524,
      54.67443,
    ]);

    expect(
      selectReverseFeature([closerNode, containing], PIN)?.properties.street,
    ).toBe("Šv. Stepono g.");
  });

  it("ignores a postcode polygon that swallows the whole city", () => {
    // Real: a Vilnius response contained a 99km² postcode area. It has no street,
    // so it can never be an address — but it contains every pin in the city.
    const postcode: PhotonFeature = {
      geometry: { coordinates: [25.28, 54.68] },
      properties: { type: "postcode", name: "01136", postcode: "01136", extent: [25.20, 54.75, 25.40, 54.60] },
    };

    const match = selectReverseFeature(
      [
        postcode,
        street("Sodų g.", [25.28535, 54.67452], [25.2851, 54.6748, 25.2857, 54.6743]),
      ],
      PIN,
    );

    expect(match?.properties.street).toBe("Sodų g.");
  });

  it("ignores a nameless landmark sitting right under the pin", () => {
    /*
     * This is how a location's address became "Sculpture of Leonard Cohen". A
     * statue is the nearest object and carries no street at all, so it cannot be
     * an address however close it is.
     */
    const sculpture: PhotonFeature = {
      geometry: { coordinates: [25.28521, 54.67441] },
      properties: { type: "house", name: "Sculpture of Leonard Cohen", city: "Vilnius" },
    };

    const match = selectReverseFeature(
      [
        sculpture,
        street("Sodų g.", [25.28535, 54.67452], [25.2851, 54.6748, 25.2857, 54.6743]),
      ],
      PIN,
    );

    expect(match?.properties.street).toBe("Sodų g.");
  });

  it("names the street, with no house number, when the pin is on no building", () => {
    /*
     * The reported bug. The nearest object is a building 20m away addressed on
     * Galinio Pylimo; the pin is on Sinagogų g. Taking the first feature reported
     * the neighbour's street — and borrowing its number would have been worse
     * still, since nobody placed a "7" here.
     */
    const match = selectReverseFeature(
      [
        building(
          { housenumber: "7", street: "Galinio Pylimo g." },
          [25.28545, 54.67425],
          [25.2853, 54.67435, 25.2856, 54.67415],
        ),
        street("Sinagogų g.", [25.28525, 54.67443], [25.2850, 54.67455, 25.2855, 54.6743]),
        street("Galinio Pylimo g.", [25.2857, 54.6741], [25.2855, 54.6743, 25.2859, 54.6739]),
      ],
      PIN,
    );

    expect(match?.properties.street).toBe("Sinagogų g.");
    expect(match?.properties.housenumber).toBeUndefined();
    // The name is folded into `street` so the formatters keep one rule.
    expect(match?.properties.name).toBeUndefined();
  });

  it("ranks streets by their own point, not by their bounding box", () => {
    /*
     * A long diagonal way has a bounding box covering a great deal of ground it
     * never touches — measured in Vilnius, one "contained" a pin 60m away. So the
     * near street must win even though the far one's box swallows the pin.
     */
    const near = street(
      "Sinagogų g.",
      [25.28525, 54.67443],
      [25.2851, 54.67450, 25.2854, 54.67436],
    );
    const sprawling = street(
      "Pylimo g.",
      [25.2880, 54.6770],
      [25.2820, 54.6800, 25.2900, 54.6720],
    );

    expect(selectReverseFeature([sprawling, near], PIN)?.properties.street).toBe(
      "Sinagogų g.",
    );
  });

  it("returns nothing when the nearest street is too far to be this pin's", () => {
    // Offshore, or on a moor. Naming a road half a kilometre away would look
    // answered, and nothing is the honest reply.
    const far = street("Pylimo g.", [25.2852, 54.6790], [25.2851, 54.6791, 25.2853, 54.6789]);

    expect(selectReverseFeature([far], PIN)).toBeNull();
  });

  it("still answers a street just inside the distance guard", () => {
    const metresOfLatitude = (m: number) => m / 111_320;
    const justInside = REVERSE_MAX_DISTANCE_M - 20;
    const lat = PIN.lat + metresOfLatitude(justInside);

    const match = selectReverseFeature(
      [street("Pylimo g.", [PIN.lng, lat], [PIN.lng - 0.0001, lat + 0.0001, PIN.lng + 0.0001, lat - 0.0001])],
      PIN,
    );

    expect(match?.properties.street).toBe("Pylimo g.");
    expect(match?.distanceM).toBeLessThan(REVERSE_MAX_DISTANCE_M);
  });

  it("returns nothing for an empty response", () => {
    expect(selectReverseFeature([], PIN)).toBeNull();
  });

  it("skips features with unusable geometry rather than throwing", () => {
    const broken: PhotonFeature[] = [
      {},
      { geometry: {} },
      { geometry: { coordinates: [Number.NaN, 54.6744] } },
    ];

    expect(selectReverseFeature(broken, PIN)).toBeNull();

    expect(
      selectReverseFeature(
        [
          ...broken,
          street("Sodų g.", [25.28535, 54.67452], [25.2851, 54.6748, 25.2857, 54.6743]),
        ],
        PIN,
      )?.properties.street,
    ).toBe("Sodų g.");
  });

  it("treats a node on top of the pin as a hit when it has a street", () => {
    // A POI mapped as a single point has no footprint to be inside, so proximity
    // is the only test available.
    const shop = building({ housenumber: "45", street: "Pylimo g.", name: "Aibė" }, [
      25.28521,
      54.67441,
    ]);

    expect(selectReverseFeature([shop], PIN)?.properties.housenumber).toBe("45");
  });

  describe("with a street measured off the basemap tiles", () => {
    /*
     * The reported bug, reduced. The pin is on Sinagogų g.; the bounding box of
     * the angled block addressed "Galinio Pylimo g. 7" reaches across the
     * pavement and contains it. Photon cannot tell these apart — it publishes
     * boxes, not polygons — so the tiles' real centreline decides.
     */
    const corner = building(
      { housenumber: "7", street: "Galinio Pylimo g." },
      [25.28532, 54.67428],
      [25.2849, 54.6746, 25.2856, 54.6742],
    );

    it("refuses a building the tiles put on another street", () => {
      const match = selectReverseFeature([corner], PIN, {
        names: ["Sinagogų g."],
        distanceM: 1.2,
      });

      expect(match?.properties.street).toBe("Sinagogų g.");
      expect(match?.properties.housenumber).toBeUndefined();
    });

    it("keeps the full address when the tiles agree with it", () => {
      const match = selectReverseFeature([corner], PIN, {
        names: ["Galinio Pylimo g."],
        distanceM: 8,
      });

      expect(match?.properties.street).toBe("Galinio Pylimo g.");
      expect(match?.properties.housenumber).toBe("7");
    });

    it("matches across the language the two sources answer in", () => {
      // Photon is asked with lang=en and says "Gediminas Avenue"; the tile's
      // local name is "Gedimino pr.". Treating that as a disagreement would
      // throw away a correct house number.
      const match = selectReverseFeature(
        [
          building(
            { housenumber: "16", street: "Gediminas Avenue" },
            [25.28532, 54.67428],
            [25.2849, 54.6746, 25.2856, 54.6742],
          ),
        ],
        PIN,
        { names: ["Gediminas Avenue", "Gedimino pr."], distanceM: 19.8 },
      );

      expect(match?.properties.housenumber).toBe("16");
    });

    it("borrows the town and postcode when only the tiles know the street", () => {
      // Photon's nearest street way is a different road, so its name is not an
      // answer — but its city and postcode are true of anywhere around here.
      const match = selectReverseFeature(
        [corner, street("Galinio Pylimo g.", [25.2857, 54.6741], [25.2855, 54.6743, 25.2859, 54.6739])],
        PIN,
        { names: ["Sinagogų g."], distanceM: 1.2 },
      );

      expect(match?.properties.street).toBe("Sinagogų g.");
      expect(match?.properties.city).toBe("Vilnius");
      expect(match?.distanceM).toBeCloseTo(1.2, 5);
    });

    it("changes nothing when no road was measured", () => {
      // No map, no tiles, zoomed out: the geocoder's answer stands exactly as it
      // did before any of this existed.
      const withoutRoad = selectReverseFeature([corner], PIN);
      const withNull = selectReverseFeature([corner], PIN, null);

      expect(withoutRoad?.properties.housenumber).toBe("7");
      expect(withNull?.properties.housenumber).toBe("7");
    });
  });

  it("does not treat a distant node as a hit", () => {
    // Same shop, moved 80m away: too far to be what the pin is on, so the street
    // rule answers instead.
    const shop = building({ housenumber: "45", street: "Pylimo g." }, [25.2852, 54.67512]);
    const near = street("Sinagogų g.", [25.28525, 54.67443], [25.2851, 54.6745, 25.2854, 54.6743]);

    const match = selectReverseFeature([shop, near], PIN);

    expect(match?.properties.street).toBe("Sinagogų g.");
    expect(match?.properties.housenumber).toBeUndefined();
  });
});

/**
 * The venue name is a different question from the address, and these are the
 * cases where the two answers disagree.
 *
 * The reported bug: adding a location through the address search showed the
 * landmark under the postcode, and dropping a pin on the same building showed
 * only the postcode. The address rules were throwing the name away — `asStreet`
 * clears it, and `agreesWith` discards a whole building when the tiles name a
 * different nearest road. Neither should cost a landmark its name.
 */
const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

type Sides = { west: number; east: number; north: number; south: number };

/** A footprint, described by how far past the pin it reaches on each side. */
function boxAround(
  point: { lat: number; lng: number },
  { west, east, north, south }: Sides,
): [number, number, number, number] {
  const perLng = mPerDegLng(point.lat);

  return [
    point.lng - west / perLng,
    point.lat + north / M_PER_DEG_LAT,
    point.lng + east / perLng,
    point.lat - south / M_PER_DEG_LAT,
  ];
}

/** A node `metres` east of the pin, with no footprint of its own. */
function nodeEastOfPin(name: string, metres: number): PhotonFeature {
  return building(
    { name, street: "Pylimo g." },
    [PIN.lng + metres / mPerDegLng(PIN.lat), PIN.lat],
  );
}

const SQUARE_20M: Sides = { west: 20, east: 20, north: 20, south: 20 };

describe("selectVenue", () => {
  it("names the venue the pin is standing well inside", () => {
    const museum = building(
      { housenumber: "1", street: "A. Goštauto g.", name: "Vytautas Kasiulis Museum of Art" },
      [25.2852, 54.6744],
      boxAround(PIN, SQUARE_20M),
    );

    expect(selectVenue([museum], PIN)).toBe("Vytautas Kasiulis Museum of Art");
  });

  it("ignores a footprint the pin is only just inside", () => {
    /*
     * The pavement case, and the whole reason for the inset. Photon publishes a
     * bounding box rather than a polygon, so an angled building's box reaches
     * over the footway and the road — a pin one metre in from an edge is beside
     * the building, not in it, and naming it would be a confident lie.
     */
    const overreaching = building(
      { street: "A. Goštauto g.", name: "Vytautas Kasiulis Museum of Art" },
      [25.2852, 54.6744],
      boxAround(PIN, { west: 1, east: 60, north: 60, south: 60 }),
    );

    expect(selectVenue([overreaching], PIN)).toBeNull();
  });

  it("ignores a street, which carries its name in the same field", () => {
    const road = street("Pylimo g.", [25.2852, 54.6744], boxAround(PIN, SQUARE_20M));

    expect(selectVenue([road], PIN)).toBeNull();
  });

  it("ignores an area far too big to be a venue", () => {
    // The postcode polygon that swallowed 99km² of Vilnius, and any district
    // like it: it really does contain the pin, so only its size rules it out.
    const district = building(
      { name: "Senamiestis" },
      [25.2852, 54.6744],
      boxAround(PIN, { west: 5000, east: 5000, north: 5000, south: 5000 }),
    );

    expect(selectVenue([district], PIN)).toBeNull();
  });

  it("ignores a building with no name to give", () => {
    const anonymous = building(
      { housenumber: "56", street: "Pylimo g." },
      [25.2852, 54.6744],
      boxAround(PIN, SQUARE_20M),
    );

    expect(selectVenue([anonymous], PIN)).toBeNull();
  });

  it("names a footprintless node sitting on top of the pin", () => {
    // A shop mapped as a single point has no footprint to be inside, so
    // proximity is all there is — the same 10m the address rules use.
    expect(selectVenue([nodeEastOfPin("Skalvija", 3)], PIN)).toBe("Skalvija");
  });

  it("ignores a node too far away to be what the pin is on", () => {
    expect(selectVenue([nodeEastOfPin("Zenoteca", 40)], PIN)).toBeNull();
  });

  it("prefers the nearer of two venues that both contain the pin", () => {
    // A unit inside a block: both footprints hold the pin, and the one whose
    // own point is nearer is the one it was dropped on.
    const block = building(
      { name: "Europa Business Centre", street: "Konstitucijos pr." },
      [25.2857, 54.6749],
      boxAround(PIN, { west: 60, east: 60, north: 60, south: 60 }),
    );
    const unit = building(
      { name: "Skalvija", street: "Konstitucijos pr." },
      [25.28522, 54.67442],
      boxAround(PIN, SQUARE_20M),
    );

    expect(selectVenue([block, unit], PIN)).toBe("Skalvija");
  });

  it("returns null for an empty response", () => {
    expect(selectVenue([], PIN)).toBeNull();
  });

  it("skips features with unusable geometry rather than throwing", () => {
    const broken: PhotonFeature = { properties: { name: "Nowhere", type: "house" } };

    expect(selectVenue([broken], PIN)).toBeNull();
  });

  /*
   * The regression itself, both halves in one case.
   *
   * The tiles measure a different street from the museum's postal one — a corner
   * building, or one set back — so `agreesWith` rejects it and the address
   * correctly falls through to the road the pin is actually on. The name must
   * survive that, because the pin is still inside the museum.
   */
  it("names a venue whose address the tiles overruled", () => {
    const museum = building(
      { housenumber: "1", street: "A. Goštauto g.", name: "Vytautas Kasiulis Museum of Art" },
      [25.2852, 54.6744],
      boxAround(PIN, SQUARE_20M),
    );
    const measured = street("Pylimo g.", [25.28525, 54.67443], [25.2851, 54.6745, 25.2854, 54.6743]);
    const road = { names: ["Pylimo g."], distanceM: 2 };

    const match = selectReverseFeature([museum, measured], PIN, road);

    // The address is the street the tiles measured, with no borrowed number...
    expect(match?.properties.street).toBe("Pylimo g.");
    expect(match?.properties.housenumber).toBeUndefined();
    // ...and the landmark is still named, which is what the row's second line
    // prints after the postcode.
    expect(selectVenue([museum, measured], PIN)).toBe("Vytautas Kasiulis Museum of Art");
  });
});
