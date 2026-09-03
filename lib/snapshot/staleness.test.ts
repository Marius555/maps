import { describe, expect, it } from "vitest";

import type { AppMap, Place, Shape } from "@/lib/repositories/types";
import { hasUnpublishedChanges } from "./staleness";

const PUBLISHED_AT = "2026-08-08T10:00:00.000Z";
const at = (offsetMs: number) =>
  new Date(Date.parse(PUBLISHED_AT) + offsetMs).toISOString();

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
    publishedAt: PUBLISHED_AT,
    snapshotUrl: "https://cdn.example.com/live.json",
    createdAt: at(-100_000),
    updatedAt: at(500),
    ...overrides,
  };
}

function makePlace(updatedAt: string): Place {
  return {
    id: "place-1",
    mapId: "map-1",
    name: "Central store",
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
    sortOrder: 0,
    geocodeConfidence: null,
    addressParts: null,
    groupId: "",
    geocodeStatus: "ok",
    createdAt: at(-100_000),
    updatedAt,
  };
}

function makeShape(updatedAt: string): Shape {
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
    createdAt: at(-100_000),
    updatedAt,
  };
}

describe("hasUnpublishedChanges", () => {
  it("reports nothing pending for a map that was never published", () => {
    const map = makeMap({ publishedAt: null, updatedAt: at(5_000_000) });

    expect(hasUnpublishedChanges(map, [makePlace(at(5_000_000))], [])).toBe(false);
  });

  it("does not flag the publish's own write to the map row", () => {
    // The regression this guards: publishedAt is read before the upload and the
    // row is written after it, so updatedAt is always slightly later.
    const map = makeMap({ updatedAt: at(2_000) });

    expect(hasUnpublishedChanges(map, [], [])).toBe(false);
  });

  it("flags a map edited well after publishing", () => {
    const map = makeMap({ updatedAt: at(10 * 60_000) });

    expect(hasUnpublishedChanges(map, [], [])).toBe(true);
  });

  it("flags a location edited after publishing", () => {
    // The case the map row alone would miss: editing a place never touches it.
    const map = makeMap({ updatedAt: at(500) });

    expect(hasUnpublishedChanges(map, [makePlace(at(60_000))], [])).toBe(true);
  });

  it("flags a shape edited after publishing", () => {
    // Dragging a circle's radius handle is as much an unpublished change as
    // renaming a location, and touches the map row just as little.
    const map = makeMap({ updatedAt: at(500) });

    expect(hasUnpublishedChanges(map, [], [makeShape(at(60_000))])).toBe(true);
  });

  it("ignores shapes last touched before publishing", () => {
    const map = makeMap({ updatedAt: at(500) });

    expect(hasUnpublishedChanges(map, [], [makeShape(at(-60_000))])).toBe(false);
  });

  it("ignores locations last touched before publishing", () => {
    const map = makeMap({ updatedAt: at(500) });

    expect(hasUnpublishedChanges(map, [makePlace(at(-60_000))], [])).toBe(false);
  });

  it("treats an unreadable timestamp as no change rather than a stuck badge", () => {
    const map = makeMap({ updatedAt: "not a date" });

    expect(hasUnpublishedChanges(map, [makePlace("also not a date")], [])).toBe(false);
  });

  it("reports nothing pending when publishedAt itself is unreadable", () => {
    const map = makeMap({ publishedAt: "not a date" });

    expect(hasUnpublishedChanges(map, [makePlace(at(60_000))], [])).toBe(false);
  });
});
