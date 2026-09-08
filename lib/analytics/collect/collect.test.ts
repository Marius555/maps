import { describe, expect, it } from "vitest";

import { isBot } from "./bots";
import { countryCentroid } from "./country-centroids";
import { deviceOf } from "./device";
import { readVisitorGeo } from "./geo-headers";
import { maskIp } from "./mask-ip";

/**
 * The four small decisions the collector makes about a request before it writes
 * anything. All four are pure functions of headers, which is why they are here
 * and not behind a running Appwrite.
 */

describe("isBot", () => {
  it("passes a real browser", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("catches the crawlers that execute scripts", () => {
    // The ones that reach a beacon at all are the previewers and the auditors.
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 Chrome-Lighthouse",
      "HeadlessChrome/140.0.0.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Better Uptime Bot",
    ]) {
      expect(isBot(ua), ua).toBe(true);
    }
  });

  it("treats a missing user agent as a machine", () => {
    // Every browser sends one, and `sendBeacon` cannot suppress it.
    expect(isBot(null)).toBe(true);
    expect(isBot("")).toBe(true);
  });
});

describe("deviceOf", () => {
  it("reads an iPhone as a phone", () => {
    expect(
      deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148"),
    ).toBe("mobile");
  });

  it("reads an iPad as a tablet", () => {
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148")).toBe(
      "tablet",
    );
  });

  it("separates an Android tablet from an Android phone", () => {
    // Every Android tablet also says "Android"; only the phone says "Mobile".
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-X200) Chrome/140.0")).toBe(
      "tablet",
    );
    expect(
      deviceOf("Mozilla/5.0 (Linux; Android 14; Pixel 9) Mobile Safari/537.36"),
    ).toBe("mobile");
  });

  it("falls back to desktop when it cannot tell", () => {
    expect(deviceOf(null)).toBe("desktop");
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0")).toBe(
      "desktop",
    );
  });
});

describe("maskIp", () => {
  it("drops the last octet of an IPv4 address", () => {
    expect(maskIp("81.7.144.23")).toBe("81.7.144.•");
  });

  it("keeps only the routing prefix of an IPv6 address", () => {
    expect(maskIp("2a02:8109:8f00:2c00:1d4b:9e2f:aa11:2233")).toBe(
      "2a02:8109:8f00:2c00:••",
    );
  });

  it("says nothing rather than something wrong", () => {
    expect(maskIp(null)).toBe("—");
    expect(maskIp("not an address")).toBe("—");
  });
});

describe("readVisitorGeo", () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it("reads Vercel's four", () => {
    const geo = readVisitorGeo(
      headers({
        "x-vercel-ip-country": "lt",
        "x-vercel-ip-city": "Vilnius",
        "x-vercel-ip-latitude": "54.6872",
        "x-vercel-ip-longitude": "25.2797",
        "x-forwarded-for": "81.7.144.23, 10.0.0.1",
      }),
    );

    expect(geo).toEqual({
      country: "LT",
      city: "Vilnius",
      lat: 54.6872,
      lng: 25.2797,
      ip: "81.7.144.23",
    });
  });

  it("decodes a percent-encoded city name", () => {
    const geo = readVisitorGeo(
      headers({ "x-vercel-ip-country": "DE", "x-vercel-ip-city": "K%C3%B6ln" }),
    );

    expect(geo.city).toBe("Köln");
  });

  it("reads Cloudflare's country when Vercel's headers are absent", () => {
    const geo = readVisitorGeo(
      headers({ "cf-ipcountry": "GB", "x-real-ip": "203.0.113.9" }),
    );

    expect(geo.country).toBe("GB");
    expect(geo.ip).toBe("203.0.113.9");
    // Coordinates are Enterprise-only, so the common case is a country alone.
    expect(geo.lat).toBeNull();
  });

  it("refuses Cloudflare's non-countries", () => {
    // XX is "could not place it" and T1 is Tor. Neither belongs on a map.
    for (const code of ["XX", "T1"]) {
      expect(readVisitorGeo(headers({ "cf-ipcountry": code })).country).toBeNull();
    }
  });

  it("takes the address and nothing else when the host sets no geo header", () => {
    // Appwrite Sites as documented today: an IP, and no geography at all.
    const geo = readVisitorGeo(headers({ "x-appwrite-client-ip": "198.51.100.4" }));

    expect(geo).toEqual({
      country: null,
      city: null,
      lat: null,
      lng: null,
      ip: "198.51.100.4",
    });
  });

  it("takes the first hop of x-forwarded-for and no other", () => {
    // The rest are proxies, and a trailing entry is trivially spoofed.
    const geo = readVisitorGeo(
      headers({ "x-forwarded-for": "198.51.100.4,10.0.0.1,10.0.0.2" }),
    );

    expect(geo.ip).toBe("198.51.100.4");
  });

  it("prefers Appwrite's own header over a client-settable one", () => {
    const geo = readVisitorGeo(
      headers({
        "x-appwrite-client-ip": "198.51.100.4",
        "x-forwarded-for": "1.1.1.1",
      }),
    );

    expect(geo.ip).toBe("198.51.100.4");
  });

  it("drops a coordinate outside the world", () => {
    const geo = readVisitorGeo(
      headers({
        "x-vercel-ip-country": "US",
        "x-vercel-ip-latitude": "999",
        "x-vercel-ip-longitude": "abc",
      }),
    );

    expect(geo.lat).toBeNull();
    expect(geo.lng).toBeNull();
  });
});

describe("countryCentroid", () => {
  it("places a country inside itself", () => {
    const [lng, lat] = countryCentroid("LT") ?? [0, 0];

    expect(lng).toBeGreaterThan(20);
    expect(lng).toBeLessThan(27);
    expect(lat).toBeGreaterThan(53);
    expect(lat).toBeLessThan(57);
  });

  it("does not care how the code is written", () => {
    expect(countryCentroid("de")).toEqual(countryCentroid("DE"));
    expect(countryCentroid(" fr ")).toEqual(countryCentroid("FR"));
  });

  it("answers null for a code it does not hold", () => {
    // The session is then simply not on the origin map, and is everywhere else.
    expect(countryCentroid("ZZ")).toBeNull();
    expect(countryCentroid(null)).toBeNull();
  });

  it("holds every coordinate inside the world", () => {
    for (const code of ["US", "AU", "BR", "JP", "ZA", "RU", "NZ", "IS"]) {
      const point = countryCentroid(code);

      expect(point, code).not.toBeNull();
      expect(Math.abs(point?.[0] ?? 999), code).toBeLessThanOrEqual(180);
      expect(Math.abs(point?.[1] ?? 999), code).toBeLessThanOrEqual(90);
    }
  });
});
