import { describe, expect, it } from "vitest";

import { nextShapeDefaults } from "./next-shape-defaults";
import { PALETTE_COLORS } from "@/lib/validation/palette";

describe("nextShapeDefaults", () => {
  it("cycles the palette when the gesture supplied no colour", () => {
    expect(nextShapeDefaults([], "circle").color).toBe(PALETTE_COLORS[0]);
    expect(
      nextShapeDefaults([{ name: "Circle 1", sortOrder: 0 }], "circle").color,
    ).toBe(PALETTE_COLORS[1]);
  });

  /*
   * The whole point of the argument: a route drawn through black pins comes out
   * black, not the next colour in a list nobody on that map chose from.
   */
  it("takes a colour the gesture supplied", () => {
    expect(nextShapeDefaults([], "route", "#000000").color).toBe("#000000");
  });

  it("still numbers and orders the shape either way", () => {
    const defaults = nextShapeDefaults(
      [
        { name: "Route 1", sortOrder: 0 },
        { name: "Route 2", sortOrder: 7 },
      ],
      "route",
      "#000000",
    );

    expect(defaults.name).toBe("Route 3");
    expect(defaults.sortOrder).toBe(8);
  });
});
