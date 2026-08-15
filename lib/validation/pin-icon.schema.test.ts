import { describe, expect, it } from "vitest";

import {
  MAX_PIN_ICONS,
  MAX_PIN_IMAGE_BYTES,
  base64Bytes,
  pinIconSchema,
  pinIconsSchema,
} from "./pin-icon.schema";

/** A valid data URI carrying `bytes` bytes, so the cap can be tested either side. */
function image(bytes: number): string {
  return `data:image/png;base64,${"A".repeat(Math.ceil(bytes / 3) * 4)}`;
}

const GLYPH = { id: "ab12", label: "Flagship", color: "#1C7ED6", glyph: "store" };

describe("pinIconSchema", () => {
  it("accepts a glyph pin and lowercases its colour", () => {
    const parsed = pinIconSchema.parse(GLYPH);

    expect(parsed.color).toBe("#1c7ed6");
    expect(parsed.image).toBe("");
  });

  /*
   * The rule both renderers depend on: `pinSvg` and the embed's canvas each pick
   * a head to draw, and a pin that was somehow both would have them picking
   * differently.
   */
  it("rejects a pin that is neither an icon nor an image", () => {
    expect(pinIconSchema.safeParse({ ...GLYPH, glyph: "" }).success).toBe(false);
  });

  it("rejects a pin that is both", () => {
    expect(
      pinIconSchema.safeParse({ ...GLYPH, image: image(100) }).success,
    ).toBe(false);
  });

  /*
   * The image is inlined into every visitor's snapshot (§2 forbids fetching it),
   * so this cap is the only thing between one customer's logo and everyone's
   * download. It is enforced server-side because the client normaliser that
   * usually keeps images small is not the only way to reach this schema.
   */
  it("rejects an image over the size cap", () => {
    const ok = { ...GLYPH, glyph: "", image: image(MAX_PIN_IMAGE_BYTES - 64) };
    const tooBig = { ...GLYPH, glyph: "", image: image(MAX_PIN_IMAGE_BYTES + 64) };

    expect(pinIconSchema.safeParse(ok).success).toBe(true);
    expect(pinIconSchema.safeParse(tooBig).success).toBe(false);
  });

  /*
   * An SVG is a document that can run script. The client rasterises uploads
   * before they are ever sent, and this is what makes that a rule rather than a
   * convention — nothing but PNG and WebP can be stored.
   */
  it("rejects any format the client normaliser cannot produce", () => {
    for (const uri of [
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:image/png,notbase64",
      "data:text/html;base64,PGgxPmhpPC9oMT4=",
      "https://example.com/logo.png",
    ]) {
      expect(pinIconSchema.safeParse({ ...GLYPH, glyph: "", image: uri }).success).toBe(
        false,
      );
    }
  });
});

describe("pinIconsSchema", () => {
  const pins = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...GLYPH,
      id: `pin-${index}`,
      label: `Pin ${index}`,
    }));

  it("caps how many a map can have", () => {
    expect(pinIconsSchema.safeParse(pins(MAX_PIN_ICONS)).success).toBe(true);
    expect(pinIconsSchema.safeParse(pins(MAX_PIN_ICONS + 1)).success).toBe(false);
  });

  it("rejects duplicate ids and duplicate names", () => {
    const [first, second] = pins(2);

    expect(pinIconsSchema.safeParse([first, { ...second, id: first.id }]).success).toBe(
      false,
    );
    // Case-insensitively: two pins called "Depot" and "depot" are one pin as far
    // as anyone reading the library is concerned.
    expect(
      pinIconsSchema.safeParse([first, { ...second, label: first.label.toUpperCase() }])
        .success,
    ).toBe(false);
  });
});

describe("base64Bytes", () => {
  /*
   * Measured from the encoded length rather than by decoding, because this runs
   * on a payload that may be several hundred KB precisely when it is invalid —
   * decoding to find that out would be the attack.
   */
  it("counts decoded bytes without decoding, padding included", () => {
    expect(base64Bytes("data:image/png;base64,AAAA")).toBe(3);
    expect(base64Bytes("data:image/png;base64,AAA=")).toBe(2);
    expect(base64Bytes("data:image/png;base64,AA==")).toBe(1);
  });
});
