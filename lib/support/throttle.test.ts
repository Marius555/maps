import { describe, expect, it } from "vitest";

import { isTooSoon } from "./throttle";

const now = new Date("2026-09-27T12:00:00.000Z");

describe("isTooSoon", () => {
  it("allows the first report", () => {
    expect(isTooSoon(undefined, now)).toBe(false);
  });

  it("refuses a second within the minute", () => {
    expect(isTooSoon("2026-09-27T11:59:30.000Z", now)).toBe(true);
  });

  it("allows one a minute later", () => {
    expect(isTooSoon("2026-09-27T11:59:00.000Z", now)).toBe(false);
  });

  it("allows it when the stamp cannot be read", () => {
    expect(isTooSoon("not a date", now)).toBe(false);
  });
});
