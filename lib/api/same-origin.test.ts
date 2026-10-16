import { describe, expect, it } from "vitest";

import { assertSameOrigin, CrossSiteRequestError } from "./same-origin";

const APP = "https://pinglide.com";

function req(method: string, headers: Record<string, string>, url = `${APP}/api/auth/login`) {
  return new Request(url, { method, headers });
}

describe("assertSameOrigin", () => {
  it("lets every read through, whoever sent it", () => {
    expect(() => assertSameOrigin(req("GET", { "sec-fetch-site": "cross-site" }), APP)).not.toThrow();
    expect(() => assertSameOrigin(req("HEAD", { origin: "https://evil.com" }), APP)).not.toThrow();
  });

  it("refuses a write the browser marks cross-site", () => {
    expect(() =>
      assertSameOrigin(req("POST", { "sec-fetch-site": "cross-site", origin: "https://evil.com" }), APP),
    ).toThrow(CrossSiteRequestError);
  });

  it.each(["same-origin", "same-site", "none"])("allows a write marked %s", (site) => {
    expect(() => assertSameOrigin(req("POST", { "sec-fetch-site": site }), APP)).not.toThrow();
  });

  it("trusts Sec-Fetch-Site over a Host the proxy rewrote", () => {
    const request = req(
      "POST",
      { "sec-fetch-site": "same-origin", origin: APP, host: "internal:3000" },
      "http://internal:3000/api/auth/login",
    );
    expect(() => assertSameOrigin(request, APP)).not.toThrow();
  });

  it("lets a request with no browser headers through (cron, webhooks, curl)", () => {
    expect(() => assertSameOrigin(req("POST", {}), APP)).not.toThrow();
  });

  describe("Origin fallback, for browsers without Sec-Fetch-Site", () => {
    it("allows this site's own origin by Host, forwarded host or APP_URL", () => {
      expect(() => assertSameOrigin(req("POST", { origin: APP }), APP)).not.toThrow();
      expect(() =>
        assertSameOrigin(
          req("POST", { origin: "https://maps-5sbu.appwrite.network", "x-forwarded-host": "maps-5sbu.appwrite.network" }, "http://internal/x"),
          APP,
        ),
      ).not.toThrow();
      expect(() =>
        assertSameOrigin(req("POST", { origin: APP }, "http://internal/x"), APP),
      ).not.toThrow();
    });

    it("refuses another site's origin", () => {
      expect(() => assertSameOrigin(req("PATCH", { origin: "https://evil.com" }), APP)).toThrow(
        CrossSiteRequestError,
      );
      expect(() => assertSameOrigin(req("POST", { origin: "null" }), APP)).toThrow(CrossSiteRequestError);
    });
  });
});
