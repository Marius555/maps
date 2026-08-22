import { describe, expect, it } from "vitest";

import { gazetteerBase, gazetteerCountries } from "./config";

const at = (countryCode?: string) => ({
  addressParts: countryCode ? { countryCode } : null,
});

describe("gazetteerBase", () => {
  it("falls back to the app's own origin, so development needs no config", () => {
    expect(gazetteerBase("http://localhost:3000")).toBe(
      "http://localhost:3000/gazetteer",
    );
  });

  it("is always absolute — the embed runs on someone else's domain", () => {
    // A relative path would resolve against the customer's site and 404 there
    // while working perfectly on ours.
    expect(gazetteerBase("https://maps.example.com")).toMatch(/^https?:\/\//);
  });
});

describe("gazetteerCountries", () => {
  it("collects the distinct countries the locations are in", () => {
    expect(
      gazetteerCountries([at("GB"), at("GB"), at("DE"), at("GB")]),
    ).toEqual(["DE", "GB"]);
  });

  it("sorts, so republishing an unchanged map writes an unchanged file", () => {
    expect(gazetteerCountries([at("SE"), at("DE"), at("GB")])).toEqual([
      "DE",
      "GB",
      "SE",
    ]);
  });

  it("uppercases and trims what the geocoder gave us", () => {
    expect(gazetteerCountries([at("gb"), at(" de ")])).toEqual(["DE", "GB"]);
  });

  it("ignores anything that is not a two-letter code", () => {
    // A code naming no shard is a 404 on every keystroke, so it is dropped here
    // rather than published for the embed to trip over.
    expect(gazetteerCountries([at("GBR"), at("x"), at(""), at()])).toEqual([]);
  });

  it("says nothing for pins that were dropped by hand", () => {
    // No reverse geocode means no `addressParts`, and we genuinely do not know
    // what country those pins are in. Guessing would need the very table this
    // is trying to name.
    expect(gazetteerCountries([at(), at()])).toEqual([]);
  });
});
