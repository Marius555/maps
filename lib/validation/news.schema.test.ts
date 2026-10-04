import { describe, expect, it } from "vitest";

import {
  adminNewsFormSchema,
  newsInputSchema,
  newsSlugFromTitle,
  toNewsInput,
  type AdminNewsForm,
} from "./news.schema";

const form: AdminNewsForm = {
  title: "Google Sheets sync is here",
  slug: "google-sheets-sync",
  summary: "Keep a map in step with a sheet.",
  body: "## What changed\n\nEverything.",
  category: "product",
  coverAlt: "",
  status: "published",
  publishedAt: "",
};

describe("newsSlugFromTitle", () => {
  it("makes a lowercase hyphenated address", () => {
    expect(newsSlugFromTitle("Google Sheets — now in sync!")).toBe("google-sheets-now-in-sync");
  });

  it("drops accents rather than the letters", () => {
    expect(newsSlugFromTitle("Café Ünïon")).toBe("cafe-union");
  });

  it("never ends in a hyphen after being cut short", () => {
    const slug = newsSlugFromTitle(`${"a".repeat(119)} b`);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(120);
  });
});

describe("adminNewsFormSchema", () => {
  it("accepts a complete post", () => {
    expect(adminNewsFormSchema.safeParse(form).success).toBe(true);
  });

  it.each(["Has Caps", "two--hyphens", "-leading", "trailing-", "spa ce", "ünï"])(
    "refuses the address %s",
    (slug) => {
      const result = adminNewsFormSchema.safeParse({ ...form, slug });
      expect(result.success).toBe(false);
    },
  );

  it("refuses an unknown category", () => {
    expect(adminNewsFormSchema.safeParse({ ...form, category: "policy" }).success).toBe(false);
  });

  it("refuses an unreadable date", () => {
    expect(adminNewsFormSchema.safeParse({ ...form, publishedAt: "next week" }).success).toBe(false);
  });
});

describe("toNewsInput", () => {
  const now = new Date("2026-10-04T12:00:00Z");

  it("gives a draft no publish time, whatever the date field says", () => {
    const input = toNewsInput({ ...form, status: "draft", publishedAt: "2026-11-01T09:00:00Z" }, now);
    expect(input.publishedAt).toBeNull();
    expect(newsInputSchema.safeParse(input).success).toBe(true);
  });

  it("publishes now when no date is given", () => {
    expect(toNewsInput(form, now).publishedAt).toBe("2026-10-04T12:00:00.000Z");
  });

  it("keeps a chosen date, so a future one schedules the post", () => {
    const input = toNewsInput({ ...form, publishedAt: "2026-11-01T09:00:00.000Z" }, now);
    expect(input.publishedAt).toBe("2026-11-01T09:00:00.000Z");
    expect(newsInputSchema.safeParse(input).success).toBe(true);
  });
});
