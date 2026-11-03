import { describe, expect, it } from "vitest";

import { shortAgo } from "./ago";

const sec = 1_000;
const min = 60 * sec;
const hour = 60 * min;
const day = 24 * hour;

describe("shortAgo", () => {
  it("never reads below one minute", () => {
    expect(shortAgo(0)).toBe("1 min ago");
    expect(shortAgo(45 * sec)).toBe("1 min ago");
    expect(shortAgo(-5 * sec)).toBe("1 min ago");
    expect(shortAgo(Number.NaN)).toBe("1 min ago");
  });

  it("counts minutes, then hours", () => {
    expect(shortAgo(12 * min)).toBe("12 min ago");
    expect(shortAgo(59 * min + 59 * sec)).toBe("59 min ago");
    expect(shortAgo(hour)).toBe("1 h ago");
    expect(shortAgo(23 * hour + 59 * min)).toBe("23 h ago");
  });

  it("counts days, then weeks", () => {
    expect(shortAgo(day)).toBe("1 d ago");
    expect(shortAgo(6 * day + 23 * hour)).toBe("6 d ago");
    expect(shortAgo(7 * day)).toBe("1 week ago");
    expect(shortAgo(14 * day)).toBe("2 weeks ago");
    expect(shortAgo(29 * day)).toBe("4 weeks ago");
  });

  it("goes on to months and years", () => {
    expect(shortAgo(30 * day)).toBe("1 mo ago");
    expect(shortAgo(364 * day)).toBe("12 mo ago");
    expect(shortAgo(365 * day)).toBe("1 yr ago");
  });
});
