import { describe, expect, it } from "vitest";

import {
  PIN_ICONS,
  PIN_SAFE_RADIUS,
  PIN_SHAPES,
  extentOf,
  findPinIcon,
  glyphBoxFor,
  imageCircleFor,
  inradiusOf,
  pinCssVars,
  pinSvg,
  resolvePin,
  type CustomPinIcon,
  type PinShape,
} from "./pin-icons";

const SHAPES: PinShape[] = ["circle", "square", "diamond"];

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

  /*
   * Every design field has to move the key for the same reason the colour does,
   * and there are now five of them. One left out is a pin restyled in the studio
   * that never changes on the canvas.
   */
  it.each([
    ["ring", { ring: "#111827" }],
    ["ring width", { ringWidth: "thick" as const }],
    ["icon colour", { iconColor: "#111827" }],
    ["size", { size: "lg" as const }],
    ["shape", { shape: "square" as const }],
  ])("changes its key when the %s changes", (_name, over) => {
    const before = resolvePin("custom:ab12cd34", [GLYPH_PIN]);
    const after = resolvePin("custom:ab12cd34", [{ ...GLYPH_PIN, ...over }]);

    expect(after?.key).not.toBe(before?.key);
  });

  it("fingerprints an image into the key rather than carrying it", () => {
    const image = `data:image/png;base64,${"A".repeat(2000)}`;
    const pin = resolvePin("custom:x", [{ ...IMAGE_PIN, id: "x", image }]);

    expect(pin?.image).toBe(image);
    expect(pin?.key.length).toBeLessThan(120);
  });
});

/**
 * The design fields are all optional, and this is the guarantee that buys: pins
 * saved before they existed are sitting in Appwrite rows and inside published
 * snapshots that live customer sites are still reading. If this fails, every one
 * of those maps has silently changed shape.
 */
describe("resolvePin design defaults", () => {
  const PLAIN = { ring: null, ringWidth: 1.5, iconColor: null, scale: 1, shape: "circle" };

  it("draws a built-in exactly as it always has", () => {
    expect(resolvePin("store")).toMatchObject(PLAIN);
  });

  it("draws a custom pin that names no design exactly as it always has", () => {
    expect(resolvePin("custom:ab12cd34", [GLYPH_PIN])).toMatchObject(PLAIN);
  });

  it("takes the pin's own design when it has one", () => {
    const pin = resolvePin("custom:ab12cd34", [
      {
        ...GLYPH_PIN,
        ring: "#111827",
        ringWidth: "thick",
        iconColor: "#ffffff",
        size: "lg",
        shape: "diamond",
      },
    ]);

    expect(pin).toMatchObject({
      ring: "#111827",
      ringWidth: 2.5,
      iconColor: "#ffffff",
      scale: 1.25,
      shape: "diamond",
    });
  });

  /*
   * Off-contract values arrive from two real places: a row hand-edited in the
   * Appwrite console, and a map written by a newer version of the app. Both must
   * cost the styling, never the map — the same contract as `findPinIcon` above.
   */
  it("falls back to the defaults on values it doesn't recognise", () => {
    const pin = resolvePin("custom:ab12cd34", [
      {
        ...GLYPH_PIN,
        ringWidth: "chunky" as CustomPinIcon["ringWidth"],
        size: "enormous" as CustomPinIcon["size"],
        shape: "blob" as CustomPinIcon["shape"],
      },
    ]);

    expect(pin).toMatchObject({ ringWidth: 1.5, scale: 1, shape: "circle" });
  });
});

/*
 * The arithmetic behind PIN_SHAPES, asserted rather than trusted. A shape added
 * with a glyph box its own outline cannot hold clips the glyph on every map that
 * uses it — and would look merely "a bit tight" to whoever added it.
 */
describe("shape geometry", () => {
  /** Half the thickest ring, which strays outside the path it is drawn on. */
  const OVERHANG = 1.25;

  it.each(SHAPES)("keeps %s's glyph inside its own outline", (shape) => {
    const box = glyphBoxFor(shape);
    // The far corner of a centred square, which is the part that pokes through.
    const corner = (box.size / 2) * Math.SQRT2;

    expect(corner).toBeLessThan(inradiusOf(shape));
  });

  it.each(SHAPES)("keeps %s's image inside its own outline", (shape) => {
    expect(imageCircleFor(shape).r + OVERHANG).toBeLessThan(inradiusOf(shape));
  });

  // An `<svg>` clips to its viewBox, so a shape whose thickest ring reached past
  // the box would have that ring shaved flat — and only at "thick", which is the
  // setting least likely to be the one anyone tried.
  it.each(SHAPES)("keeps %s's thickest ring inside the viewBox", (shape) => {
    expect(extentOf(shape)).toBeLessThanOrEqual(PIN_SAFE_RADIUS);
  });
});

/*
 * A property left out is a property the stylesheet decides, which is what keeps
 * an unstyled ring theme-aware. Writing the default out instead would freeze a
 * light-theme white onto every pin ever made.
 */
describe("pinCssVars", () => {
  it("says nothing about a pin that names no design of its own", () => {
    expect(pinCssVars(resolvePin("custom:ab12cd34", [GLYPH_PIN]))).toEqual({
      "--pin-color": "#1c7ed6",
    });
  });

  it("names only what the pin actually chose", () => {
    const pin = resolvePin("custom:ab12cd34", [
      { ...GLYPH_PIN, ringWidth: "none", size: "sm" },
    ]);

    expect(pinCssVars(pin)).toEqual({
      "--pin-color": "#1c7ed6",
      "--pin-ring-width": "0",
      "--pin-scale": "0.8",
    });
  });

  it("ranks an override over the pin's own colour, and the pin's over a fallback", () => {
    const pin = resolvePin("custom:ab12cd34", [GLYPH_PIN]);

    expect(pinCssVars(pin, "#000000", "#ffffff")["--pin-color"]).toBe("#000000");
    expect(pinCssVars(pin, undefined, "#ffffff")["--pin-color"]).toBe("#1c7ed6");
    // A built-in has no colour of its own, so the fallback is what it takes.
    expect(pinCssVars(resolvePin("store"), undefined, "#ffffff")["--pin-color"]).toBe(
      "#ffffff",
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
   * The body is not conditional. Three kinds of pin, one element, so a stylesheet
   * that paints `pin-svg__body` paints all of them and no renderer has a second
   * outline to keep in step.
   */
  it("draws a pin with no icon as the bare ball", () => {
    const svg = pinSvg();

    expect(svg).toContain("pin-svg__body");
    expect(svg).not.toContain("pin-svg__glyph");
    expect(svg).not.toContain("pin-svg__image");
  });

  /*
   * Every shape included: the branch is in the path data, not the markup, which
   * is what lets one CSS rule reach all three and the embed hand the very same
   * string to `new Path2D(...)`.
   */
  it.each(SHAPES)("draws %s as the same one element", (shape) => {
    const svg = pinSvg(resolvePin("custom:ab12cd34", [{ ...GLYPH_PIN, shape }]));

    expect(svg).toContain(`<path class="pin-svg__body" d="${PIN_SHAPES[shape].path}"`);
  });
});
