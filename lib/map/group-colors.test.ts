import { describe, expect, it } from "vitest";

import type { Group, MapTagGroup, Place, Shape } from "@/lib/repositories/types";
import type { RouteStop } from "@/packages/shared/shapes";
import { groupColorIndex } from "./group-colors";

function group(id: string, color: string): Group {
  return {
    id,
    mapId: "map-1",
    name: id,
    color,
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function place(id: string, { groupId = "", tags = [] as string[] } = {}): Place {
  return {
    id,
    mapId: "map-1",
    name: id,
    lat: 54.687,
    lng: 25.28,
    address: "",
    tags,
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
    groupId,
    cardBlocks: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function circle(id: string, groupId = "", color = "#1c7ed6"): Shape {
  return {
    id,
    mapId: "map-1",
    name: id,
    description: null,
    color,
    opacity: 0.2,
    strokeWidth: null,
    strokeStyle: "solid",
    geometry: { kind: "circle", lng: 25.28, lat: 54.687, radius: 500 },
    sortOrder: 0,
    groupId,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function route(id: string, placeIds: (string | undefined)[], groupId = ""): Shape {
  const stops: RouteStop[] = placeIds.map((placeId) => ({
    at: [25.28, 54.687],
    ...(placeId ? { placeId } : {}),
  }));

  return {
    ...circle(id, groupId),
    geometry: {
      kind: "line",
      points: [
        [25.28, 54.687],
        [25.29, 54.688],
      ],
      route: { profile: "car", stops, durationS: 600 },
    },
  };
}

const TAGS: MapTagGroup[] = [
  { id: "tg1", label: "Kind", tags: [{ id: "t1", label: "Shop", color: "#e03131" }] },
];

describe("groupColorIndex", () => {
  describe("shapes", () => {
    it("paints a grouped shape in its group's colour", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44")],
        shapes: [circle("s1", "g1")],
      });

      expect(index.forShape(circle("s1", "g1"))).toBe("#2f9e44");
    });

    it("gives a loose shape its own colour straight back", () => {
      const index = groupColorIndex({ groups: [group("g1", "#2f9e44")], shapes: [] });

      expect(index.forShape(circle("s1"))).toBe("#1c7ed6");
    });

    /*
     * The dangling-id contract: deleting a group deletes one row and leaves its
     * members naming it. Every other reader treats that as ungrouped, and a
     * colour that outlived its group would be the one place it did not.
     */
    it("reads a groupId naming no group as ungrouped", () => {
      const index = groupColorIndex({ groups: [], shapes: [] });

      expect(index.forShape(circle("s1", "gone"))).toBe("#1c7ed6");
    });
  });

  describe("places", () => {
    it("prefers the group over the pin and the tags", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44")],
        shapes: [],
        tagGroups: TAGS,
      });

      expect(index.forPlace(place("p1", { groupId: "g1", tags: ["t1"] }), "#f08c00")).toBe(
        "#2f9e44",
      );
    });

    it("falls to the pin's own colour, then the first tag", () => {
      const index = groupColorIndex({ groups: [], shapes: [], tagGroups: TAGS });

      expect(index.forPlace(place("p1", { tags: ["t1"] }), "#f08c00")).toBe("#f08c00");
      expect(index.forPlace(place("p1", { tags: ["t1"] }))).toBe("#e03131");
      expect(index.forPlace(place("p1"))).toBeUndefined();
    });
  });

  describe("a route lends its group's colour to its stops", () => {
    it("paints every bonded stop of a grouped route", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44")],
        shapes: [route("r1", ["p1", "p2"], "g1")],
      });

      expect(index.overrideForPlace(place("p1"))).toBe("#2f9e44");
      expect(index.overrideForPlace(place("p2"))).toBe("#2f9e44");
      expect(index.overrideForPlace(place("p3"))).toBeUndefined();
    });

    it("lends nothing when the route itself is in no group", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44")],
        shapes: [route("r1", ["p1", "p2"])],
      });

      expect(index.overrideForPlace(place("p1"))).toBeUndefined();
    });

    // A free waypoint is not a location. Legacy routes are full of them and they
    // have no id at all, so there is nothing to paint.
    it("ignores a free waypoint", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44")],
        shapes: [route("r1", [undefined, "p1"], "g1")],
      });

      expect(index.overrideForPlace(place("p1"))).toBe("#2f9e44");
    });

    // The explicit act wins. Taking the pin out of g2 then gives it the route's
    // tint rather than dropping it all the way back to a tag colour.
    it("lets the location's own group beat the route's", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44"), group("g2", "#e8590c")],
        shapes: [route("r1", ["p1"], "g1")],
      });

      expect(index.overrideForPlace(place("p1", { groupId: "g2" }))).toBe("#e8590c");
      expect(index.overrideForPlace(place("p1"))).toBe("#2f9e44");
    });

    // Arbitrary but deterministic: the alternative is a pin whose colour depends
    // on which query resolved first.
    it("takes the first route's colour when two claim the same stop", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44"), group("g2", "#e8590c")],
        shapes: [route("r1", ["p1"], "g1"), route("r2", ["p1"], "g2")],
      });

      expect(index.overrideForPlace(place("p1"))).toBe("#2f9e44");
    });

    it("does not read a route off a circle", () => {
      const index = groupColorIndex({
        groups: [group("g1", "#2f9e44")],
        shapes: [circle("s1", "g1")],
      });

      expect(index.overrideForPlace(place("p1"))).toBeUndefined();
    });
  });
});
