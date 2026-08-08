import { describe, expect, it } from "vitest";

import type { AppMap, MapCategory, Place } from "@/lib/repositories/types";
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
    settings: {},
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
    description: null,
    phone: null,
    email: null,
    url: null,
    photoId: null,
    photoUrl: null,
    sortOrder: 0,
    geocodeConfidence: null,
    geocodeStatus: "ok",
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
    const { snapshot } = buildSnapshot(makeMap(), [makePlace()], GENERATED_AT);

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
    const { snapshot } = buildSnapshot(makeMap({ style: "positron" }), [], GENERATED_AT);

    expect(snapshot.styleUrl).toMatch(/^https:\/\//);
    expect(snapshot.styleUrl).toContain("positron");
  });

  it("omits empty optional fields instead of writing nulls", () => {
    const { snapshot } = buildSnapshot(makeMap(), [makePlace()], GENERATED_AT);
    const [place] = snapshot.places;

    expect(place).not.toHaveProperty("description");
    expect(place).not.toHaveProperty("phone");
    expect(place).not.toHaveProperty("photoUrl");
    expect(place.address).toBe("Gedimino pr. 1, Vilnius");
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
      GENERATED_AT,
    );

    expect(snapshot.places[0]).toMatchObject({
      description: "Open late",
      phone: "+370 600 00000",
      url: "https://example.com",
      photoUrl: "https://cdn.example.com/photo.jpg",
    });
  });

  it("drops places whose coordinates are unusable and reports them", () => {
    const good = makePlace({ id: "good" });
    const broken = makePlace({ id: "broken", lat: Number.NaN, lng: 25.28 });
    const outOfRange = makePlace({ id: "out-of-range", lat: 91, lng: 25.28 });

    const { snapshot, skipped } = buildSnapshot(
      makeMap(),
      [good, broken, outOfRange],
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
    const { snapshot } = buildSnapshot(makeMap(), [], GENERATED_AT);

    expect(snapshot.bounds).toBeNull();
    expect(snapshot.places).toEqual([]);
  });

  it("rounds coordinates to about a centimetre", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ lat: 54.68712345678, lng: 25.28087654321 })],
      GENERATED_AT,
    );

    expect(snapshot.places[0].lat).toBe(54.687123);
    expect(snapshot.places[0].lng).toBe(25.280877);
  });

  it("defaults every embed control to on", () => {
    const { snapshot } = buildSnapshot(makeMap(), [], GENERATED_AT);

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

    const { snapshot } = buildSnapshot(map, [], GENERATED_AT);

    expect(snapshot.settings.clustering).toBe(false);
    // A junk value must not switch a control off; it falls back to the default.
    expect(snapshot.settings.search).toBe(true);
    expect(snapshot.settings.nearest).toBe(true);
  });

  it("carries the domain allowlist through untouched", () => {
    const map = makeMap({ allowedDomains: ["example.com", "www.example.com"] });

    const { snapshot } = buildSnapshot(map, [], GENERATED_AT);

    expect(snapshot.allowedDomains).toEqual(["example.com", "www.example.com"]);
  });

  it("leaks no internal fields onto a published place", () => {
    const { snapshot } = buildSnapshot(
      makeMap(),
      [makePlace({ photoId: "file-1", photoUrl: "https://cdn/x.jpg" })],
      GENERATED_AT,
    );

    // photoId is a storage id; the embed gets the resolved URL and nothing that
    // would let it address the bucket.
    expect(snapshot.places[0]).not.toHaveProperty("photoId");
    expect(snapshot.places[0]).not.toHaveProperty("mapId");
    expect(snapshot.places[0]).not.toHaveProperty("geocodeStatus");
    expect(snapshot.places[0]).not.toHaveProperty("sortOrder");
  });
});
