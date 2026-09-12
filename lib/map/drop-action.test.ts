import { describe, expect, it } from "vitest";

import type { DraggedObject } from "@/components/groups/use-row-drag";
import { dropAction, type DropTargetRow } from "./drop-action";

const place = (id: string): DraggedObject => ({ type: "place", id });
const shape = (id: string): DraggedObject => ({ type: "shape", id });
const group = (id: string): DraggedObject => ({ type: "group", id });

/** A row for a location or a shape, and the group it resolves to. */
const on = (object: DraggedObject, groupId = ""): DropTargetRow => ({
  kind: "object",
  object,
  groupId,
});

/** A group's header row. */
const onHeader = (groupId: string): DropTargetRow => ({ kind: "group", groupId });

describe("dropAction — a location or a shape in the hand", () => {
  it("joins the group of the row it lands on", () => {
    expect(dropAction(place("p1"), on(place("p2"), "g1"), "")).toEqual({
      kind: "join",
      groupId: "g1",
      object: place("p1"),
    });
  });

  it("joins the group whose header it lands on", () => {
    expect(dropAction(shape("s1"), onHeader("g1"), "")).toEqual({
      kind: "join",
      groupId: "g1",
      object: shape("s1"),
    });
  });

  it("makes a new group out of two loose rows", () => {
    expect(dropAction(place("p1"), on(shape("s1")), "")).toEqual({
      kind: "create",
      objects: [shape("s1"), place("p1")],
    });
  });

  it("leaves its old group when dropped on a loose row", () => {
    // Dropping something somewhere else is how it gets out of where it was.
    expect(dropAction(place("p1"), on(place("p2")), "g1")).toEqual({
      kind: "create",
      objects: [place("p2"), place("p1")],
    });
  });

  it("refuses a drop on itself", () => {
    expect(dropAction(place("p1"), on(place("p1")), "")).toBeNull();
  });

  it("tells a place and a shape with the same id apart", () => {
    // Ids come from two tables and can collide. A shape dropped on the place
    // that happens to share its id is a real drop, not a self-drop.
    expect(dropAction(shape("x"), on(place("x")), "")).not.toBeNull();
  });

  it("refuses a drop into the group it is already in", () => {
    expect(dropAction(place("p1"), on(place("p2"), "g1"), "g1")).toBeNull();
    expect(dropAction(place("p1"), onHeader("g1"), "g1")).toBeNull();
  });
});

describe("dropAction — a group in the hand", () => {
  it("merges into the group whose header it lands on, and that one survives", () => {
    expect(dropAction(group("g2"), onHeader("g1"), "")).toEqual({
      kind: "merge",
      targetGroupId: "g1",
      sourceGroupId: "g2",
    });
  });

  it("merges into the group of a member it lands on", () => {
    expect(dropAction(group("g2"), on(place("p1"), "g1"), "")).toEqual({
      kind: "merge",
      targetGroupId: "g1",
      sourceGroupId: "g2",
    });
  });

  it("takes a loose row in, rather than leaving the gesture dead", () => {
    expect(dropAction(group("g1"), on(place("p1")), "")).toEqual({
      kind: "join",
      groupId: "g1",
      object: place("p1"),
    });
  });

  it("refuses its own header", () => {
    expect(dropAction(group("g1"), onHeader("g1"), "")).toBeNull();
  });

  it("refuses its own members", () => {
    // Every row inside the group being dragged resolves to that same group, so
    // none of them lights up as the pointer crosses the block it came from.
    expect(dropAction(group("g1"), on(place("p1"), "g1"), "")).toBeNull();
    expect(dropAction(group("g1"), on(shape("s1"), "g1"), "")).toBeNull();
  });
});

/*
 * A route's stop is not a member of anything, so none of the cases above can
 * mean anything for one — its membership is the route's own `stops` array, and
 * reordering that is a different gesture handled by the drop bands on each stop
 * row (components/map/routes/route-stop-list-item.tsx).
 */
describe("dropAction — a route's stop in the hand", () => {
  const stop = (id: string): DraggedObject => ({ type: "route-stop", id });

  it("does nothing on any row of the panel", () => {
    expect(dropAction(stop("r1:0"), on(place("p1")), "")).toBeNull();
    expect(dropAction(stop("r1:0"), on(place("p1"), "g1"), "")).toBeNull();
    expect(dropAction(stop("r1:0"), on(shape("s1"), "g1"), "")).toBeNull();
    expect(dropAction(stop("r1:0"), onHeader("g1"), "")).toBeNull();
  });

  // Without the guard this fell through to `create`, making a group out of a
  // location and a row index.
  it("does not make a group out of a loose row and a stop", () => {
    expect(dropAction(stop("r1:2"), on(shape("s1")), "")).toBeNull();
  });
});
