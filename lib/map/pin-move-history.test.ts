import { describe, expect, it } from "vitest";

import type { Place } from "@/lib/repositories/types";
import {
  PIN_MOVE_HISTORY_LIMIT,
  positionOf,
  pushMove,
  retainMoves,
  takeLatest,
  type PinMove,
} from "./pin-move-history";

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "place-1",
    mapId: "map-1",
    name: "Somewhere",
    lat: 54.687,
    lng: 25.28,
    address: "Gedimino pr. 1, Vilnius",
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
    geocodeConfidence: 0.9,
    geocodeStatus: "ok",
    addressParts: { postcode: "01103" },
    groupId: "",
    cardBlocks: {},
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function move(placeId: string, lat = 1): PinMove {
  return {
    placeId,
    before: positionOf(place({ id: placeId, lat })),
    addressWasPending: false,
  };
}

describe("positionOf", () => {
  it("keeps everything a drag and its address lookup can change", () => {
    expect(positionOf(place())).toEqual({
      lat: 54.687,
      lng: 25.28,
      address: "Gedimino pr. 1, Vilnius",
      addressParts: { postcode: "01103" },
      geocodeConfidence: 0.9,
      geocodeStatus: "ok",
    });
  });
});

describe("pushMove", () => {
  it("puts the new move on top", () => {
    const stack = pushMove([move("a")], move("b"));
    expect(stack.map((entry) => entry.placeId)).toEqual(["a", "b"]);
  });

  it("drops the oldest moves past the limit", () => {
    let stack: PinMove[] = [];
    for (let index = 0; index < PIN_MOVE_HISTORY_LIMIT + 3; index++) {
      stack = pushMove(stack, move(`p${index}`));
    }

    expect(stack).toHaveLength(PIN_MOVE_HISTORY_LIMIT);
    expect(stack[0].placeId).toBe("p3");
    expect(stack.at(-1)?.placeId).toBe(`p${PIN_MOVE_HISTORY_LIMIT + 2}`);
  });

  it("does not change the stack it was given", () => {
    const stack = [move("a")];
    pushMove(stack, move("b"));
    expect(stack).toHaveLength(1);
  });
});

describe("takeLatest", () => {
  it("undoes the newest move first", () => {
    const first = move("a", 1);
    const second = move("a", 2);

    const { move: taken, rest } = takeLatest([first, second], new Set(["a"]));

    expect(taken).toBe(second);
    expect(rest).toEqual([first]);
  });

  it("skips and discards moves of deleted locations", () => {
    const kept = move("a");

    const { move: taken, rest } = takeLatest(
      [kept, move("gone"), move("gone")],
      new Set(["a"]),
    );

    expect(taken).toBe(kept);
    expect(rest).toEqual([]);
  });

  it("finds nothing when every location has been deleted", () => {
    expect(takeLatest([move("gone")], new Set())).toEqual({
      move: null,
      rest: [],
    });
  });
});

describe("retainMoves", () => {
  it("drops moves of locations that no longer exist", () => {
    const kept = move("a");
    expect(retainMoves([kept, move("gone")], new Set(["a"]))).toEqual([kept]);
  });

  it("returns the same array when nothing was dropped", () => {
    const stack = [move("a"), move("b")];
    expect(retainMoves(stack, new Set(["a", "b"]))).toBe(stack);
  });
});
