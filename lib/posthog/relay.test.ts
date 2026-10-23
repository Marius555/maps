import { describe, expect, it } from "vitest";

import { relayRequestHeaders, relayResponseHeaders, relayTarget } from "./relay";

const HOST = "https://eu.i.posthog.com";

describe("relayTarget", () => {
  it("sends API calls to the host, keeping the trailing slash and query", () => {
    expect(relayTarget("/rp/i/v0/e/", "?retry_count=1", HOST)).toBe("https://eu.i.posthog.com/i/v0/e/?retry_count=1");
    expect(relayTarget("/rp/flags/", "", `${HOST}/`)).toBe("https://eu.i.posthog.com/flags/");
  });

  it("sends scripts and remote config to the assets twin", () => {
    expect(relayTarget("/rp/static/1.436.1/surveys.js", "", HOST)).toBe(
      "https://eu-assets.i.posthog.com/static/1.436.1/surveys.js",
    );
    expect(relayTarget("/rp/array/phc_x/config.js", "", HOST)).toBe("https://eu-assets.i.posthog.com/array/phc_x/config.js");
  });

  it("refuses anything outside the relay path", () => {
    expect(relayTarget("/rpx/flags/", "", HOST)).toBeNull();
    expect(relayTarget("/rp", "", HOST)).toBeNull();
    expect(relayTarget("/rp/../api/admin", "", HOST)).toBeNull();
  });
});

describe("relayRequestHeaders", () => {
  const incoming = new Headers({
    // What Appwrite Sites adds to every request, and what a signed-in visitor sends.
    authorization: "Basic b3ByOnNlY3JldA==",
    cookie: "a_session_x=secret",
    host: "pinglide.com",
    "x-appwrite-client-ip": "203.0.113.7",
    "x-forwarded-host": "pinglide.com",
    "content-type": "text/plain",
    "user-agent": "Mozilla/5.0",
  });
  const out = relayRequestHeaders(incoming);

  it("never forwards credentials, the host or Appwrite's own headers", () => {
    expect(out.get("authorization")).toBeNull();
    expect(out.get("cookie")).toBeNull();
    expect(out.get("host")).toBeNull();
    expect(out.get("x-appwrite-client-ip")).toBeNull();
    expect(out.get("x-forwarded-host")).toBeNull();
  });

  it("forwards what PostHog reads, and the visitor's address for GeoIP", () => {
    expect(out.get("content-type")).toBe("text/plain");
    expect(out.get("user-agent")).toBe("Mozilla/5.0");
    expect(out.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("sends no address when there is none", () => {
    expect(relayRequestHeaders(new Headers()).get("x-forwarded-for")).toBeNull();
  });
});

describe("relayResponseHeaders", () => {
  it("drops cookies and the encoding fetch has already undone", () => {
    const out = relayResponseHeaders(
      new Headers({
        "content-type": "application/javascript",
        "cache-control": "public, max-age=3600",
        "content-encoding": "gzip",
        "content-length": "123",
        "set-cookie": "x=y",
      }),
    );
    expect(out.get("content-type")).toBe("application/javascript");
    expect(out.get("cache-control")).toBe("public, max-age=3600");
    expect(out.get("content-encoding")).toBeNull();
    expect(out.get("content-length")).toBeNull();
    expect(out.get("set-cookie")).toBeNull();
  });
});
