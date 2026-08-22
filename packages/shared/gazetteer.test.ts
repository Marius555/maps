import { describe, expect, it } from "vitest";

import {
  fold,
  matchCodes,
  matchNames,
  postKey,
  shardOf,
  type GazetteerEntry,
} from "./gazetteer";

/**
 * Shaped like the build script's real output, including the two-key entries.
 *
 * GeoNames' `asciiname` transliterates — Köln is "koeln" — and the second key is
 * a plain diacritic strip of the display name. Both spellings are here because
 * the pair is the thing worth testing.
 */
const CITIES: GazetteerEntry[] = [
  ["london", "London", 51.50853, -0.12574],
  ["manchester", "Manchester", 53.48095, -2.23743],
  ["manningtree", "Manningtree", 51.945, 1.06667],
  ["koeln|koln", "Köln", 50.93333, 6.95],
  ["new york", "New York", 40.71427, -74.00597],
];

const CODES: GazetteerEntry[] = [
  ["SW1", "Pimlico", 51.489, -0.137],
  ["SW1A", "Westminster", 51.5002, -0.1262],
  ["SW11", "Battersea", 51.4747, -0.1555],
  ["SE1", "Southwark", 51.5035, -0.09],
];

describe("fold", () => {
  it("strips accents and case, so an umlaut is optional", () => {
    // The pairing with the build script's `plainKey`. Nothing but a test
    // connects the two, and when they drift search silently finds nothing —
    // which is why this is the one worth pinning.
    expect(fold("Köln")).toBe("koln");
    expect(fold("Koln")).toBe("koln");
    expect(fold("Šiauliai")).toBe("siauliai");
    expect(fold("Klaipėda")).toBe("klaipeda");
    expect(fold("  Marseille  ")).toBe("marseille");
  });
});

describe("postKey and shardOf", () => {
  it("keys a postcode however the visitor punctuated it", () => {
    expect(postKey("SW1A 1AA")).toBe("SW1A1AA");
    expect(postKey("sw1a1aa")).toBe("SW1A1AA");
    expect(postKey("SW1A-1AA")).toBe("SW1A1AA");
  });

  it("names the shard the build script wrote", () => {
    // This function decides a filename, so a change here asks for files that do
    // not exist rather than failing loudly.
    expect(shardOf("SW1A1AA")).toBe("SW");
    expect(shardOf("01001")).toBe("01");
    expect(shardOf("A")).toBe("A_");
  });
});

describe("matchNames", () => {
  it("finds a city by the start of its name", () => {
    expect(matchNames(CITIES, "lond").map((h) => h.label)).toEqual(["London"]);
  });

  it("ranks a whole-name match above a word inside one", () => {
    // "york" should reach New York, but never above somewhere actually called
    // York — and here there is no such place, so New York is all that is left.
    expect(matchNames(CITIES, "york").map((h) => h.label)).toEqual(["New York"]);
  });

  it("keeps the file's own order within a tier", () => {
    // The build script sorted by population, so ranking is inherited rather
    // than recomputed: Manchester must come before Manningtree.
    expect(matchNames(CITIES, "man").map((h) => h.label)).toEqual([
      "Manchester",
      "Manningtree",
    ]);
  });

  it("matches either spelling of a transliterated name", () => {
    // The whole reason entries carry two keys.
    for (const query of ["Köln", "Koln", "koeln"]) {
      expect(matchNames(CITIES, fold(query)).map((h) => h.label)).toEqual(["Köln"]);
    }
  });

  it("carries the coordinates through", () => {
    expect(matchNames(CITIES, "lond")[0]).toEqual({
      label: "London",
      lat: 51.50853,
      lng: -0.12574,
    });
  });

  it("finds nothing rather than everything for an unknown name", () => {
    expect(matchNames(CITIES, "zzz")).toEqual([]);
  });
});

describe("matchCodes", () => {
  it("prefix-matches, because a partial code is the normal case", () => {
    expect(matchCodes(CODES, "SW1").map((h) => h.label)).toEqual([
      "SW1 — Pimlico",
      "SW1A — Westminster",
      "SW11 — Battersea",
    ]);
  });

  it("narrows as the visitor types", () => {
    expect(matchCodes(CODES, "SW1A").map((h) => h.label)).toEqual([
      "SW1A — Westminster",
    ]);
  });

  it("does not match a different district", () => {
    expect(matchCodes(CODES, "SE1").map((h) => h.label)).toEqual(["SE1 — Southwark"]);
  });

  it("shows a bare code when there is no place name for it", () => {
    expect(matchCodes([["EC1", "", 51.52, -0.1]], "EC")[0].label).toBe("EC1");
  });
});
