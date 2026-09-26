import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", analyticsSalt: "" },
}));

import { visitorKey } from "./visitor-key";

const BASE = {
  mapId: "map-1",
  ip: "81.7.144.23",
  userAgent: "Mozilla/5.0 Chrome/140.0",
  now: new Date("2026-09-07T10:00:00Z"),
};

/** The anonymous key unique and returning visitors are counted by. */
describe("visitorKey", () => {
  it("is the same for the same visitor on the same map in the same month", () => {
    expect(visitorKey(BASE)).toBe(
      visitorKey({ ...BASE, now: new Date("2026-09-29T23:00:00Z") }),
    );
  });

  it("changes on the first of the month", () => {
    expect(visitorKey(BASE)).not.toBe(
      visitorKey({ ...BASE, now: new Date("2026-10-01T00:00:00Z") }),
    );
  });

  it("differs between maps, so no two customers' visitors can be joined", () => {
    expect(visitorKey(BASE)).not.toBe(visitorKey({ ...BASE, mapId: "map-2" }));
  });

  it("differs between browsers behind one address", () => {
    expect(visitorKey(BASE)).not.toBe(
      visitorKey({ ...BASE, userAgent: "Mozilla/5.0 Firefox/141.0" }),
    );
  });

  it("is sixteen hex characters", () => {
    expect(visitorKey(BASE)).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is null without an address", () => {
    expect(visitorKey({ ...BASE, ip: null })).toBeNull();
  });
});
