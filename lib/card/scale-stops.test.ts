import { describe, expect, it } from "vitest";

import { nearestStop } from "./scale-stops";

describe("nearestStop", () => {
  const stops = [0, 1, 2, 4, 6];

  it("returns a value that is already a stop", () => {
    expect(nearestStop(4, stops)).toBe(4);
  });

  it("snaps a value between two stops to the closer one", () => {
    expect(nearestStop(5.2, stops)).toBe(6);
    expect(nearestStop(3.4, stops)).toBe(4);
  });

  it("breaks a tie towards the lower stop", () => {
    // 3 is one away from both 2 and 4. The answer must not depend on which was
    // written first, so it is the lower — the table is ascending.
    expect(nearestStop(3, stops)).toBe(2);
  });

  it("clamps to the ends rather than running off them", () => {
    expect(nearestStop(-40, stops)).toBe(0);
    expect(nearestStop(900, stops)).toBe(6);
  });

  it("keeps the off position distinct from the smallest real value", () => {
    // The font-size scale spells "leave it alone" as 0 and its smallest real
    // size as 12. Snapping 0 to 12 would turn opening the panel into a resize.
    expect(nearestStop(0, [0, 12, 16, 22, 28])).toBe(0);
  });

  it("survives an empty table", () => {
    expect(nearestStop(7, [])).toBe(0);
  });
});
