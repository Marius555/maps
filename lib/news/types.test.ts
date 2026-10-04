import { describe, expect, it } from "vitest";

import { isNewsCategory, newsStatus } from "./types";

describe("newsStatus", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");

  it("reads a post with no publish time as a draft", () => {
    expect(newsStatus(null, now)).toBe("draft");
  });

  it("reads a future publish time as scheduled", () => {
    expect(newsStatus("2026-10-04T12:00:01Z", now)).toBe("scheduled");
  });

  it("reads a past or present publish time as published", () => {
    expect(newsStatus("2026-10-04T12:00:00Z", now)).toBe("published");
    expect(newsStatus("2025-01-01T00:00:00Z", now)).toBe("published");
  });
});

describe("isNewsCategory", () => {
  it("accepts the fixed list and nothing else", () => {
    expect(isNewsCategory("product")).toBe(true);
    expect(isNewsCategory("Product")).toBe(false);
    expect(isNewsCategory(undefined)).toBe(false);
  });
});
