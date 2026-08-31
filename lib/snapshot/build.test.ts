import { describe, expect, it } from "vitest";

import { AUTO_STYLE, BASEMAP_SOURCES, CONCRETE_MAP_STYLES } from "@/lib/map/style";
import type { AppMap, MapCategory, Place, Shape } from "@/lib/repositories/types";
import { defaultCardLayout, type CardLayout } from "@/packages/shared/card-layout";
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
    tagGroups: [],
    fields: [],
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
    tags: [],
    fields: {},
    icon: "",
    description: null,
    phone: null,
    email: null,
    url: null,
    hours: null,
    photoIds: [],
    photoUrls: [],
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
    strokeWidth: null,
    strokeStyle: "solid",
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

  /**
   * The card design follows that same rule, and has to: the embed falls back to
   * the card it has always built, so a map nobody has redesigned must publish
   * nothing at all here rather than publish the default spelled out.
   */
  it("omits the card layout when it is the untouched default", () => {
    const { snapshot } = buildSnapshot(makeMap(), [], [], GENERATED_AT);

    expect(snapshot.cardLayout).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain("cardLayout");
  });

  it("carries a card layout the owner actually changed", () => {
    const layout = defaultCardLayout();
    const { snapshot } = buildSnapshot(
      makeMap(),
      [],
      [],
      GENERATED_AT,
      undefined,
      { ...layout, zones: { ...layout.zones, bottom: [] } },
    );

    expect(snapshot.cardLayout?.zones.bottom).toEqual([]);
    expect(snapshot.cardLayout?.zones.top.map((block) => block.type)).toEqual([
      "gallery",
    ]);
  });

  /**
   * Resolved on the way out, so what a live site reads is already drawable —
   * see cardLayoutField. A gallery claiming four times the card's height is 70%
   * by the time it is written, not by the time it is rendered.
   */
  it("clamps a stored card layout before publishing it", () => {
    const layout = defaultCardLayout();
    const { snapshot } = buildSnapshot(
      makeMap(),
      [],
      [],
      GENERATED_AT,
      undefined,
      {
        ...layout,
        width: 5000,
        zones: { ...layout.zones, top: [{ id: "g", type: "gallery", heightPct: 400 }] },
      } as unknown as CardLayout,
    );

    expect(snapshot.cardLayout?.width).toBe(480);
    expect(snapshot.cardLayout?.zones.top[0].heightPct).toBe(70);
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
      list: true,
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
      list: true,
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

  it("publishes one photo as the cover alone", () => {
    // A place with a single picture says so once. `photoUrls` on top of it would
    // be the same string twice on every place of a 3,000-place map.
    const { snapshot } = buildSnapshot(
      makeMap(),
      [
        makePlace({
          photoIds: ["file-1"],
          photoUrls: ["https://cdn/a.jpg"],
          photoUrl: "https://cdn/a.jpg",
        }),
      ],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].photoUrl).toBe("https://cdn/a.jpg");
    expect(snapshot.places[0]).not.toHaveProperty("photoUrls");
  });

  it("publishes a gallery as the cover plus the whole set", () => {
    // The cover is repeated inside `photoUrls` deliberately: an embed published
    // before galleries existed reads `photoUrl` and must keep finding a picture.
    const { snapshot } = buildSnapshot(
      makeMap(),
      [
        makePlace({
          photoIds: ["file-1", "file-2"],
          photoUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"],
          photoUrl: "https://cdn/a.jpg",
        }),
      ],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].photoUrl).toBe("https://cdn/a.jpg");
    expect(snapshot.places[0].photoUrls).toEqual([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
    ]);
  });

  it("publishes no photo fields at all when there are none", () => {
    const { snapshot } = buildSnapshot(makeMap(), [makePlace()], [], GENERATED_AT);

    expect(snapshot.places[0]).not.toHaveProperty("photoUrl");
    expect(snapshot.places[0]).not.toHaveProperty("photoUrls");
  });

  it("leaks no internal fields onto a published place", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [
        makePlace({
          photoIds: ["file-1"],
          photoUrls: ["https://cdn/x.jpg"],
          photoUrl: "https://cdn/x.jpg",
        }),
      ],
      [],
      GENERATED_AT,
    );

    // photoIds are storage ids; the embed gets resolved URLs and nothing that
    // would let it address the bucket.
    expect(snapshot.places[0]).not.toHaveProperty("photoId");
    expect(snapshot.places[0]).not.toHaveProperty("photoIds");
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

    /*
     * The bytes are the point. A map whose owner never opened the stroke
     * controls has to publish the same file it published before those controls
     * existed — otherwise a republish is a change to a live customer's site, and
     * the embed falls back to a width and a marking of its own for every one of
     * the snapshots already out there.
     */
    it("says nothing about a stroke nobody chose", () => {
      const { snapshot } = buildSnapshot(makeMap(), [], [makeShape()], GENERATED_AT);

      expect(snapshot.shapes?.[0]).not.toHaveProperty("strokeWidth");
      expect(snapshot.shapes?.[0]).not.toHaveProperty("strokeStyle");
    });

    it("publishes a stroke somebody did choose", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [],
        [makeShape({ strokeWidth: 8, strokeStyle: "dotted" })],
        GENERATED_AT,
      );

      expect(snapshot.shapes?.[0]).toMatchObject({
        strokeWidth: 8,
        strokeStyle: "dotted",
      });
    });

    it("still omits a marking left on solid", () => {
      const { snapshot } = buildSnapshot(
        makeMap(),
        [],
        [makeShape({ strokeWidth: 8, strokeStyle: "solid" })],
        GENERATED_AT,
      );

      expect(snapshot.shapes?.[0]).toHaveProperty("strokeWidth", 8);
      expect(snapshot.shapes?.[0]).not.toHaveProperty("strokeStyle");
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

    /**
     * A line publishes its ends resolved and its bonds stripped.
     *
     * The bond names a database row the embed has no access to, so shipping it
     * would be bytes on every visitor's download describing a relationship
     * nothing on that page could act on. And resolving has to happen *here*:
     * publishing the stored coordinates would ship wherever the line was drawn
     * rather than where its locations ended up.
     */
    describe("lines", () => {
      const line = (overrides: Partial<Shape> = {}) =>
        makeShape({
          id: "line-1",
          name: "Supply route",
          geometry: {
            kind: "line",
            points: [
              [0, 0],
              [25.3, 54.7],
            ],
            from: "place-1",
          },
          ...overrides,
        });

      it("publishes a line as a line", () => {
        const { snapshot } = buildSnapshot(
          makeMap(),
          [makePlace()],
          [line()],
          GENERATED_AT,
        );

        expect(snapshot.shapes?.[0].kind).toBe("line");
      });

      it("resolves a bonded end to its location", () => {
        const { snapshot } = buildSnapshot(
          makeMap(),
          [makePlace({ id: "place-1", lng: 25.28, lat: 54.687 })],
          [line()],
          GENERATED_AT,
        );

        const shape = snapshot.shapes?.[0];
        if (shape?.kind !== "line") throw new Error("expected a line");

        expect(shape.points[0]).toEqual([25.28, 54.687]);
      });

      it("never ships the bond itself", () => {
        const { snapshot } = buildSnapshot(
          makeMap(),
          [makePlace()],
          [line()],
          GENERATED_AT,
        );

        expect(snapshot.shapes?.[0]).not.toHaveProperty("from");
        expect(snapshot.shapes?.[0]).not.toHaveProperty("to");
      });

      it("keeps the stored point when the bonded location is gone", () => {
        const { snapshot } = buildSnapshot(
          makeMap(),
          [],
          [line({ geometry: { kind: "line", points: [[10, 20], [25.3, 54.7]], from: "deleted" } })],
          GENERATED_AT,
        );

        const shape = snapshot.shapes?.[0];
        if (shape?.kind !== "line") throw new Error("expected a line");

        expect(shape.points[0]).toEqual([10, 20]);
      });

      it("publishes a two-point line, which an area could not be", () => {
        const { snapshot } = buildSnapshot(makeMap(), [], [line()], GENERATED_AT);

        expect(snapshot.shapes).toHaveLength(1);
      });

      /**
       * A route is a line whose points came from a routing engine, and the whole
       * difference it makes to a snapshot is one optional number.
       *
       * Distance is deliberately not among them: the popup sums it from these
       * very points, and a figure shipped beside the geometry it describes is one
       * republish away from disagreeing with it. Travel time cannot be
       * recomputed from coordinates at any price, so it is the one thing that
       * travels.
       */
      describe("routes", () => {
        const routed = (durationS = 5400) =>
          line({
            geometry: {
              kind: "line",
              points: [
                [25.28, 54.687],
                [25.29, 54.693],
                [25.3, 54.7],
              ],
              from: "place-1",
              route: {
                profile: "car",
                stops: [
                  { at: [25.28, 54.687], placeId: "place-1" },
                  { at: [25.3, 54.7] },
                ],
                durationS,
              },
            },
          });

        it("publishes the travel time", () => {
          const { snapshot } = buildSnapshot(
            makeMap(),
            [makePlace({ id: "place-1", lng: 25.28, lat: 54.687 })],
            [routed()],
            GENERATED_AT,
          );

          const shape = snapshot.shapes?.[0];
          if (shape?.kind !== "line") throw new Error("expected a line");

          expect(shape.durationS).toBe(5400);
        });

        it("rounds it to whole seconds", () => {
          const { snapshot } = buildSnapshot(
            makeMap(),
            [],
            [routed(5400.7)],
            GENERATED_AT,
          );

          const shape = snapshot.shapes?.[0];
          if (shape?.kind !== "line") throw new Error("expected a line");

          expect(shape.durationS).toBe(5401);
        });

        it("never ships the stops", () => {
          // They name rows in a database the embed has no access to, and the
          // points are already resolved — so a stop that reached a snapshot
          // would be bytes describing a relationship nothing could act on.
          const { snapshot } = buildSnapshot(
            makeMap(),
            [],
            [routed()],
            GENERATED_AT,
          );

          expect(snapshot.shapes?.[0]).not.toHaveProperty("route");
          expect(snapshot.shapes?.[0]).not.toHaveProperty("stops");
          expect(snapshot.shapes?.[0]).not.toHaveProperty("profile");
        });

        it("does not rubber-band a route onto a moved pin", () => {
          /*
           * The trap this whole design turns on. A hand-drawn line follows its
           * bonded pin, which is the test above. A route must not: its points
           * follow roads, and dragging point 0 onto a pin two streets away draws
           * a straight kink from the pin to where the road geometry starts —
           * baked into a file live customer sites read forever.
           */
          const { snapshot } = buildSnapshot(
            makeMap(),
            [makePlace({ id: "place-1", lng: 11, lat: 61 })],
            [routed()],
            GENERATED_AT,
          );

          const shape = snapshot.shapes?.[0];
          if (shape?.kind !== "line") throw new Error("expected a line");

          expect(shape.points[0]).toEqual([25.28, 54.687]);
        });

        it("omits the duration for a hand-drawn line", () => {
          // The immutability rule: a line published before routes existed must
          // keep publishing exactly the bytes it always did.
          const { snapshot } = buildSnapshot(
            makeMap(),
            [makePlace()],
            [line()],
            GENERATED_AT,
          );

          expect(snapshot.shapes?.[0]).not.toHaveProperty("durationS");
        });
      });

      it("leaves out a line with only one point", () => {
        const { snapshot } = buildSnapshot(
          makeMap(),
          [],
          [line({ geometry: { kind: "line", points: [[25.28, 54.687]] } })],
          GENERATED_AT,
        );

        expect(snapshot).not.toHaveProperty("shapes");
      });

      it("frames the map around a line's resolved extent", () => {
        const { snapshot } = buildSnapshot(
          makeMap(),
          [makePlace({ id: "place-1", lng: 25.0, lat: 54.0 })],
          [line()],
          GENERATED_AT,
        );

        // The bond moved the western end, so the bounds must follow it rather
        // than the coordinates stored on the row.
        expect(snapshot.bounds?.west).toBe(25.0);
      });
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

describe("buildSnapshot tags and custom fields", () => {
  const groups = [
    {
      id: "sells",
      label: "Sells",
      tags: [
        { id: "bikes", label: "Bikes" },
        { id: "skis", label: "Skis" },
      ],
    },
    { id: "open", label: "Open", tags: [{ id: "sundays", label: "Sundays" }] },
  ];

  const fields = [
    { id: "booking", label: "Book", type: "url" as const, showAs: "button" as const },
    { id: "code", label: "Dealer code", type: "text" as const, showAs: "row" as const },
  ];

  it("omits both entirely when the map defines neither", () => {
    // The bytes every visitor downloads. Absent is also what every snapshot
    // published before these existed says, so absent has to keep meaning "none".
    const { snapshot } = buildSnapshot(makeMap(), [makePlace()], [], GENERATED_AT);

    expect(snapshot.tagGroups).toBeUndefined();
    expect(snapshot.fields).toBeUndefined();
    expect(snapshot.places[0].tags).toBeUndefined();
    expect(snapshot.places[0].fields).toBeUndefined();
  });

  it("ships only the tags a published place actually wears", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ tagGroups: groups }),
      [makePlace({ tags: ["bikes"] })],
      [],
      GENERATED_AT,
    );

    // "Skis" is defined but unworn, so its chip would match nothing; "Open" is
    // left empty by that narrowing and goes whole.
    expect(snapshot.tagGroups).toEqual([
      { id: "sells", label: "Sells", tags: [{ id: "bikes", label: "Bikes" }] },
    ]);
  });

  it("drops a tag id the map no longer defines", () => {
    // Deleting a tag does not sweep it off the places wearing it, so this is the
    // normal state of a map whose owner has changed their mind once.
    const { snapshot } = buildSnapshot(
      makeMap({ tagGroups: groups }),
      [makePlace({ tags: ["bikes", "deleted"] })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].tags).toEqual(["bikes"]);
  });

  it("omits a place's tags when none of them survive", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ tagGroups: groups }),
      [makePlace({ tags: ["deleted"] })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.tagGroups).toBeUndefined();
    expect(snapshot.places[0].tags).toBeUndefined();
  });

  it("counts tags worn by skipped places as unworn", () => {
    // An unplaceable row is not published, so a chip that only it wears would be
    // a dead control on the customer's site.
    const { snapshot } = buildSnapshot(
      makeMap({ tagGroups: groups }),
      [makePlace({ tags: ["bikes"] }), makePlace({ id: "p2", lat: 999, tags: ["skis"] })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.tagGroups?.[0].tags).toEqual([{ id: "bikes", label: "Bikes" }]);
  });

  it("ships only the custom fields somebody filled in", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ fields }),
      [makePlace({ fields: { booking: "https://example.com/book" } })],
      [],
      GENERATED_AT,
    );

    // A label with nothing under it on every card is a promise the map doesn't keep.
    expect(snapshot.fields).toEqual([fields[0]]);
    expect(snapshot.places[0].fields).toEqual({ booking: "https://example.com/book" });
  });

  it("treats an empty value as unanswered", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ fields }),
      [makePlace({ fields: { booking: "" } })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.fields).toBeUndefined();
    expect(snapshot.places[0].fields).toBeUndefined();
  });

  it("drops a value keyed by a field the map no longer defines", () => {
    const { snapshot } = buildSnapshot(
      makeMap({ fields: [fields[1]] }),
      [makePlace({ fields: { booking: "https://example.com/book", code: "GB-14" } })],
      [],
      GENERATED_AT,
    );

    expect(snapshot.places[0].fields).toEqual({ code: "GB-14" });
  });
});

describe("buildSnapshot gazetteer", () => {
  const inGb = (id: string) =>
    makePlace({ id, addressParts: { countryCode: "GB" } });

  it("is omitted when no base is given", () => {
    // Every existing caller passes four arguments, and a snapshot with a
    // `gazetteer` block pointing nowhere is a URL the embed 404s on per
    // keystroke.
    const { snapshot } = buildSnapshot(makeMap(), [inGb("p1")], [], GENERATED_AT);

    expect(snapshot.gazetteer).toBeUndefined();
  });

  it("names only the countries the published locations are in", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [inGb("p1"), makePlace({ id: "p2", addressParts: { countryCode: "DE" } })],
      [],
      GENERATED_AT,
      "https://cdn.example.com/gazetteer",
    );

    expect(snapshot.gazetteer).toEqual({
      base: "https://cdn.example.com/gazetteer",
      countries: ["DE", "GB"],
    });
  });

  it("ignores the countries of locations that were not published", () => {
    // An unplaceable row is not on the map, so its country is not one a visitor
    // can search into.
    const { snapshot } = buildSnapshot(
      makeMap(),
      [inGb("p1"), makePlace({ id: "p2", lat: 999, addressParts: { countryCode: "DE" } })],
      [],
      GENERATED_AT,
      "https://cdn.example.com/gazetteer",
    );

    expect(snapshot.gazetteer?.countries).toEqual(["GB"]);
  });

  it("is omitted for a map whose pins were all dropped by hand", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace()],
      [],
      GENERATED_AT,
      "https://cdn.example.com/gazetteer",
    );

    expect(snapshot.gazetteer).toBeUndefined();
  });

  it("strips a trailing slash so the embed can join paths naively", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [inGb("p1")],
      [],
      GENERATED_AT,
      "https://cdn.example.com/gazetteer/",
    );

    expect(snapshot.gazetteer?.base).toBe("https://cdn.example.com/gazetteer");
  });
});
