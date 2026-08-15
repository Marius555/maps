import { describe, expect, it } from "vitest";

import {
  PIN_ICONS,
  findPinIcon,
  pinSvg,
  resolvePin,
  type CustomPinIcon,
} from "./pin-icons";

const GLYPH_PIN: CustomPinIcon = {
  id: "ab12cd34",
  label: "Flagship",
  color: "#1c7ed6",
  glyph: "store",
  image: "",
};

const IMAGE_PIN: CustomPinIcon = {
  id: "ef56gh78",
  label: "Logo",
  color: "#0ca678",
  glyph: "",
  image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
};

/**
 * The registry's contract is mostly about what it does with input it doesn't
 * recognise, because that is the case a live customer map hits: an id written by
 * a newer version of the app, or typed into the Appwrite console, must draw a
 * plain pin rather than take the map down.
 */
describe("findPinIcon", () => {
  it("resolves an id in the registry", () => {
    const icon = findPinIcon("store");

    expect(icon?.id).toBe("store");
    expect(icon?.paths.length).toBeGreaterThan(0);
  });

  it("returns undefined for an id it does not know", () => {
    expect(findPinIcon("not-an-icon")).toBeUndefined();
    // The shape a future uploaded icon would take. Unknown today, and it must
    // degrade rather than throw.
    expect(findPinIcon("custom:abc123")).toBeUndefined();
  });

  it("treats empty, null and undefined as no icon", () => {
    expect(findPinIcon("")).toBeUndefined();
    expect(findPinIcon(null)).toBeUndefined();
    expect(findPinIcon(undefined)).toBeUndefined();
  });
});

describe("PIN_ICONS", () => {
  it("has unique ids", () => {
    const ids = PIN_ICONS.map((icon) => icon.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
   * Both renderers treat an icon as nothing but path data — the editor emits
   * <path> elements, the embed builds Path2D from the same strings. An entry
   * carrying a <circle> would silently render as a gap inside the pin.
   */
  it("draws every icon with path data alone", () => {
    for (const icon of PIN_ICONS) {
      expect(icon.paths.length).toBeGreaterThan(0);
      for (const path of icon.paths) expect(path).toMatch(/^[Mm]/);
    }
  });
});

/**
 * Every branch here is reachable from live data, which is why they are all
 * tested: a place keeps the id it was saved with long after the pin it named was
 * recoloured, given a different glyph, or deleted outright.
 */
describe("resolvePin", () => {
  it("resolves a built-in and leaves its colour to the category", () => {
    const pin = resolvePin("coffee");

    expect(pin?.paths.length).toBeGreaterThan(0);
    expect(pin?.image).toBe("");
    expect(pin?.color).toBeNull();
  });

  it("draws a custom glyph pin in its own colour", () => {
    const pin = resolvePin("custom:ab12cd34", [GLYPH_PIN]);

    expect(pin?.paths).toEqual(findPinIcon("store")?.paths);
    expect(pin?.color).toBe("#1c7ed6");
  });

  it("carries the image through for a custom image pin", () => {
    const pin = resolvePin("custom:ef56gh78", [IMAGE_PIN]);

    expect(pin?.image).toBe(IMAGE_PIN.image);
    expect(pin?.paths).toEqual([]);
    expect(pin?.color).toBe("#0ca678");
  });

  it("returns null for everything it cannot draw", () => {
    // Never saved, or saved by a newer version of the app.
    expect(resolvePin("not-an-icon")).toBeNull();
    // The pin was deleted; the places wearing it keep the id.
    expect(resolvePin("custom:ab12cd34")).toBeNull();
    expect(resolvePin("custom:gone", [GLYPH_PIN])).toBeNull();
    // Hand-edited: a record with neither a glyph nor an image.
    expect(resolvePin("custom:x", [{ ...GLYPH_PIN, id: "x", glyph: "" }])).toBeNull();
    expect(resolvePin("")).toBeNull();
    expect(resolvePin(null)).toBeNull();
    expect(resolvePin(undefined)).toBeNull();
  });

  /*
   * The key is what lets a marker skip rebuilding its SVG. If it did not move
   * with the colour, recolouring a pin in the studio would leave every marker
   * already on the map wearing the old one until a reload.
   */
  it("changes its key when the drawing changes", () => {
    const before = resolvePin("custom:ab12cd34", [GLYPH_PIN]);
    const recoloured = resolvePin("custom:ab12cd34", [
      { ...GLYPH_PIN, color: "#e8590c" },
    ]);
    const regylphed = resolvePin("custom:ab12cd34", [{ ...GLYPH_PIN, glyph: "bed" }]);

    expect(recoloured?.key).not.toBe(before?.key);
    expect(regylphed?.key).not.toBe(before?.key);
    // A rename is not a redraw.
    expect(resolvePin("custom:ab12cd34", [{ ...GLYPH_PIN, label: "Other" }])?.key).toBe(
      before?.key,
    );
  });
});

describe("pinSvg", () => {
  it("puts the glyph inside the ball when there is an icon", () => {
    const svg = pinSvg(resolvePin("coffee"));

    expect(svg).toContain("pin-svg__body");
    expect(svg).toContain("pin-svg__glyph");
    expect(svg).not.toContain("pin-svg__image");
  });

  it("puts an uploaded image inside the ball instead of a glyph", () => {
    const svg = pinSvg(resolvePin("custom:ef56gh78", [IMAGE_PIN]));

    expect(svg).toContain("pin-svg__body");
    expect(svg).toContain("pin-svg__image");
    expect(svg).toContain(IMAGE_PIN.image);
    expect(svg).not.toContain("pin-svg__glyph");
  });

  /**
   * The body is not conditional. Three kinds of pin, one shape, so a stylesheet
   * that paints `pin-svg__body` paints all of them and no renderer has a second
   * outline to keep in step.
   */
  it("draws a pin with no icon as the bare ball", () => {
    const svg = pinSvg();

    expect(svg).toContain("pin-svg__body");
    expect(svg).not.toContain("pin-svg__glyph");
    expect(svg).not.toContain("pin-svg__image");
  });
});
