import { describe, expect, it } from "vitest";

import type { Group, Place, Shape } from "@/lib/repositories/types";
import { sidebarRows } from "./sidebar-rows";

const NO_COLLAPSE: ReadonlySet<string> = new Set();

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
    geocodeStatus: "manual",
    addressParts: null,
    groupId,
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
      hideEmptyGroups: false,
    });

    expect(keys(rows)).toEqual(["place:p1", "shape:s1"]);
    // And a drop on one of them means "make a new group", not "join gone".
    expect(rows.every((row) => row.kind === "heading" || row.kind === "group" || row.groupId === "")).toBe(
      true,
    );
  });

  it("drops the Groups heading when there are no groups to head", () => {
    const rows = sidebarRows({
      groups: [],
      places: [place("p1")],
      shapes: [],
      collapsed: NO_COLLAPSE,
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
      hideEmptyGroups: false,
    });

    const starts = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.startsLooseSection,
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
      hideEmptyGroups: false,
    });

    const last = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.isLastInGroup,
    );

    expect(last.map((row) => row.key)).toEqual(["shape:s2"]);
  });

  it("closes on the last place when a group holds no shapes", () => {
    const rows = sidebarRows({
      groups: [group("g1")],
      places: [place("p1", "g1"), place("p2", "g1")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      hideEmptyGroups: false,
    });

    const last = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && row.isLastInGroup,
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
      hideEmptyGroups: false,
    });

    const loose = rows.filter(
      (row) => row.kind !== "heading" && row.kind !== "group" && !row.indent,
    );

    expect(loose.map((row) => row.key)).toEqual(["place:p2", "shape:s1"]);
    expect(
      loose.every((row) => row.kind !== "heading" && row.kind !== "group" && !row.isLastInGroup),
    ).toBe(true);
  });

  it("does not draw a separator when nothing precedes the loose rows", () => {
    // No groups means no Groups section, so there is no boundary to mark.
    const rows = sidebarRows({
      groups: [],
      places: [place("p1"), place("p2")],
      shapes: [],
      collapsed: NO_COLLAPSE,
      hideEmptyGroups: false,
    });

    expect(
      rows.every((row) => row.kind === "heading" || row.kind === "group" || !row.startsLooseSection),
    ).toBe(true);
  });
});
