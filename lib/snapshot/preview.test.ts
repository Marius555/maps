import { describe, expect, it } from "vitest";

import type { AppMap, Place } from "@/lib/repositories/types";
import { buildPreviewSnapshot } from "./preview";

const UPDATED_AT = "2026-08-08T10:00:00.000Z";

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
    allowedDomains: [],
    publishedAt: null,
    snapshotUrl: null,
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
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
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  };
}

describe("buildPreviewSnapshot", () => {
  /**
   * The allowlist exists to stop the snippet working on sites that aren't the
   * customer's, and the dashboard is one of those sites. Carried through, a
   * customer who had locked their map to their own domain would find the preview
   * refusing to render on the very page offering it.
   */
  it("clears the domain allowlist so the preview renders in the dashboard", () => {
    const snapshot = buildPreviewSnapshot(
      makeMap({ allowedDomains: ["example.com"] }),
      [makePlace()],
      [],
    );

    expect(snapshot.allowedDomains).toEqual([]);
  });

  /**
   * The caller compares serialised snapshots to decide whether to rebuild the
   * iframe. A clock read would make two identical previews compare unequal and
   * tear the map down on every background refetch.
   */
  it("is stable across calls for unchanged input", () => {
    const map = makeMap();

    // Fresh arrays each time, the way react-query hands one back after a
    // refetch that changed nothing.
    const first = JSON.stringify(buildPreviewSnapshot(map, [makePlace()], []));
    const second = JSON.stringify(buildPreviewSnapshot(map, [makePlace()], []));

    expect(second).toBe(first);
  });

  it("otherwise matches what publishing would write", () => {
    const snapshot = buildPreviewSnapshot(
      makeMap({ style: "dark" }),
      [makePlace({ name: "Harbour kiosk" })],
      [],
    );

    expect(snapshot.version).toBe(1);
    expect(snapshot.theme).toBe("dark");
    expect(snapshot.styleUrl).toContain("dark");
    expect(snapshot.places).toHaveLength(1);
    expect(snapshot.places[0].name).toBe("Harbour kiosk");
    expect(snapshot.settings.clustering).toBe(true);
  });

  it("drops places with unusable coordinates, exactly as publishing does", () => {
    const snapshot = buildPreviewSnapshot(
      makeMap(),
      [makePlace(), makePlace({ id: "place-2", lat: Number.NaN, lng: Number.NaN })],
      [],
    );

    expect(snapshot.places).toHaveLength(1);
    expect(snapshot.places[0].id).toBe("place-1");
  });
});
