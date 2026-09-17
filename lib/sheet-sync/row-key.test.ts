import { describe, expect, it } from "vitest";

import { sourceKeysFor } from "./row-key";

describe("sourceKeysFor", () => {
  it("gives the same row the same key every time", () => {
    const [first] = sourceKeysFor([{ name: "Bike Hub", address: "1 High St" }]);
    const [second] = sourceKeysFor([{ name: "Bike Hub", address: "1 High St" }]);

    expect(first).toBe(second);
    expect(first).toMatch(/^v1:[0-9a-f]+$/);
  });

  it("ignores the ways a spreadsheet differs from itself", () => {
    const [a, b] = sourceKeysFor([
      { name: "Bike Hub", address: "1 High St" },
      { name: "  bike  HUB ", address: "1   high st" },
    ]);

    // The same base, so the second is numbered as its duplicate.
    expect(b).toBe(`${a}#2`);
  });

  it("tells a different name or address apart", () => {
    const [a, b, c] = sourceKeysFor([
      { name: "Bike Hub", address: "1 High St" },
      { name: "Bike Hub North", address: "1 High St" },
      { name: "Bike Hub", address: "2 High St" },
    ]);

    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("does not let name and address run into each other", () => {
    const [a, b] = sourceKeysFor([
      { name: "Bike Hub 1", address: "High St" },
      { name: "Bike Hub", address: "1 High St" },
    ]);

    expect(a).not.toBe(b);
  });

  it("numbers duplicates in order and fits the column", () => {
    const keys = sourceKeysFor(
      Array.from({ length: 12 }, () => ({ name: "Kiosk", address: "Station" })),
    );

    expect(keys[0]).not.toContain("#");
    expect(keys[1]).toMatch(/#2$/);
    expect(keys[11]).toMatch(/#12$/);
    expect(Math.max(...keys.map((key) => key.length))).toBeLessThanOrEqual(64);
  });
});
