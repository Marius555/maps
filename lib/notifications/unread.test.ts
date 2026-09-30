import { describe, expect, it } from "vitest";

import type { AppNotification } from "./types";
import { isLive, toFeed } from "./unread";

function note(id: string, publishedAt: string, expiresAt: string | null = null): AppNotification {
  return {
    id,
    title: id,
    body: "",
    kind: "info",
    linkUrl: null,
    linkLabel: null,
    publishedAt,
    expiresAt,
  };
}

const items = [
  note("new", "2026-09-20T10:00:00.000+00:00"),
  note("old", "2026-09-01T10:00:00.000+00:00"),
];

describe("toFeed", () => {
  it("counts only what was published after the last visit", () => {
    const feed = toFeed(items, "2026-09-10T00:00:00.000Z", "2026-01-01T00:00:00.000Z");

    expect(feed.unreadCount).toBe(1);
    expect(feed.items.map((item) => item.isUnread)).toEqual([true, false]);
  });

  it("does not greet a new account with every broadcast ever sent", () => {
    const feed = toFeed(items, null, "2026-09-15T00:00:00.000Z");

    expect(feed.unreadCount).toBe(1);
    expect(feed.items).toHaveLength(2);
  });

  it("uses the later of the two stamps", () => {
    const feed = toFeed(items, "2026-08-01T00:00:00.000Z", "2026-09-25T00:00:00.000Z");

    expect(feed.unreadCount).toBe(0);
  });

  it("treats an unknown history as all new rather than failing", () => {
    expect(toFeed(items, null, null).unreadCount).toBe(2);
    expect(toFeed(items, "garbage", null).unreadCount).toBe(2);
  });
});

describe("isLive", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");

  it("hides what is scheduled for later", () => {
    expect(isLive(note("a", "2026-09-30T00:00:00.000Z"), now)).toBe(false);
  });

  it("hides what has expired and keeps what has not", () => {
    expect(isLive(note("a", "2026-09-01T00:00:00.000Z", "2026-09-29T11:59:00.000Z"), now)).toBe(false);
    expect(isLive(note("a", "2026-09-01T00:00:00.000Z", "2026-09-29T12:01:00.000Z"), now)).toBe(true);
    expect(isLive(note("a", "2026-09-01T00:00:00.000Z"), now)).toBe(true);
  });
});
