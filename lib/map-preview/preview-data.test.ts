import { describe, expect, it } from "vitest";

import { DEFAULT_CENTER } from "@/lib/config";
import type { AppMap, Group, MapTagGroup, Place, Shape } from "@/lib/repositories/types";
import { UNTAGGED_PIN_COLOR } from "@/packages/shared/pin-icons";
import {
  buildPreviewData,
  PREVIEW_MAX_ZOOM,
  PREVIEW_PADDING,
  previewCamera,
} from "./preview-data";

const AT = "2026-09-01T00:00:00.000Z";

const TAGS: MapTagGroup[] = [
  { id: "tg1", label: "Kind", tags: [{ id: "t1", label: "Shop", color: "#e03131" }] },
];

function makeMap(overrides: Partial<AppMap> = {}): AppMap {
  return {
    id: "map-1",
    userId: "user-1",
    name: "Stockists",
    slug: "stockists",
    style: "liberty",
    defaultLat: DEFAULT_CENTER.lat,
    defaultLng: DEFAULT_CENTER.lng,
    defaultZoom: DEFAULT_CENTER.zoom,
    categories: [],
    tagGroups: TAGS,
    fields: [],
    pinIcons: [],
    settings: {},
    appearance: {},
    allowedDomains: [],
    publishedAt: null,
    snapshotUrl: null,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

function makePlace(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    mapId: "map-1",
    name: id,
    lat: 54.687,
    lng: 25.28,
    address: "",
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
    logoId: null,
    logoUrl: null,
    sortOrder: 0,
    geocodeConfidence: null,
    geocodeStatus: "manual",
    addressParts: null,
    groupId: "",
    cardBlocks: {},
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

function makeLine(id: string, overrides: Partial<Shape> = {}): Shape {
  return {
    id,
    mapId: "map-1",
    name: id,
    description: null,
    color: "#1c7ed6",
    opacity: 0.2,
    strokeWidth: null,
    strokeStyle: "solid",
    geometry: {
      kind: "line",
      points: [
        [25.0, 54.0],
        [26.0, 55.0],
      ],
    },
    sortOrder: 0,
    groupId: "",
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

function makeGroup(id: string, color: string): Group {
  return { id, mapId: "map-1", name: id, color, sortOrder: 0, createdAt: AT, updatedAt: AT };
}

describe("buildPreviewData", () => {
  describe("pin colours", () => {
    it("paints a pin its first tag's colour", () => {
      const data = buildPreviewData({
        map: makeMap(),
        places: [makePlace("p1", { tags: ["t1"] })],
        shapes: [],
        groups: [],
      });

      expect(data.places[0].color).toBe("#e03131");
    });

    it("lets a group's colour beat the tag's, as the editor does", () => {
      const data = buildPreviewData({
        map: makeMap(),
        places: [makePlace("p1", { tags: ["t1"], groupId: "g1" })],
        shapes: [],
        groups: [makeGroup("g1", "#2f9e44")],
      });

      expect(data.places[0].color).toBe("#2f9e44");
    });

    it("falls back to the untagged grey rather than to a theme colour", () => {
      const data = buildPreviewData({
        map: makeMap(),
        places: [makePlace("p1")],
        shapes: [],
        groups: [],
      });

      expect(data.places[0].color).toBe(UNTAGGED_PIN_COLOR);
    });
  });

  it("drops locations with no usable coordinates", () => {
    const data = buildPreviewData({
      map: makeMap(),
      places: [makePlace("p1"), makePlace("p2", { lat: Number.NaN })],
      shapes: [],
      groups: [],
    });

    expect(data.places).toHaveLength(1);
  });

  it("paints a grouped shape in its group's colour", () => {
    const data = buildPreviewData({
      map: makeMap(),
      places: [],
      shapes: [makeLine("s1", { groupId: "g1" })],
      groups: [makeGroup("g1", "#f08c00")],
    });

    expect(data.shapes[0].color).toBe("#f08c00");
  });

  it("moves a bonded line's end to where its location is now", () => {
    const line = makeLine("s1", {
      geometry: {
        kind: "line",
        points: [
          [0, 0],
          [26.0, 55.0],
        ],
        from: "p1",
      },
    });

    const data = buildPreviewData({
      map: makeMap(),
      places: [makePlace("p1", { lng: 25.28, lat: 54.687 })],
      shapes: [line],
      groups: [],
    });

    const geometry = data.shapes[0].geometry;
    expect(geometry.kind === "line" && geometry.points[0]).toEqual([25.28, 54.687]);
  });

  it("frames the locations and shapes together on a map with no saved view", () => {
    const data = buildPreviewData({
      map: makeMap(),
      places: [makePlace("p1", { lng: 25.5, lat: 54.5 })],
      shapes: [makeLine("s1")],
      groups: [],
    });

    expect(data.camera).toEqual({
      bounds: { west: 25.0, south: 54.0, east: 26.0, north: 55.0 },
      padding: PREVIEW_PADDING,
      maxZoom: PREVIEW_MAX_ZOOM,
    });
  });
});

describe("previewCamera", () => {
  const bounds = { west: 25, south: 54, east: 26, north: 55 };

  it("keeps a view the owner saved, one zoom step out", () => {
    const camera = previewCamera(
      { defaultLat: 51.5, defaultLng: -0.12, defaultZoom: 12 },
      bounds,
    );

    expect(camera).toEqual({ center: { lng: -0.12, lat: 51.5 }, zoom: 11 });
  });

  it("falls back to the stored default when there is nothing to frame", () => {
    const camera = previewCamera(
      {
        defaultLat: DEFAULT_CENTER.lat,
        defaultLng: DEFAULT_CENTER.lng,
        defaultZoom: DEFAULT_CENTER.zoom,
      },
      null,
    );

    expect(camera).toEqual({
      center: { lng: DEFAULT_CENTER.lng, lat: DEFAULT_CENTER.lat },
      zoom: 0,
    });
  });
});
