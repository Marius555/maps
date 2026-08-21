import { describe, expect, it } from "vitest";

import { formatCount } from "./number";

describe("formatCount", () => {
  it("groups thousands", () => {
    expect(formatCount(3000)).toBe("3,000");
    expect(formatCount(1234567)).toBe("1,234,567");
  });

  it("leaves small numbers alone", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
  });

  it("ignores the ambient locale", () => {
    // The whole point. On a machine set to a European locale, Node's bare
    // `toLocaleString()` returns "3 000" or "3.000" while the browser returns
    // "3,000", and the mismatch tears down the React tree on hydration. If this
    // ever starts matching the German rendering, the locale pin has been lost.
    expect(formatCount(3000)).not.toBe((3000).toLocaleString("de-DE"));
    expect(formatCount(3000)).toBe((3000).toLocaleString("en-US"));
  });
});
