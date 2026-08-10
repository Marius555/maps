import { describe, expect, it } from "vitest";

import { GeocoderError, formatLabel, formatTitle, isRetryable, isTimeout } from "./photon";

/**
 * Photon returns address *parts*, not a formatted line, so the joining rules are
 * the whole of this adapter's behaviour — and they are what decides whether a
 * dropped pin ends up called "Gedimino pr. 9, Vilnius" or something useless.
 */

describe("formatLabel", () => {
  it("joins the full address, house number against the street", () => {
    expect(
      formatLabel({
        street: "Gedimino pr.",
        housenumber: "9",
        postcode: "01103",
        city: "Vilnius",
        country: "Lithuania",
      }),
    ).toBe("Gedimino pr. 9, 01103, Vilnius, Lithuania");
  });

  it("keeps a venue name but not a name that repeats the street", () => {
    expect(
      formatLabel({ name: "Corner Shop", street: "Main St", housenumber: "4", city: "Kaunas" }),
    ).toBe("Corner Shop, Main St 4, Kaunas");

    expect(formatLabel({ name: "Main St 4", street: "Main St", housenumber: "4" })).toBe(
      "Main St 4",
    );
  });

  it("falls back to the district when there is no city", () => {
    expect(formatLabel({ street: "Main St", district: "Žvėrynas" })).toBe(
      "Main St, Žvėrynas",
    );
  });
});

describe("formatTitle", () => {
  it("is the street and the town, without postcode or country", () => {
    expect(
      formatTitle({
        street: "Gedimino pr.",
        housenumber: "9",
        postcode: "01103",
        city: "Vilnius",
        country: "Lithuania",
      }),
    ).toBe("Gedimino pr. 9, Vilnius");
  });

  it("leads with the street even when the match has a name of its own", () => {
    /*
     * A pin on the Vytautas Kasiulis Museum of Art used to be titled with the
     * museum and no street. Memorable, but this is the line that says where the
     * place is — the name moves to the row's second line, beside the postcode.
     */
    expect(
      formatTitle({ name: "Corner Shop", street: "Main St", housenumber: "4", city: "Kaunas" }),
    ).toBe("Main St 4, Kaunas");

    expect(
      formatTitle({
        name: "Vytautas Kasiulis Museum of Art",
        street: "A. Goštauto g.",
        housenumber: "1",
        city: "Vilnius",
      }),
    ).toBe("A. Goštauto g. 1, Vilnius");
  });

  it("still leads with the name when there is no street to lead with", () => {
    // A park or a bridge has no address, and its name is the most locating thing
    // available — dropping it would leave the row saying only "Vilnius".
    expect(formatTitle({ name: "Vingis Park", city: "Vilnius" })).toBe(
      "Vingis Park, Vilnius",
    );
  });

  it("copes with a street and no house number", () => {
    expect(formatTitle({ street: "Main St", city: "Kaunas" })).toBe("Main St, Kaunas");
  });

  it("falls back through district and state before giving up", () => {
    expect(formatTitle({ street: "Main St", district: "Žvėrynas" })).toBe(
      "Main St, Žvėrynas",
    );
    expect(formatTitle({ street: "Main St", state: "Vilnius County" })).toBe(
      "Main St, Vilnius County",
    );
  });

  it("returns the full label rather than an empty string", () => {
    // Open water: a reverse lookup can come back with a country and nothing else.
    expect(formatTitle({ country: "Lithuania" })).toBe("Lithuania");
    expect(formatTitle({})).toBe("");
  });
});

/**
 * Which upstream failures get a second attempt, and which are reported as they
 * are. This is what decides whether a dropped pin quietly recovers from one of
 * the public instance's intermittent 502s or comes back with no address at all.
 */
describe("isRetryable", () => {
  const timeout = () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    return error;
  };

  it("retries a gateway error the service returned about itself", () => {
    expect(isRetryable(new GeocoderError("Photon returned 502", 502))).toBe(true);
    expect(isRetryable(new GeocoderError("Photon returned 503", 503))).toBe(true);
  });

  it("retries a request that never reached the service", () => {
    // DNS failure, refused connection, TLS error — no status, so nothing was answered.
    expect(
      isRetryable(
        new GeocoderError("Could not reach the geocoder", undefined, new TypeError("fetch failed")),
      ),
    ).toBe(true);
  });

  it("does not retry a client error", () => {
    // A blocked client and a malformed query both fail identically twice.
    expect(isRetryable(new GeocoderError("Photon returned 403", 403))).toBe(false);
    expect(isRetryable(new GeocoderError("Photon returned 400", 400))).toBe(false);
  });

  it("never retries a rate limit", () => {
    // The one case where trying again is guaranteed to make things worse.
    expect(isRetryable(new GeocoderError("Photon returned 429", 429))).toBe(false);
  });

  it("does not retry our own timeout", () => {
    // We already waited the full budget; a second wait doubles it for nothing.
    expect(
      isRetryable(new GeocoderError("Could not reach the geocoder", undefined, timeout())),
    ).toBe(false);
  });

  it("ignores errors that did not come from the geocoder", () => {
    expect(isRetryable(new Error("something else"))).toBe(false);
  });
});

describe("isTimeout", () => {
  it("recognises the abort however the runtime wrapped it", () => {
    const bare = new Error("aborted");
    bare.name = "TimeoutError";

    expect(isTimeout(bare)).toBe(true);
    // undici surfaces the same abort as a TypeError carrying it as the cause,
    // which used to miss the 504 branch and be reported as a 500.
    expect(isTimeout(new GeocoderError("Could not reach the geocoder", undefined, bare))).toBe(
      true,
    );
  });

  it("is false for a service that answered, however badly", () => {
    expect(isTimeout(new GeocoderError("Photon returned 502", 502))).toBe(false);
    expect(isTimeout(null)).toBe(false);
  });
});
