import { describe, expect, it } from "vitest";

import { EMBED_STRINGS } from "@/packages/shared/embed-strings";

import {
  EMBED_LANGUAGES,
  resolveEmbedWords,
  wordingOverrides,
  wordingValues,
} from "./index";

describe("resolveEmbedWords", () => {
  it("publishes nothing for an untouched English map", () => {
    expect(resolveEmbedWords("en", {}, "Pinglide")).toEqual({
      badge: "Made with Pinglide",
    });
  });

  it("publishes the whole table and the tag for another language", () => {
    const words = resolveEmbedWords("lt", {}, "Pinglide");

    expect(words.lang).toBe("lt");
    expect(words.strings?.directions).toBe("Maršrutas");
    expect(words.badge).toBe("Sukurta su Pinglide");
  });

  it("lays the owner's words over the preset", () => {
    const words = resolveEmbedWords("de", { nearest: "Filiale finden" }, "Pinglide");

    expect(words.strings?.nearest).toBe("Filiale finden");
    expect(words.strings?.directions).toBe("Route");
  });

  it("drops an edit that says the English default, and a blank one", () => {
    const words = resolveEmbedWords(
      "en",
      { directions: EMBED_STRINGS.directions, nearest: "   " },
      "Pinglide",
    );

    expect(words.strings).toBeUndefined();
  });

  it("falls back to English for an unknown language", () => {
    expect(resolveEmbedWords("xx", {}, "Pinglide")).toEqual({
      badge: "Made with Pinglide",
    });
  });
});

describe("EMBED_LANGUAGES", () => {
  it.each(EMBED_LANGUAGES.map((language) => [language.id, language] as const))(
    "%s keeps both placeholders in the nearest sentence",
    (_, language) => {
      expect(language.strings.nearestFound).toContain("{place}");
      expect(language.strings.nearestFound).toContain("{distance}");
      expect(language.badge).toContain("{brand}");
    },
  );
});

describe("wording round trip", () => {
  it("stores only what the owner changed", () => {
    const values = wordingValues("fr", {});
    values.nearest = "Trouver une boutique";
    values.noMatch = "  ";

    expect(wordingOverrides("fr", values)).toEqual({ nearest: "Trouver une boutique" });
  });

  it("shows the owner's word over the language's", () => {
    expect(wordingValues("es", { directions: "Ir" }).directions).toBe("Ir");
    expect(wordingValues("es", {}).directions).toBe("Cómo llegar");
  });
});
