import { describe, expect, it } from "vitest";

import {
  connectMapSchema,
  connectRequestSchema,
  sameSite,
} from "@/lib/validation/connect.schema";
import { MAX_ALLOWED_DOMAINS } from "@/lib/validation/domain.schema";
import { allowSite, buildReturnUrl, siteHost } from "./wordpress";

const valid = {
  site: "https://example.com",
  return: "https://example.com/wp-admin/admin-post.php",
  state: "a1b2c3d4e5",
  slot: "3f2a9c1e-77b0-4c1a-9e55-0d1f2a3b4c5d",
  title: "Example Stores",
};

function returnError(overrides: Partial<typeof valid>): string | undefined {
  const result = connectRequestSchema.safeParse({ ...valid, ...overrides });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("connectRequestSchema", () => {
  it("accepts what the plugin sends", () => {
    expect(connectRequestSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a WordPress installed in a subdirectory, over plain http", () => {
    expect(
      returnError({
        site: "http://localhost:9400/blog",
        return: "http://localhost:9400/blog/wp-admin/admin-post.php",
      }),
    ).toBeUndefined();
  });

  it("accepts the admin on www when the site is not, and the other way round", () => {
    expect(returnError({ return: "https://www.example.com/wp-admin/admin-post.php" })).toBeUndefined();
    expect(
      returnError({
        site: "https://www.example.com",
        return: "https://example.com/wp-admin/admin-post.php",
      }),
    ).toBeUndefined();
  });

  it("refuses to return to a different site from the one it names", () => {
    expect(returnError({ return: "https://evil.example/wp-admin/admin-post.php" })).toBe(
      "That link names one site and returns to another.",
    );
    // A suffix match would let any lookalike through.
    expect(returnError({ return: "https://notexample.com/wp-admin/admin-post.php" })).toBeDefined();
    expect(returnError({ return: "https://example.com.evil.example/wp-admin/admin-post.php" })).toBeDefined();
    // Only www is a sibling; any other subdomain may be somebody else's.
    expect(returnError({ return: "https://shop.example.com/wp-admin/admin-post.php" })).toBeDefined();
  });

  it("refuses a return address that is not admin-post.php", () => {
    expect(returnError({ return: "https://example.com/" })).toBeDefined();
    expect(returnError({ return: "https://example.com/wp-admin/admin-post.php/../x" })).toBeDefined();
    expect(returnError({ return: "https://example.com/wp-admin/options.php" })).toBeDefined();
  });

  it("refuses userinfo tricks, fragments and non-web schemes", () => {
    expect(returnError({ return: "https://example.com@evil.example/wp-admin/admin-post.php" })).toBeDefined();
    expect(returnError({ return: "https://user:pw@example.com/wp-admin/admin-post.php" })).toBeDefined();
    expect(returnError({ return: "https://example.com/wp-admin/admin-post.php#x" })).toBeDefined();
    expect(returnError({ return: "javascript:alert(1)//wp-admin/admin-post.php" })).toBeDefined();
    expect(returnError({ site: "ftp://example.com" })).toBeDefined();
  });

  it("refuses a malformed state or slot", () => {
    expect(returnError({ state: "" })).toBeDefined();
    expect(returnError({ state: "a b c d e f" })).toBeDefined();
    expect(returnError({ slot: "short" })).toBeDefined();
    expect(returnError({ slot: "x".repeat(65) })).toBeDefined();
  });

  it("drops an oversized title instead of refusing the whole link", () => {
    const parsed = connectRequestSchema.parse({ ...valid, title: "x".repeat(500) });
    expect(parsed.title).toBeUndefined();
  });
});

describe("sameSite", () => {
  it("is case-insensitive", () => {
    expect(sameSite("Example.com", "example.COM")).toBe(true);
  });
});

describe("connectMapSchema", () => {
  it("takes either an existing map or a named new one", () => {
    expect(connectMapSchema.safeParse({ site: valid.site, map: { id: "abc" } }).success).toBe(true);
    expect(
      connectMapSchema.safeParse({ site: valid.site, map: { create: true, name: "Stores" } }).success,
    ).toBe(true);
    expect(connectMapSchema.safeParse({ site: valid.site, map: { create: true, name: " " } }).success).toBe(false);
    expect(connectMapSchema.safeParse({ site: valid.site, map: {} }).success).toBe(false);
  });
});

describe("buildReturnUrl", () => {
  const map = {
    mapId: "map-1",
    name: "Stores & stockists",
    snapshotUrl: "https://cdn.pinglide.com/map-1/live.json",
    scriptUrl: "https://cdn.pinglide.com/embed/v1/map.js",
  };

  it("puts the answer on the plugin's admin-post.php", () => {
    const url = new URL(buildReturnUrl(valid.return, valid, map));

    expect(url.origin + url.pathname).toBe(valid.return);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      state: valid.state,
      slot: valid.slot,
      map: "map-1",
      name: "Stores & stockists",
      snapshot: map.snapshotUrl,
      script: map.scriptUrl,
      action: "pinglide_connect",
    });
  });

  it("keeps the return address's own query, but never its action", () => {
    const url = new URL(
      buildReturnUrl(
        "https://example.com/wp-admin/admin-post.php?lang=lt&action=something_else",
        valid,
        map,
      ),
    );

    expect(url.searchParams.get("lang")).toBe("lt");
    expect(url.searchParams.getAll("action")).toEqual(["pinglide_connect"]);
  });
});

describe("allowSite", () => {
  it("leaves an empty allowlist empty, because empty means everywhere", () => {
    expect(allowSite([], "example.com")).toEqual({ kind: "unchanged" });
  });

  it("does nothing when the site, or its parent domain, is already allowed", () => {
    expect(allowSite(["example.com"], "example.com")).toEqual({ kind: "unchanged" });
    expect(allowSite(["example.com"], "www.example.com")).toEqual({ kind: "unchanged" });
  });

  it("adds the site to a list that restricts the map elsewhere", () => {
    expect(allowSite(["other.com"], "example.com")).toEqual({
      kind: "added",
      domains: ["other.com", "example.com"],
    });
  });

  it("reports a full list rather than going over the limit", () => {
    const full = Array.from({ length: MAX_ALLOWED_DOMAINS }, (_, i) => `site${i}.com`);
    expect(allowSite(full, "example.com")).toEqual({ kind: "full" });
  });
});

describe("siteHost", () => {
  it("strips the scheme, port and path", () => {
    expect(siteHost("http://localhost:9400/blog")).toBe("localhost");
    expect(siteHost("https://WWW.Example.com/")).toBe("www.example.com");
  });
});
