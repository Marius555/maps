import { describe, expect, it } from "vitest";

import { nextPlaceDefaults } from "./next-place-defaults";

const place = (name: string, sortOrder: number) => ({ name, sortOrder });

describe("nextPlaceDefaults", () => {
  it("starts at 1 on an empty map", () => {
    expect(nextPlaceDefaults([])).toEqual({ name: "Location 1", sortOrder: 0 });
  });

  it("continues from the highest number in use", () => {
    const defaults = nextPlaceDefaults([
      place("Location 1", 0),
      place("Location 2", 1),
    ]);

    expect(defaults).toEqual({ name: "Location 3", sortOrder: 2 });
  });

  /**
   * The delete-then-add case. Counting the list gave "Location 3" a second time,
   * because deleting one left two rows with the higher number still on the map.
   */
  it("does not reuse a number after an earlier location is deleted", () => {
    const defaults = nextPlaceDefaults([
      place("Location 1", 0),
      place("Location 3", 2),
    ]);

    expect(defaults.name).toBe("Location 4");
  });

  it("takes the next free sortOrder even when the list is out of order", () => {
    const defaults = nextPlaceDefaults([
      place("Warehouse", 7),
      place("Depot", 2),
    ]);

    expect(defaults.sortOrder).toBe(8);
  });

  it("ignores names the customer has written", () => {
    const defaults = nextPlaceDefaults([
      place("Location 14 (closed)", 0),
      place("Shop on Location 99", 1),
      place("Location 2", 2),
    ]);

    // Not 15 or 100 — only "Location <n>" exactly counts. Falls back to the list
    // length, which is 3.
    expect(defaults.name).toBe("Location 4");
  });

  it("never hands back a number already taken by a renamed-around gap", () => {
    // Two placeholders and one renamed row: the count (3) beats the highest
    // number (2), so the name stays ahead of the list rather than colliding.
    const defaults = nextPlaceDefaults([
      place("Location 1", 0),
      place("Location 2", 1),
      place("Corner Shop", 2),
    ]);

    expect(defaults.name).toBe("Location 4");
  });

  it("does not turn an absurd number into an exponent", () => {
    const defaults = nextPlaceDefaults([
      place("Location 99999999999999999999", 0),
    ]);

    expect(defaults.name).toBe("Location 2");
  });
});
