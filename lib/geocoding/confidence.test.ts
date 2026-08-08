import { describe, expect, it } from "vitest";

import {
  HIGH_CONFIDENCE,
  confidenceFor,
  needsReview,
  statusFor,
} from "./confidence";
import type { GeocodeCandidate } from "./types";

const candidate = (confidence: number): GeocodeCandidate => ({
  lat: 54.687,
  lng: 25.28,
  label: "Somewhere",
  confidence,
});

describe("confidenceFor", () => {
  it("ranks a rooftop match above a street match above a city centroid", () => {
    const house = confidenceFor("house");
    const street = confidenceFor("street");
    const city = confidenceFor("city");

    expect(house).toBeGreaterThan(street);
    expect(street).toBeGreaterThan(city);
  });

  it("treats a house-level match as high confidence", () => {
    expect(confidenceFor("house")).toBeGreaterThanOrEqual(HIGH_CONFIDENCE);
  });

  it("treats a city centroid as needing review", () => {
    // This is the failure that matters: a city centroid is a real result that is
    // nowhere near the shop.
    expect(confidenceFor("city")).toBeLessThan(HIGH_CONFIDENCE);
  });

  it("promotes a street match that carries a house number", () => {
    const plain = confidenceFor("street");
    const numbered = confidenceFor("street", { hasHouseNumber: true });

    expect(numbered).toBeGreaterThan(plain);
    expect(numbered).toBeGreaterThanOrEqual(HIGH_CONFIDENCE);
  });

  it("never exceeds a house match when promoting", () => {
    expect(confidenceFor("house", { hasHouseNumber: true })).toBeLessThanOrEqual(
      confidenceFor("house"),
    );
  });

  it("does not trust an unknown precision", () => {
    expect(confidenceFor(undefined)).toBeLessThan(HIGH_CONFIDENCE);
    expect(confidenceFor("something-new")).toBeLessThan(HIGH_CONFIDENCE);
    expect(confidenceFor(null)).toBeLessThan(HIGH_CONFIDENCE);
  });

  it("stays within 0 and 1", () => {
    for (const precision of ["house", "street", "city", "country", "nonsense"]) {
      for (const hasHouseNumber of [true, false]) {
        const value = confidenceFor(precision, { hasHouseNumber });
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("statusFor", () => {
  it("reports no result as failed", () => {
    expect(statusFor(null)).toBe("failed");
    expect(statusFor(undefined)).toBe("failed");
  });

  it("reports a confident match as ok", () => {
    expect(statusFor(candidate(0.95))).toBe("ok");
    expect(statusFor(candidate(HIGH_CONFIDENCE))).toBe("ok");
  });

  it("reports a vague match as low", () => {
    expect(statusFor(candidate(HIGH_CONFIDENCE - 0.01))).toBe("low");
    expect(statusFor(candidate(0.4))).toBe("low");
  });

  it("never invents a manual status", () => {
    // "manual" means a person placed the pin. A geocoder result is never that,
    // or a later pass would refuse to correct its own bad guess.
    for (const confidence of [0, 0.5, 1]) {
      expect(statusFor(candidate(confidence))).not.toBe("manual");
    }
  });
});

describe("needsReview", () => {
  it("flags low and failed, and leaves ok and manual alone", () => {
    expect(needsReview("low")).toBe(true);
    expect(needsReview("failed")).toBe(true);
    expect(needsReview("ok")).toBe(false);
    expect(needsReview("manual")).toBe(false);
  });
});
