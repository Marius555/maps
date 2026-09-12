import { describe, expect, it } from "vitest";

import type { RouteStop } from "@/packages/shared/shapes";
import { canReorderStops, makeEnd, makeStart, moveStop } from "./route-order";

/** A bonded stop. The coordinate is filler except where it is the point. */
function stop(placeId: string, at: [number, number] = [25.28, 54.687]): RouteStop {
  return { at, placeId };
}

/** A free waypoint: no id at all, which is every stop on a legacy route. */
function waypoint(lng: number): RouteStop {
  return { at: [lng, 54.687] };
}

const ids = (stops: RouteStop[] | null) =>
  stops?.map((s) => s.placeId ?? `@${String(s.at[0])}`) ?? null;

describe("moveStop", () => {
  it("moves a stop up, before the row it was dropped on", () => {
    const stops = [stop("a"), stop("b"), stop("c")];

    expect(ids(moveStop(stops, 2, 0))).toEqual(["c", "a", "b"]);
    expect(ids(moveStop(stops, 2, 1))).toEqual(["a", "c", "b"]);
  });

  /*
   * Removing the stop shifts everything after it down one, so a destination past
   * the hole means one less than it says. Getting this wrong is an off-by-one
   * that only shows up dragging downwards.
   */
  it("moves a stop down, accounting for the hole it leaves", () => {
    const stops = [stop("a"), stop("b"), stop("c")];

    expect(ids(moveStop(stops, 0, 2))).toEqual(["b", "a", "c"]);
    expect(ids(moveStop(stops, 0, 3))).toEqual(["b", "c", "a"]);
  });

  // Both spellings of "back where it came from". Each would otherwise be a
  // metered request for the geometry already on screen.
  it("returns null for a drop either side of the stop's own row", () => {
    const stops = [stop("a"), stop("b"), stop("c")];

    expect(moveStop(stops, 1, 1)).toBeNull();
    expect(moveStop(stops, 1, 2)).toBeNull();
  });

  it("returns null for an index off either end", () => {
    const stops = [stop("a"), stop("b")];

    expect(moveStop(stops, -1, 0)).toBeNull();
    expect(moveStop(stops, 2, 0)).toBeNull();
    expect(moveStop(stops, 0, 3)).toBeNull();
  });

  /*
   * The round trip, which is `removeStopAt`'s subtlety seen from the other side.
   * A→B→A is a delivery loop; moving B to the front leaves B→A→A, whose last leg
   * is nought metres. Collapsed, that is B→A, which is a real route.
   */
  it("collapses the repeat a move can create", () => {
    const stops = [stop("a"), stop("b"), stop("a")];

    expect(ids(moveStop(stops, 1, 0))).toEqual(["b", "a"]);
  });

  it("returns null when collapsing leaves fewer than two stops", () => {
    const stops = [stop("a"), stop("b"), stop("a")];

    // Moving an end inward makes all three consecutive: a, a, b -> a, b. Still a
    // route. But a two-stop loop has nothing left after a collapse.
    expect(moveStop([stop("a"), stop("a")], 1, 0)).toBeNull();
    expect(ids(moveStop(stops, 2, 1))).toEqual(["a", "b"]);
  });

  // Legacy routes are full of these and two of them are not interchangeable, so
  // the no-op check compares where they are rather than an id they do not have.
  it("keeps free waypoints and tells two of them apart", () => {
    const stops = [waypoint(25.1), waypoint(25.2), stop("a")];

    expect(ids(moveStop(stops, 0, 2))).toEqual(["@25.2", "@25.1", "a"]);
  });
});

describe("makeStart and makeEnd", () => {
  it("move the stop to the front and to the back", () => {
    const stops = [stop("a"), stop("b"), stop("c")];

    expect(ids(makeStart(stops, 1))).toEqual(["b", "a", "c"]);
    expect(ids(makeEnd(stops, 1))).toEqual(["a", "c", "b"]);
  });

  // The control is offered on every row, so the two rows where it would change
  // nothing have to answer null rather than spend a request saying so.
  it("return null on the stop that is already there", () => {
    const stops = [stop("a"), stop("b"), stop("c")];

    expect(makeStart(stops, 0)).toBeNull();
    expect(makeEnd(stops, 2)).toBeNull();
  });

  // Reversing a two-stop route is a real thing to want, and it is the one move
  // a two-stop route has.
  it("reverse a two-stop route", () => {
    const stops = [stop("a"), stop("b")];

    expect(ids(makeStart(stops, 1))).toEqual(["b", "a"]);
    expect(ids(makeEnd(stops, 0))).toEqual(["b", "a"]);
  });
});

describe("canReorderStops", () => {
  it("is true from two stops up", () => {
    expect(canReorderStops([stop("a"), stop("b")])).toBe(true);
    expect(canReorderStops([stop("a")])).toBe(false);
    expect(canReorderStops([])).toBe(false);
  });
});
