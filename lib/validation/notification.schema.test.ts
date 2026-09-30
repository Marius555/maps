import { describe, expect, it } from "vitest";

import {
  adminNotificationFormSchema,
  isSafeNotificationLink,
  notificationInputSchema,
  toNotificationInput,
} from "./notification.schema";

const base = { title: "Scheduled maintenance", body: "Saturday 02:00 UTC.", audience: "all" };

describe("isSafeNotificationLink", () => {
  it.each(["https://pinglide.com/blog", "/settings/billing", "/maps"])("allows %s", (url) => {
    expect(isSafeNotificationLink(url)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>",
    "http://example.com",
    "//evil.example",
    "/\\evil.example",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isSafeNotificationLink(url)).toBe(false);
  });
});

describe("notificationInputSchema", () => {
  it("accepts a broadcast and defaults the kind", () => {
    expect(notificationInputSchema.parse(base).kind).toBe("info");
  });

  it("needs an account for a message to one account", () => {
    expect(notificationInputSchema.safeParse({ ...base, audience: "user" }).success).toBe(false);
    expect(
      notificationInputSchema.safeParse({ ...base, audience: "user", audienceUserId: "u1" }).success,
    ).toBe(true);
  });

  it("needs a plan for a message to plans", () => {
    expect(notificationInputSchema.safeParse({ ...base, audience: "plan", audiencePlans: [] }).success).toBe(false);
    expect(notificationInputSchema.safeParse({ ...base, audience: "plan", audiencePlans: ["gold"] }).success).toBe(false);
    expect(
      notificationInputSchema.safeParse({ ...base, audience: "plan", audiencePlans: ["free"] }).success,
    ).toBe(true);
  });

  it("refuses a script link and a link without a label", () => {
    expect(
      notificationInputSchema.safeParse({ ...base, linkUrl: "javascript:alert(1)", linkLabel: "Go" }).success,
    ).toBe(false);
    expect(notificationInputSchema.safeParse({ ...base, linkUrl: "/maps" }).success).toBe(false);
  });

  it("refuses an expiry before publication", () => {
    const result = notificationInputSchema.safeParse({
      ...base,
      publishedAt: "2026-10-02T00:00:00Z",
      expiresAt: "2026-10-01T00:00:00Z",
    });

    expect(result.success).toBe(false);
  });
});

describe("adminNotificationFormSchema", () => {
  const form = {
    title: "New basemaps",
    body: "Three new looks.",
    kind: "info" as const,
    audience: "all" as const,
    audienceEmail: "",
    audiencePlans: [],
    linkUrl: "",
    linkLabel: "",
    publishedAt: "",
    expiresAt: "",
  };

  const issuesOf = (input: unknown) =>
    adminNotificationFormSchema.safeParse(input).error?.issues.map((issue) => issue.path.join(".")) ?? [];

  it("accepts a broadcast with every optional field empty", () => {
    expect(issuesOf(form)).toEqual([]);
  });

  it("needs an email for one account, and plans for a plan audience", () => {
    expect(issuesOf({ ...form, audience: "user", audienceEmail: "nope" })).toEqual(["audienceEmail"]);
    expect(issuesOf({ ...form, audience: "plan" })).toEqual(["audiencePlans"]);
  });

  it("refuses an unsafe link and a link without a label", () => {
    expect(issuesOf({ ...form, linkUrl: "javascript:alert(1)", linkLabel: "Go" })).toEqual(["linkUrl"]);
    expect(issuesOf({ ...form, linkUrl: "/maps" })).toEqual(["linkLabel"]);
  });

  it("takes the form's local date format and refuses an expiry before sending", () => {
    expect(issuesOf({ ...form, publishedAt: "2030-01-02T10:00", expiresAt: "2030-01-01T10:00" })).toEqual([
      "expiresAt",
    ]);
  });

  it("maps to the stored input, dropping the fields its audience does not use", () => {
    const input = toNotificationInput(
      { ...form, audience: "user", audienceEmail: "a@b.co", audiencePlans: ["pro"] },
      "user-1",
    );

    expect(notificationInputSchema.parse(input)).toMatchObject({
      audience: "user",
      audienceUserId: "user-1",
      audiencePlans: undefined,
      linkUrl: undefined,
    });
  });
});
