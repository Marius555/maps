import { describe, expect, it } from "vitest";

import type { Group, Place, Shape } from "@/lib/repositories/types";
import { sidebarRows } from "./sidebar-rows";

const NO_COLLAPSE: ReadonlySet<string> = new Set();
/** No route opened. A route's stops are hidden until its row is pressed. */
const NO_ROUTES: ReadonlySet<string> = new Set();

function group(id: string, color = "#495057"): Group {
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

/** Only `id` and `groupId` are read; the rest is filler. */
function place(id: string, groupId = ""): Place {
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
    groupId,
    cardBlocks: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}

function shape(id: string, groupId = ""): Shape {
  return {
    id,
    mapId: "map-1",
    name: id,
    description: null,
    color: "#1c7ed6",
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

/** What the panel actually renders, top to bottom. */
function keys(rows: ReturnType<typeof sidebarRows>): string[] {
  return rows.map((row) => (row.kind === "heading" ? "heading" : row.key));
}

describe("sidebarRows", () => {
  it("puts each group above its own members, then everything loose", () => {
    const rows = sidebarRows({
      groups: [group("g1"), group("g2")],
      places: [place("p1", "g1"), place("p2"), place("p3", "g2")],
      shapes: [shape("s1", "g1"), shape("s2")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual([
      "heading",
      "group:g1",
      "place:p1",
      "shape:s1",
      "group:g2",
      "place:p3",
      "place:p2",
      "shape:s2",
    ]);
  });

  it("carries a group's members on its header row", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2", "g1")],
      shapes: [shape("s1", "g1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const header = rows.find((row) => row.kind === "group");

    expect(header?.kind === "group" && header.places.map((p) => p.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(header?.kind === "group" && header.shapes.map((s) => s.id)).toEqual([
      "s1",
    ]);
  });

  it("hands a member its group's colour and indents it", () => {
    const rows = sidebarRows({
      groups: [group("g1", "#e03131")],
      places: [place("p1", "g1"), place("p2")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const member = rows.find((row) => row.kind === "place" && row.key === "place:p1");
    const loose = rows.find((row) => row.kind === "place" && row.key === "place:p2");

    expect(member?.kind === "place" && member.groupColor).toBe("#e03131");
    expect(member?.kind === "place" && member.indent).toBe(true);
    expect(member?.kind === "place" && member.groupId).toBe("g1");
    expect(loose?.kind === "place" && loose.groupColor).toBeUndefined();
    expect(loose?.kind === "place" && loose.indent).toBe(false);
    expect(loose?.kind === "place" && loose.groupId).toBe("");
  });

  it("leaves a collapsed group's members out entirely", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2")],
      shapes: [shape("s1", "g1")],
      collapsed: new Set(["g1"]),
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual(["heading", "group:g1", "place:p2"]);
  });

  it("still reports the members of a collapsed group", () => {
    // The header goes on saying "2" with nothing under it — a fold is about
    // what is drawn, not about what is in the group.
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1")],
      shapes: [shape("s1", "g1")],
      collapsed: new Set(["g1"]),
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const header = rows.find((row) => row.kind === "group");

    expect(
      header?.kind === "group" && header.places.length + header.shapes.length,
    ).toBe(2);
  });

  it("reads a groupId with no group as ungrouped", () => {
    // What a deleted group leaves behind. Its members have to fall back into the
    // loose run on this very render — nothing rewrites their groupId.
    const rows = sidebarRows({
      groups: [],
      places: [place("p1", "gone")],
      shapes: [shape("s1", "gone")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual(["place:p1", "shape:s1"]);
    // And a drop on one of them means "make a new group", not "join gone".
    expect(rows.every((row) => row.kind === "heading" || row.kind === "group" || row.kind === "route-stop" || row.groupId === "")).toBe(
      true,
    );
  });

  it("drops the Groups heading when there are no groups to head", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    expect(rows.some((row) => row.kind === "heading")).toBe(false);
  });

  it("hides an empty group only while one is being filled", () => {
    const args = {
      groups: [group("g1"), group("g2")],
      places: [place("p1", "g1")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
    };

    expect(keys(sidebarRows({ ...args, hideEmptyGroups: true }))).toEqual([
      "heading",
      "group:g1",
      "place:p1",
    ]);
    expect(keys(sidebarRows({ ...args, hideEmptyGroups: false }))).toContain(
      "group:g2",
    );
  });

  it("marks only the first loose row as starting its section", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2"), place("p3")],
      shapes: [shape("s1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const starts = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.kind !== "route-stop" && row.startsLooseSection,
    );

    expect(starts.map((row) => row.key)).toEqual(["place:p2"]);
  });

  it("closes the tree on the last member of a group, shapes included", () => {
    // The rail runs to the bottom of every member but the last, where it stops
    // at the elbow. The members are one run — places then shapes — so a group
    // holding both closes on its last *shape*, not on its last place.
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2", "g1")],
      shapes: [shape("s1", "g1"), shape("s2", "g1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const last = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.kind !== "route-stop" && row.isLastInGroup,
    );

    expect(last.map((row) => row.key)).toEqual(["shape:s2"]);
  });

  it("closes on the last place when a group holds no shapes", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2", "g1")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const last = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.kind !== "route-stop" && row.isLastInGroup,
    );

    expect(last.map((row) => row.key)).toEqual(["place:p2"]);
  });

  it("never marks a loose row as closing a group", () => {
    // A loose row has no rail to close. It is the last row in the panel, which
    // is a different thing entirely.
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2")],
      shapes: [shape("s1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    const loose = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.kind !== "route-stop" && !row.indent,
    );

    expect(loose.map((row) => row.key)).toEqual(["place:p2", "shape:s1"]);
    expect(
      loose.every((row) => row.kind !== "heading" && row.kind !== "group" && row.kind !== "route-stop" && !row.isLastInGroup),
    ).toBe(true);
  });

  it("does not draw a separator when nothing precedes the loose rows", () => {
    // No groups means no Groups section, so there is no boundary to mark.
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    expect(
      rows.every((row) => row.kind === "heading" || row.kind === "group" || row.kind === "route-stop" || !row.startsLooseSection),
    ).toBe(true);
  });
});

/*
 * A route is the second kind of parent in this panel, and it owns no membership
 * — the stop list is the membership. See the file's own docblock.
 */
describe("sidebarRows route stops", () => {
  function route(id: string, placeIds: string[], groupId = ""): Shape {
    return {
      ...shape(id, groupId),
      geometry: {
        kind: "line",
        points: [
          [25.28, 54.687],
          [25.29, 54.688],
        ],
        route: {
          profile: "car",
          stops: placeIds.map((placeId) => ({ at: [25.28, 54.687], placeId })),
          durationS: 600,
        },
      },
    };
  }

  const opened = (id: string) => new Set([id]);

  it("draws the stops under the route when it is open", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2")],
      shapes: [route("r1", ["p1", "p2"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual(["shape:r1", "route:r1:0", "route:r1:1"]);
  });

  /*
   * The same rule a collapsed group follows: its members are left out entirely.
   * The count on the row is what says they are there.
   */
  it("draws none of them when it is shut, and the pins do not reappear loose", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2")],
      shapes: [route("r1", ["p1", "p2"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: NO_ROUTES,
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual(["shape:r1"]);
  });

  it("takes a stop out of the loose run and leaves everything else in it", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2"), place("p3")],
      shapes: [route("r1", ["p1", "p2"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual([
      "place:p3",
      "shape:r1",
      "route:r1:0",
      "route:r1:1",
    ]);
  });

  /*
   * One row per location. Leaving the stop in the group it was also put in by
   * hand drew it twice — and selection is keyed on the location, so clicking
   * either row lit both. See the file's own docblock.
   */
  it("takes a stop out of a group it was also put in by hand", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2")],
      shapes: [route("r1", ["p1", "p2"], "g1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    // p1 is in g1 and is a stop: it appears once, under the route, which is
    // itself in g1 — so the group still contains it, one level further in.
    expect(keys(rows)).toEqual([
      "heading",
      "group:g1",
      "shape:r1",
      "route:r1:0",
      "route:r1:1",
    ]);
  });

  // And the header cannot promise a row it does not open onto.
  it("counts the group by what it actually draws", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2", "g1"), place("p3", "g1")],
      shapes: [route("r1", ["p1", "p2"], "g1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    const header = rows.find((row) => row.kind === "group");

    // p3 and the route itself. p1 and p2 are the route's stops.
    expect(header?.kind === "group" && header.places.map((p) => p.id)).toEqual([
      "p3",
    ]);
    expect(header?.kind === "group" && header.shapes.length).toBe(1);
  });

  it("names the two ends and nothing in between", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2"), place("p3")],
      shapes: [route("r1", ["p1", "p2", "p3"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    const roles = rows.flatMap((row) =>
      row.kind === "route-stop" ? [row.role] : [],
    );

    expect(roles).toEqual(["start", "via", "end"]);
  });

  it("resolves each stop to its location, and says nothing for a deleted one", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1")],
      shapes: [route("r1", ["p1", "gone"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    const stops = rows.filter((row) => row.kind === "route-stop");

    expect(stops[0]?.kind === "route-stop" && stops[0].place?.id).toBe("p1");
    expect(stops[1]?.kind === "route-stop" && stops[1].place).toBeUndefined();
  });

  // The sub-group colour, from the resolver the canvas paints from.
  it("draws the stops on a grouped route in the group's colour", () => {
    const rows = sidebarRows({
      groups: [group("g1", "#2f9e44")],
      places: [place("p1"), place("p2")],
      shapes: [route("r1", ["p1", "p2"], "g1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    const stop = rows.find((row) => row.kind === "route-stop");

    expect(stop?.kind === "route-stop" && stop.railColor).toBe("#2f9e44");
  });

  it("draws the stops on a loose route in the route's own colour", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2")],
      shapes: [route("r1", ["p1", "p2"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    const stop = rows.find((row) => row.kind === "route-stop");

    expect(stop?.kind === "route-stop" && stop.railColor).toBe("#1c7ed6");
  });

  /*
   * The two-level case, and the only one in this panel. The group's rail runs on
   * past the stops when the group has more members below them, and stops when the
   * route was the last of them — a rail running on to nothing points at nothing.
   */
  it("runs the group's rail past the stops only when the group continues", () => {
    const outerOf = (shapes: Shape[]) => {
      const rows = sidebarRows({
        groups: [group("g1", "#2f9e44")],
        places: [place("p1"), place("p2")],
        shapes,
        collapsed: NO_COLLAPSE,
        expandedRoutes: opened("r1"),
        hideEmptyGroups: false,
      });

      const stop = rows.find((row) => row.kind === "route-stop");
      return stop?.kind === "route-stop" ? stop.outerRail : undefined;
    };

    expect(outerOf([route("r1", ["p1", "p2"], "g1"), shape("s2", "g1")])).toEqual({
      color: "#2f9e44",
      continues: true,
    });
    expect(outerOf([route("r1", ["p1", "p2"], "g1")])).toEqual({
      color: "#2f9e44",
      continues: false,
    });
  });

  it("gives a loose route's stops no outer rail at all", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2")],
      shapes: [route("r1", ["p1", "p2"])],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("r1"),
      hideEmptyGroups: false,
    });

    const stop = rows.find((row) => row.kind === "route-stop");

    expect(stop?.kind === "route-stop" && stop.outerRail).toBeUndefined();
  });

  // A hand-drawn line has no `route`, so it is a shape row and nothing more.
  it("leaves a shape that is not a route without stops or a disclosure", () => {
    const rows = sidebarRows({
      groups: [],
      places: [],
      shapes: [shape("s1")],
      collapsed: NO_COLLAPSE,
      expandedRoutes: opened("s1"),
      hideEmptyGroups: false,
    });

    const row = rows[0];

    expect(row?.kind === "shape" && row.stops).toBeUndefined();
  });
});

/*
 * A round trip names one location at both ends, and selection is keyed on the
 * location — so without this flag one selected id lit two rows, and pressing
 * Start lit End as well. See `lightsThisStop` in the Locations panel.
 */
describe("sidebarRows route stop first visits", () => {
  function route(id: string, placeIds: string[]): Shape {
    return {
      ...shape(id),
      geometry: {
        kind: "line",
        points: [
          [25.28, 54.687],
          [25.29, 54.688],
        ],
        route: {
          profile: "car",
          stops: placeIds.map((placeId) => ({ at: [25.28, 54.687], placeId })),
          durationS: 600,
        },
      },
    };
  }

  const visitsOf = (places: Place[], shapes: Shape[]) =>
    sidebarRows({
      groups: [],
      places,
      shapes,
      collapsed: NO_COLLAPSE,
      expandedRoutes: new Set(["r1", "r2"]),
      hideEmptyGroups: false,
    }).flatMap((row) => (row.kind === "route-stop" ? [row.isFirstVisit] : []));

  it("marks every stop of a route that visits nowhere twice", () => {
    expect(
      visitsOf([place("p1"), place("p2"), place("p3")], [route("r1", ["p1", "p2", "p3"])]),
    ).toEqual([true, true, true]);
  });

  it("marks only the first of the two ends of a round trip", () => {
    expect(
      visitsOf(
        [place("p1"), place("p2"), place("p3")],
        [route("r1", ["p1", "p2", "p3", "p1"])],
      ),
    ).toEqual([true, true, true, false]);
  });

  /* One location on two routes is two parents, and each stands for it once. */
  it("counts visits per route rather than across the panel", () => {
    expect(
      visitsOf(
        [place("p1"), place("p2")],
        [route("r1", ["p1", "p2"]), route("r2", ["p1", "p2"])],
      ),
    ).toEqual([true, true, true, true]);
  });

  /* A free waypoint stands for no location, so nothing can collide with it. */
  it("marks a waypoint as a first visit whatever came before it", () => {
    const bare = route("r1", ["p1"]);
    const geometry = bare.geometry;
    if (geometry.kind !== "line" || !geometry.route) throw new Error("not a route");

    geometry.route.stops = [
      { at: [25.28, 54.687], placeId: "p1" },
      { at: [25.29, 54.688] },
      { at: [25.3, 54.689] },
    ];

    expect(visitsOf([place("p1")], [bare])).toEqual([true, true, true]);
  });
});

/*
 * The sub-group colour, as the rows draw it. The canvas resolves the same thing
 * through the same index (components/editor/map-editor.tsx), so a disagreement
 * here is a pin one colour in the list and another on the map.
 */
describe("sidebarRows route stop colours", () => {
  function route(id: string, placeIds: string[], groupId = ""): Shape {
    return {
      ...shape(id, groupId),
      geometry: {
        kind: "line",
        points: [[25.28, 54.687], [25.29, 54.688]],
        route: {
          profile: "car",
          stops: placeIds.map((placeId) => ({ at: [25.28, 54.687], placeId })),
          durationS: 600,
        },
      },
    };
  }

  const stopsOf = (groups: Group[], places: Place[], shapes: Shape[]) =>
    sidebarRows({
      groups,
      places,
      shapes,
      collapsed: NO_COLLAPSE,
      expandedRoutes: new Set(["r1"]),
      hideEmptyGroups: false,
    }).flatMap((row) => (row.kind === "route-stop" ? [row] : []));

  it("lends the group's colour to every stop of a grouped route", () => {
    const stops = stopsOf(
      [group("g1", "#2f9e44")],
      [place("p1"), place("p2")],
      [route("r1", ["p1", "p2"], "g1")],
    );

    expect(stops.map((s) => s.groupColor)).toEqual(["#2f9e44", "#2f9e44"]);
  });

  it("lends nothing when the route is in no group", () => {
    const stops = stopsOf([], [place("p1"), place("p2")], [route("r1", ["p1", "p2"])]);

    expect(stops.map((s) => s.groupColor)).toEqual([undefined, undefined]);
  });

  // Own membership beats an inherited one, so a pin the owner put somewhere else
  // keeps that group's colour even while the route is lending its own.
  it("lets a stop's own group beat the route's", () => {
    const stops = stopsOf(
      [group("g1", "#2f9e44"), group("g2", "#e8590c")],
      [place("p1", "g2"), place("p2")],
      [route("r1", ["p1", "p2"], "g1")],
    );

    expect(stops.map((s) => s.groupColor)).toEqual(["#e8590c", "#2f9e44"]);
  });

  it("says nothing for a stop whose location has been deleted", () => {
    const stops = stopsOf(
      [group("g1", "#2f9e44")],
      [place("p1")],
      [route("r1", ["p1", "gone"], "g1")],
    );

    expect(stops[1]?.groupColor).toBeUndefined();
  });
});
