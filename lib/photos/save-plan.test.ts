// @vitest-environment jsdom
// `File` — a node environment has no constructor for one, and the whole point
// of a `new` slot is that it carries one.

import { describe, expect, it } from "vitest";

import {
  desiredOrder,
  planPhotoSave,
  sameOrder,
  type PhotoSlot,
} from "./save-plan";

function saved(id: string): PhotoSlot {
  return { kind: "saved", id, url: `https://example.test/${id}` };
}

function picked(name: string): PhotoSlot {
  return {
    kind: "new",
    key: name,
    file: new File(["x"], name, { type: "image/jpeg" }),
    url: `blob:${name}`,
  };
}

describe("planPhotoSave", () => {
  it("does nothing when the gallery is untouched", () => {
    const plan = planPhotoSave([saved("a"), saved("b")], ["a", "b"]);

    expect(plan.removals).toEqual([]);
    expect(plan.uploads).toEqual([]);
  });

  it("removes the saved ids that are no longer in the list", () => {
    const plan = planPhotoSave([saved("a"), saved("c")], ["a", "b", "c"]);

    expect(plan.removals).toEqual(["b"]);
  });

  it("uploads picked files in the order they sit in the gallery", () => {
    const plan = planPhotoSave([picked("one.jpg"), saved("a"), picked("two.jpg")], ["a"]);

    expect(plan.uploads.map((file) => file.name)).toEqual(["one.jpg", "two.jpg"]);
    expect(plan.removals).toEqual([]);
  });

  it("removes and uploads in the same save", () => {
    const plan = planPhotoSave([saved("b"), picked("new.jpg")], ["a", "b"]);

    expect(plan.removals).toEqual(["a"]);
    expect(plan.uploads.map((file) => file.name)).toEqual(["new.jpg"]);
  });

  // Swapping the last photo on a full location: the removal has to be issued
  // before the upload or the server counts a ninth photo and refuses.
  it("still removes first when the gallery is at its cap", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const plan = planPhotoSave(
      [...ids.slice(0, 7).map(saved), picked("replacement.jpg")],
      ids,
    );

    expect(plan.removals).toEqual(["h"]);
    expect(plan.uploads).toHaveLength(1);
  });
});

describe("desiredOrder", () => {
  it("keeps saved ids where they are", () => {
    expect(desiredOrder([saved("b"), saved("a")], [])).toEqual(["b", "a"]);
  });

  // The upload appends, so a photo dropped in at the front comes back at the
  // end. This is what the reorder exists to undo.
  it("puts an uploaded id where its slot sits, not where it was appended", () => {
    const order = desiredOrder([picked("new.jpg"), saved("a")], ["fresh"]);

    expect(order).toEqual(["fresh", "a"]);
  });

  it("matches several uploads to their slots in upload order", () => {
    const order = desiredOrder(
      [picked("one.jpg"), saved("a"), picked("two.jpg")],
      ["id-one", "id-two"],
    );

    expect(order).toEqual(["id-one", "a", "id-two"]);
  });
});

describe("sameOrder", () => {
  it("is true only for the same ids in the same places", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["b", "a"], ["a", "b"])).toBe(false);
    expect(sameOrder(["a"], ["a", "b"])).toBe(false);
    expect(sameOrder([], [])).toBe(true);
  });

  /*
   * The regression this module was extracted for.
   *
   * "Make cover" adds and removes nothing, so the plan is empty and no request
   * has been made by the time the order is compared. Comparing against the
   * *baseline* is what notices; comparing against the last response — which is
   * null here — is what silently discarded the change.
   */
  it("notices a reorder that adds and removes nothing", () => {
    const slots = [saved("b"), saved("a")];
    const savedIds = ["a", "b"];
    const plan = planPhotoSave(slots, savedIds);

    expect(plan.removals).toEqual([]);
    expect(plan.uploads).toEqual([]);
    expect(sameOrder(desiredOrder(slots, []), savedIds)).toBe(false);
  });
});
