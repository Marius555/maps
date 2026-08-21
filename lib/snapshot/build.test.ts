import { describe, expect, it } from "vitest";

import { AUTO_STYLE, BASEMAP_SOURCES, CONCRETE_MAP_STYLES } from "@/lib/map/style";
import type { AppMap, MapCategory, Place, Shape } from "@/lib/repositories/types";
import { emptyHours } from "@/packages/shared/hours";
import { buildSnapshot } from "./build";

const GENERATED_AT = "2026-08-08T10:00:00.000Z";

function makeMap(overrides: Partial<AppMap> = {}): AppMap {
  return {
    id: "map-1",
    userId: "user-1",
    name: "Stockists",
    slug: "stockists",
    style: "liberty",
    defaultLat: 54.687,
    defaultLng: 25.28,
    defaultZoom: 11,
    categories: [],
    pinIcons: [],
    settings: {},
    appearance: {},
    allowedDomains: [],
    publishedAt: null,
    snapshotUrl: null,
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    ...overrides,
  };
}

function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    mapId: "map-1",
    name: "Central store",
    lat: 54.687,
    lng: 25.28,
    address: "Gedimino pr. 1, Vilnius",
    category: "",
    icon: "",
    description: null,
    phone: null,
    email: null,
    url: null,
    hours: null,
    photoId: null,
    photoUrl: null,
    sortOrder: 0,
    geocodeConfidence: null,
    addressParts: null,
    groupId: "",
    geocodeStatus: "ok",
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    ...overrides,
  };
}

function makeShape(overrides: Partial<Shape> = {}): Shape {
  return {
    id: "shape-1",
    mapId: "map-1",
    name: "Delivery zone",
    description: null,
    color: "#1c7ed6",
    opacity: 0.2,
    geometry: { kind: "circle", lng: 25.28, lat: 54.687, radius: 1200 },
    sortOrder: 0,
    groupId: "",
    createdAt: GENERATED_AT,
    updatedAt: GENERATED_AT,
    ...overrides,
  };
}

const category = (id: string, label: string): MapCategory => ({
  id,
  label,
  color: "#2563eb",
});

describe("buildSnapshot", () => {
  it("carries the map's identity, centre and attribution", () => {
    const { snapshot } = buildSnapshot(makeMap(), [makePlace()], [], GENERATED_AT);

    expect(snapshot.version).toBe(1);
    expect(snapshot.generatedAt).toBe(GENERATED_AT);
    expect(snapshot.mapId).toBe("map-1");
    expect(snapshot.slug).toBe("stockists");
    expect(snapshot.center).toEqual({ lat: 54.687, lng: 25.28, zoom: 11 });
    // Attribution is non-negotiable on every render (CLAUDE.md §12), so it
    // travels in the snapshot rather than being hardcoded in the embed.
    expect(snapshot.attribution).toContain("OpenStreetMap");
  });

  it("resolves the style to a full URL so the embed ships no style table", () => {
    const { snapshot } = buildSnapshot(makeMap({ style: "positron" }), [], [], GENERATED_AT);

    expect(snapshot.styleUrl).toMatch(/^https:\/\//);
    expect(snapshot.styleUrl).toContain("positron");
  });

  it("resolves every pinned basemap to its own URL", () => {
    for (const style of BASEMAP_SOURCES) {
      const { snapshot } = buildSnapshot(makeMap({ style }), [], [], GENERATED_AT);

      expect(snapshot.styleUrl).toMatch(/^https:\/\//);
      expect(snapshot.styleUrl).toContain(style);
    }
  });

  /**
   * Sources and themes alike. A theme has no URL of its own — it is Liberty
   * recoloured — so what has to hold for all sixteen is the weaker claim: a
   * usable URL, and nothing left for the visitor to decide.
   */
  it("leaves nothing to decide at view time for any pinned style", () => {
    for (const style of CONCRETE_MAP_STYLES) {
      const { snapshot } = buildSnapshot(makeMap({ style }), [], [], GENERATED_AT);

      expect(snapshot.styleUrl).toMatch(/^https:\/\//);
      expect(snapshot.autoDark).toBeUndefined();
    }
  });

  /**
   * The numbers, not the name. A theme key is something we own and could rename;
   * a snapshot is read forever by sites we do not control, so what travels is
   * the resolved transform.
   */
  it("publishes a theme as its resolved tint, never as its key", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ style: "verdant" }),
      [],
      [],
      GENERATED_AT,
    );

    expect(snapshot.appearance?.tint?.ground.hue).toBeTypeOf("number");
    expect(JSON.stringify(snapshot)).not.toContain("verdant");
  });

  /**
   * The rule every optional field here follows: a map whose owner never opened
   * the appearance menu publishes the bytes it published before any of this
   * existed. Live embeds read absent as "leave the basemap alone".
   */
  it("omits appearance entirely when it would change nothing", () => {
    const { snapshot } = buildSnapshot(makeMap(), [], [], GENERATED_AT);

    expect(snapshot.appearance).toBeUndefined();
  });

  it("carries a label level and layer toggles the owner actually changed", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ appearance: { labels: "some", layers: { poi: false } } }),
      [],
      [],
      GENERATED_AT,
    );

    expect(snapshot.appearance?.labels).toBe("some");
    expect(snapshot.appearance?.layers?.poi).toBe(false);
    // Absent keys fall back to what the basemap ships, not to `undefined`.
    expect(snapshot.appearance?.layers?.transit).toBe(true);
  });

  /** A hand-edited console row must not publish nonsense to live sites. */
  it("ignores a stored appearance of the wrong shape", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ appearance: { labels: "everything", layers: "yes" } }),
      [],
      [],
      GENERATED_AT,
    );

    expect(snapshot.appearance).toBeUndefined();
  });

  /**
   * The embed colours its own panels from this. For a pinned basemap it is
   * decided at publish time and travels in the snapshot; for Auto it cannot be,
   * which is what the next test is about.
   */
  it("marks dark basemaps so the embed can match its chrome", () => {
    expect(buildSnapshot(makeMap({ style: "dark" }), [], [], GENERATED_AT).snapshot.theme).toBe(
      "dark",
    );
    expect(buildSnapshot(makeMap({ style: "fiord" }), [], [], GENERATED_AT).snapshot.theme).toBe(
      "dark",
    );
    expect(
      buildSnapshot(makeMap({ style: "liberty" }), [], [], GENERATED_AT).snapshot.theme,
    ).toBe("light");
  });

  /**
   * Auto ships one basemap and no verdict. There is no second URL because the
   * dark half is this one recoloured in the visitor's browser — and whether to
   * recolour it depends on their own colour scheme, which is not knowable when
   * the snapshot is written. So `theme` must be absent, or the embed would have
   * a stale answer sitting next to the live one.
   */
  it("ships one basemap, a flag and no fixed theme for Auto", () => {
    const { snapshot } = buildSnapshot(makeMap({ style: "auto" }), [], [], GENERATED_AT);

    expect(snapshot.styleUrl).toContain(AUTO_STYLE);
    expect(snapshot.autoDark).toBe(true);
    expect(snapshot.theme).toBeUndefined();
  });

  it("defaults every embed control to on when settings were never written", () => {
    // What every map created before the settings form existed looks like:
    // `settings: "{}"` at creation and nothing after it.
    const { snapshot } = buildSnapshot(makeMap({ settings: {} }), [], [], GENERATED_AT);

    expect(snapshot.settings).toEqual({
      clustering: true,
      search: true,
      filters: true,
      nearest: true,
    });
  });

  it("carries stored embed controls through to the snapshot", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ settings: { clustering: false, nearest: false } }),
      [],
      [],
      GENERATED_AT,
    );

    expect(snapshot.settings.clustering).toBe(false);
    expect(snapshot.settings.nearest).toBe(false);
    // Absent keys still fall back rather than becoming undefined.
    expect(snapshot.settings.search).toBe(true);
    expect(snapshot.settings.filters).toBe(true);
  });

  it("ignores a settings value of the wrong type rather than publishing it", () => {
    const { snapshot } = buildSnapshot(
      // The column is free-form JSON, so it may have been hand-edited in the
      // Appwrite console or written by an older build.
      makeMap({ settings: { clustering: "yes", search: null } }),
      [],
      [],
      GENERATED_AT,
    );

    expect(snapshot.settings.clustering).toBe(true);
    expect(snapshot.settings.search).toBe(true);
  });

  it("omits empty optional fields instead of writing nulls", () => {
    const { snapshot } = buildSnapshot(makeMap(), [makePlace()], [], GENERATED_AT);
    const [place] = snapshot.places;

    expect(place).not.toHaveProperty("description");
    expect(place).not.toHaveProperty("phone");
    expect(place).not.toHaveProperty("photoUrl");
    expect(place).not.toHaveProperty("icon");
    expect(place.address).toBe("Gedimino pr. 1, Vilnius");
  });

  /*
   * The icon is the location's own, unlike the colour it takes from its
   * category, so it travels per place. The embed reads it to decide whether a
   * place is drawn as a shaped pin or a dot.
   */
  it("publishes the icon a location was dropped with", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ icon: "coffee" })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].icon).toBe("coffee");
  });

  /*
   * Custom pins travel whole — colour and logo included — because the embed has
   * to draw them on a stranger's site with no second request (§2). That makes
   * them the heaviest thing in the file per entry, which is why only the ones a
   * published place actually wears are sent.
   */
  describe("custom pins", () => {
    const glyphPin = {
      id: "ab12cd34",
      label: "Flagship",
      color: "#1c7ed6",
      glyph: "store",
      image: "",
    };
    const imagePin = {
      id: "ef56gh78",
      label: "Logo",
      color: "#0ca678",
      glyph: "",
      image: "data:image/png;base64,iVBORw0KGgo=",
    };

    it("publishes a pin a location wears, with its colour", () => {
      const { snapshot } = buildSnapshot(
        makeMap({ pinIcons: [glyphPin] }),
        [makePlace({ icon: "custom:ab12cd34" })],
        [],
        GENERATED_AT,
      );

      expect(snapshot.pinIcons).toEqual([
        { id: "ab12cd34", color: "#1c7ed6", glyph: "store" },
      ]);
      expect(snapshot.places[0].icon).toBe("custom:ab12cd34");
    });

    it("inlines an uploaded image", () => {
      const { snapshot } = buildSnapshot(
        makeMap({ pinIcons: [imagePin] }),
        [makePlace({ icon: "custom:ef56gh78" })],
        [],
        GENERATED_AT,
      );

      expect(snapshot.pinIcons?.[0].image).toBe(imagePin.image);
      expect(snapshot.pinIcons?.[0]).not.toHaveProperty("glyph");
      // The name is the owner's business. Nothing in the embed renders it.
      expect(snapshot.pinIcons?.[0]).not.toHaveProperty("label");
    });

    /*
     * The design fields follow the same rule as the empty `glyph` above: a pin
     * that took the default said nothing, so the snapshot says nothing and the
     * embed's `resolvePin` defaults to the same value. Most pins are the default
     * on most of these, and every dropped key is download a visitor doesn't pay
     * for on a customer's site.
     */
    it("drops a design the pin left at its default", () => {
      const { snapshot } = buildSnapshot(
        makeMap({
          pinIcons: [
            { ...glyphPin, ring: "", ringWidth: "regular", size: "md", shape: "circle" },
          ],
        }),
        [makePlace({ icon: "custom:ab12cd34" })],
        [],
        GENERATED_AT,
      );

      expect(snapshot.pinIcons).toEqual([
        { id: "ab12cd34", color: "#1c7ed6", glyph: "store" },
      ]);
    });

    it("publishes a design the pin actually chose", () => {
      const { snapshot } = buildSnapshot(
        makeMap({
          pinIcons: [
            {
              ...glyphPin,
              ring: "#111827",
              ringWidth: "thick",
              iconColor: "#ffffff",
              size: "lg",
              shape: "diamond",
            },
          ],
        }),
        [makePlace({ icon: "custom:ab12cd34" })],
        [],
        GENERATED_AT,
      );

      expect(snapshot.pinIcons).toEqual([
        {
          id: "ab12cd34",
          color: "#1c7ed6",
          glyph: "store",
          ring: "#111827",
          ringWidth: "thick",
          iconColor: "#ffffff",
          size: "lg",
          shape: "diamond",
        },
      ]);
    });

    it("leaves out a pin no location wears", () => {
      const { snapshot } = buildSnapshot(
        makeMap({ pinIcons: [glyphPin, imagePin] }),
        [makePlace({ icon: "custom:ab12cd34" })],
        [],
        GENERATED_AT,
      );

      expect(snapshot.pinIcons).toHaveLength(1);
    });

    it("omits the key entirely on a map with no custom pins", () => {
      const { snapshot } = buildSnapshot(makeMap(), [makePlace()], [], GENERATED_AT);

      expect(snapshot).not.toHaveProperty("pinIcons");
    });

    /*
     * The place keeps the id it was saved with; the embed resolves it to nothing
     * and draws a dot. Rewriting the place here would be the generator quietly
     * editing customer data on the way past.
     */
    it("keeps a place's icon id after the pin it named is gone", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [makePlace({ icon: "custom:deleted" })],
        [],
        GENERATED_AT,
      );

      expect(snapshot.places[0].icon).toBe("custom:deleted");
      expect(snapshot).not.toHaveProperty("pinIcons");
    });
  });

  it("keeps optional fields that have a value", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [
        makePlace({
          description: "Open late",
          phone: "+370 600 00000",
          url: "https://example.com",
          photoUrl: "https://cdn.example.com/photo.jpg",
        }),
      ],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0]).toMatchObject({
      description: "Open late",
      phone: "+370 600 00000",
      url: "https://example.com",
      photoUrl: "https://cdn.example.com/photo.jpg",
    });
  });

  it("publishes opening hours, and omits a week with nothing in it", () => {
    const week = emptyHours();
    week[0] = { open: "09:00", close: "17:00" };

    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ id: "open", hours: week }), makePlace({ id: "none" })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].hours).toEqual(week);

    // Not `hours: null`, and not seven nulls: absent. Across 3,000 places those
    // keys are a meaningful slice of what a visitor downloads.
    expect(snapshot.places[1]).not.toHaveProperty("hours");
  });

  it("omits an all-closed week, which means the same as no hours", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ hours: emptyHours() })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0]).not.toHaveProperty("hours");
  });

  it("drops places whose coordinates are unusable and reports them", () => {
    const good = makePlace({ id: "good" });
    const broken = makePlace({ id: "broken", lat: Number.NaN, lng: 25.28 });
    const outOfRange = makePlace({ id: "out-of-range", lat: 91, lng: 25.28 });

    const { snapshot, skipped } = buildSnapshot(
      makeMap(),
      [good, broken, outOfRange],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places.map((place) => place.id)).toEqual(["good"]);
    expect(skipped.map((place) => place.id)).toEqual(["broken", "out-of-range"]);
  });

  it("publishes a place a human placed by hand after the geocoder failed", () => {
    // Drag-to-fix rewrites the status to "manual", so filtering on status would
    // be wrong. Coordinate validity is the only test that matters here.
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ geocodeStatus: "manual", geocodeConfidence: null })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places).toHaveLength(1);
  });

  it("includes only categories that some published place uses", () => {
    const map = makeMap({
      categories: [category("shops", "Shops"), category("depots", "Depots")],
    });

    const { snapshot } = buildSnapshot(
      map,
      [makePlace({ category: "shops" })],
      [],
      GENERATED_AT,
    );

    // A filter chip that matches nothing is a dead control on a customer's site.
    expect(snapshot.categories.map((item) => item.id)).toEqual(["shops"]);
  });

  it("does not keep a category whose only place was dropped", () => {
    const map = makeMap({ categories: [category("shops", "Shops")] });

    const { snapshot } = buildSnapshot(
      map,
      [makePlace({ category: "shops", lat: Number.POSITIVE_INFINITY })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.categories).toEqual([]);
  });

  it("computes bounds across every published place", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [
        makePlace({ id: "a", lat: 54.0, lng: 25.0 }),
        makePlace({ id: "b", lat: 55.5, lng: 26.5 }),
        makePlace({ id: "c", lat: 54.5, lng: 24.5 }),
      ],
      [],
      GENERATED_AT,
    );

    expect(snapshot.bounds).toEqual({
      west: 24.5,
      south: 54,
      east: 26.5,
      north: 55.5,
    });
  });

  it("has no bounds when the map has no usable places", () => {
    const { snapshot } = buildSnapshot(makeMap(), [], [], GENERATED_AT);

    expect(snapshot.bounds).toBeNull();
    expect(snapshot.places).toEqual([]);
  });

  it("rounds coordinates to about a centimetre", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ lat: 54.68712345678, lng: 25.28087654321 })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].lat).toBe(54.687123);
    expect(snapshot.places[0].lng).toBe(25.280877);
  });

  it("defaults every embed control to on", () => {
    const { snapshot } = buildSnapshot(makeMap(), [], [], GENERATED_AT);

    expect(snapshot.settings).toEqual({
      clustering: true,
      search: true,
      filters: true,
      nearest: true,
    });
  });

  it("honours stored settings and ignores values of the wrong type", () => {
    const map = makeMap({
      settings: { clustering: false, search: "yes", nearest: null },
    });

    const { snapshot } = buildSnapshot(map, [], [], GENERATED_AT);

    expect(snapshot.settings.clustering).toBe(false);
    // A junk value must not switch a control off; it falls back to the default.
    expect(snapshot.settings.search).toBe(true);
    expect(snapshot.settings.nearest).toBe(true);
  });

  it("carries the domain allowlist through untouched", () => {
    const map = makeMap({ allowedDomains: ["example.com", "www.example.com"] });

    const { snapshot } = buildSnapshot(map, [], [], GENERATED_AT);

    expect(snapshot.allowedDomains).toEqual(["example.com", "www.example.com"]);
  });

  it("leaks no internal fields onto a published place", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ photoId: "file-1", photoUrl: "https://cdn/x.jpg" })],
      [],
      GENERATED_AT,
    );

    // photoId is a storage id; the embed gets the resolved URL and nothing that
    // would let it address the bucket.
    expect(snapshot.places[0]).not.toHaveProperty("photoId");
    expect(snapshot.places[0]).not.toHaveProperty("mapId");
    expect(snapshot.places[0]).not.toHaveProperty("geocodeStatus");
    expect(snapshot.places[0]).not.toHaveProperty("sortOrder");
  });

  describe("shapes", () => {
    it("omits the key entirely when there are none", () => {
      const { snapshot } = buildSnapshot(makeMap(), [makePlace()], [], GENERATED_AT);

      // Absent, not `[]`. Every snapshot published before shapes existed says
      // absent, and the embed has to read the two the same way.
      expect(snapshot).not.toHaveProperty("shapes");
    });

    it("publishes a circle as a centre and a radius, not as a ring", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [],
        [makeShape({ description: "Same-day delivery." })],
        GENERATED_AT,
      );

      expect(snapshot.shapes).toEqual([
        {
          id: "shape-1",
          name: "Delivery zone",
          color: "#1c7ed6",
          opacity: 0.2,
          description: "Same-day delivery.",
          kind: "circle",
          lat: 54.687,
          lng: 25.28,
          radius: 1200,
        },
      ]);
    });

    it("drops an empty description rather than serialising it", () => {
      const { snapshot } = buildSnapshot(makeMap(), [], [makeShape()], GENERATED_AT);

      expect(snapshot.shapes?.[0]).not.toHaveProperty("description");
      expect(snapshot.shapes?.[0]).not.toHaveProperty("mapId");
      expect(snapshot.shapes?.[0]).not.toHaveProperty("sortOrder");
    });

    it("rounds coordinates and radius", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [],
        [
          makeShape({
            geometry: {
              kind: "circle",
              lng: 25.2812345678,
              lat: 54.6871234567,
              radius: 1200.6,
            },
          }),
        ],
        GENERATED_AT,
      );

      const shape = snapshot.shapes?.[0];
      if (shape?.kind !== "circle") throw new Error("expected a circle");

      expect(shape.lng).toBe(25.281235);
      expect(shape.lat).toBe(54.687123);
      expect(shape.radius).toBe(1201);
    });

    it("publishes a polygon's ring", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [],
        [
          makeShape({
            geometry: {
              kind: "polygon",
              points: [
                [25.27, 54.68],
                [25.29, 54.68],
                [25.28, 54.7],
              ],
            },
          }),
        ],
        GENERATED_AT,
      );

      const shape = snapshot.shapes?.[0];
      if (shape?.kind !== "polygon") throw new Error("expected a polygon");

      expect(shape.points).toHaveLength(3);
    });

    it("leaves out a shape that would draw nothing", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [],
        [
          makeShape({ id: "a", geometry: { kind: "polygon", points: [[25.28, 54.687]] } }),
          makeShape({
            id: "b",
            geometry: { kind: "circle", lng: 25.28, lat: 54.687, radius: 0 },
          }),
        ],
        GENERATED_AT,
      );

      expect(snapshot).not.toHaveProperty("shapes");
    });

    it("frames a map whose only content is a shape", () => {
      // Without this the map has no bounds at all and opens on `center` at
      // whatever zoom was saved — often nowhere near the thing it is about.
      const { snapshot } = buildSnapshot(makeMap(), [], [makeShape()], GENERATED_AT);

      expect(snapshot.bounds).not.toBeNull();
      // The circle's diameter, not its centre: a 1.2km radius reaches about
      // 0.0108° north and south.
      expect(snapshot.bounds?.north).toBeGreaterThan(54.697);
      expect(snapshot.bounds?.south).toBeLessThan(54.677);
    });

    it("extends the bounds over both places and shapes", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [makePlace({ lat: 54.9, lng: 25.28 })],
        [makeShape()],
        GENERATED_AT,
      );

      // The place is the northern extreme, the circle the southern one.
      expect(snapshot.bounds?.north).toBe(54.9);
      expect(snapshot.bounds?.south).toBeLessThan(54.68);
    });
  });
});
