import { describe, expect, it } from "vitest";

import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("keeps a path on this site", () => {
    expect(safeRedirect("/maps/abc?tab=places#x")).toBe("/maps/abc?tab=places#x");
    expect(safeRedirect("/connect/wordpress?site=https%3A%2F%2Fa.com")).toBe(
      "/connect/wordpress?site=https%3A%2F%2Fa.com",
    );
  });

  it("falls back for nothing at all", () => {
    expect(safeRedirect(undefined)).toBe("/maps");
    expect(safeRedirect("")).toBe("/maps");
    expect(safeRedirect([], "/x")).toBe("/x");
  });

  it("takes the first of repeated values", () => {
    expect(safeRedirect(["/a", "/b"])).toBe("/a");
    expect(safeRedirect(["https://evil.example", "/b"])).toBe("/maps");
  });

  it.each([
    "https://evil.example",
    "evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r\n/evil.example",
    "/\t\\evil.example",
    "\t//evil.example",
    "/x\\..\\..\\/evil.example",
    "javascript:alert(1)",
  ])("refuses %j", (value) => {
    expect(safeRedirect(value)).toBe("/maps");
  });
});
