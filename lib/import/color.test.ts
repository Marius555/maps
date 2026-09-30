import { describe, expect, it } from "vitest";

import { parseHexColor } from "./color";

describe("parseHexColor", () => {
  it("reads the spellings a spreadsheet holds", () => {
    expect(parseHexColor("#E03131")).toBe("#e03131");
    expect(parseHexColor("e03131")).toBe("#e03131");
    expect(parseHexColor(" #e31 ")).toBe("#ee3311");
    expect(parseHexColor("0CA678")).toBe("#0ca678");
  });

  it("refuses anything that is not a hex code", () => {
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("red")).toBeNull();
    expect(parseHexColor("#e0313")).toBeNull();
    expect(parseHexColor("#e031311")).toBeNull();
    expect(parseHexColor("rgb(224, 49, 49)")).toBeNull();
  });
});
