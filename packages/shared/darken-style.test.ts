import { describe, expect, it } from "vitest";

import { lightnessOf, parseColor } from "./color";
import { darkenStyle } from "./darken-style";

/**
 * These are the claims that justify inverting Liberty instead of shipping
 * OpenFreeMap's own `dark` style, so they are asserted rather than described.
 *
 * The numbers they check against are the ones that made the stock style
 * unreadable: labels all at one grey around 3.4:1, street names near 2.4:1, and
 * water labels drawn black at 70% opacity on near-black.
 *
 * The inputs are real Liberty colours, quoted from its style JSON, so a change
 * that looks fine on invented greys still has to face the actual basemap.
 */

/** Runs a whole paint object through the real transform. */
function paintOf(
  paint: Record<string, unknown>,
  type = "line",
): Record<string, unknown> {
  const style = darkenStyle({ layers: [{ id: "l", type, paint }] });

  return style.layers[0].paint ?? {};
}

/** Runs one paint property through the real transform and reads the result. */
function paint(property: string, value: unknown, type = "line"): unknown {
  return paintOf({ [property]: value }, type)[property];
}

/** Perceptual lightness of a transformed colour string. 0 black, 1 white. */
function lightness(color: unknown): number {
  const parsed = parseColor(String(color));
  if (!parsed) throw new Error(`not a colour: ${String(color)}`);

  return lightnessOf(parsed);
}

/** Liberty's land colour, and so the ground everything else is read against. */
const LAND = lightness(paint("background-color", "#f8f4f0", "background"));

describe("text", () => {
  /**
   * The whole reason for inverting a good style rather than picking a dark one.
   * Liberty spells its hierarchy in greys — cities #000, districts and states
   * #333, streets and POIs #666 — and that ordering has to survive, or districts
   * and street names end up the same colour, which is exactly the complaint.
   */
  it("keeps a label hierarchy in the same order", () => {
    const city = lightness(paint("text-color", "#000", "symbol"));
    const district = lightness(paint("text-color", "#333", "symbol"));
    const street = lightness(paint("text-color", "#666", "symbol"));

    expect(city).toBeGreaterThan(district);
    expect(district).toBeGreaterThan(street);
  });

  it("lifts every label to the bright band, whatever it started at", () => {
    for (const input of ["#000", "#333", "#666", "#999999", "#cccccc"]) {
      expect(lightness(paint("text-color", input, "symbol"))).toBeGreaterThanOrEqual(
        0.78,
      );
    }
  });

  /**
   * The bug this band was widened for. A street name is `#666` and the minor road
   * it is drawn along is `#fff`, so the two transforms have to pull apart, not
   * together — at the old floor of 0.66 the label landed at 0.83 and the road at
   * 0.67, which is a light grey on a light grey and unreadable at street-label
   * size.
   */
  it("keeps a street name clear of the road it is drawn on", () => {
    const name = lightness(paint("text-color", "#666", "symbol"));
    const road = lightness(paint("line-color", "#fff"));

    expect(name - road).toBeGreaterThan(0.15);
  });

  /**
   * The stock dark style's water labels are `hsla(0, 0%, 0%, 0.7)` — black, and
   * see-through, on near-black. Lightness alone would not have saved them.
   */
  it("makes see-through labels opaque enough to read", () => {
    const result = String(paint("text-color", "hsla(0, 0%, 0%, 0.7)", "symbol"));

    expect(parseColor(result)?.a).toBeGreaterThanOrEqual(0.9);
    expect(lightness(result)).toBeGreaterThanOrEqual(0.68);
  });

  it("replaces label halos with one dark halo", () => {
    // A white halo behind a now-white label is a smear.
    expect(paint("text-halo-color", "#ffffff", "symbol")).toBe("rgba(8, 8, 10, 0.85)");
    expect(paint("icon-halo-color", "#ffffff", "symbol")).toBe("rgba(8, 8, 10, 0.85)");
  });

  /**
   * Liberty's `highway-name-minor` and `highway-name-major` ask for a halo width
   * and never name a colour, because on a light map a dark name on a white road
   * does not need one. Inverting reverses that, and only the colour is missing.
   */
  it("gives a label with no halo colour of its own a dark one", () => {
    const result = paintOf(
      { "text-color": "#666", "text-halo-width": 1 },
      "symbol",
    );

    expect(result["text-halo-color"]).toBe("rgba(8, 8, 10, 0.85)");
    // The style's own width is left alone — it knew what it wanted.
    expect(result["text-halo-width"]).toBe(1);
  });

  it("supplies a halo width only when the style left one out", () => {
    // A colour with no width would paint nothing: MapLibre's default width is 0.
    expect(paintOf({ "text-color": "#666" }, "symbol")["text-halo-width"]).toBe(1);

    expect(
      paintOf({ "text-color": "#666", "text-halo-width": 2.5 }, "symbol")[
        "text-halo-width"
      ],
    ).toBe(2.5);
  });

  it("leaves a layer that has no label text alone", () => {
    const result = paintOf({ "icon-color": "#666" }, "symbol");

    expect(result["text-halo-color"]).toBeUndefined();
    expect(result["text-halo-width"]).toBeUndefined();
  });
});

describe("ground", () => {
  it("pushes land, water and buildings down into the dark band", () => {
    for (const input of ["#f8f4f0", "rgb(158,189,255)", "hsl(35,8%,85%)"]) {
      expect(lightness(paint("fill-color", input))).toBeLessThanOrEqual(0.4);
    }
  });

  /**
   * The failure that made the first attempt unusable. Every fill in Liberty sits
   * in the top 17% of the lightness scale, so a straight inversion mapped land,
   * buildings, parks and water onto four indistinguishable near-blacks — a black
   * rectangle with labels floating on it.
   */
  it("keeps features apart even though they start within 0.17 of each other", () => {
    const land = lightness(paint("fill-color", "#f8f4f0"));
    const building = lightness(paint("fill-color", "hsl(35,8%,85%)"));
    const water = lightness(paint("fill-color", "rgb(158,189,255)"));

    for (const feature of [building, water]) {
      expect(Math.abs(feature - land)).toBeGreaterThan(0.03);
    }

    // And none of them may collapse to black, which is what a 0.08 floor did.
    expect(land).toBeGreaterThan(0.15);
  });

  it("keeps hue, so water stays blue", () => {
    const water = parseColor(String(paint("fill-color", "rgb(158,189,255)")));

    expect(water).not.toBeNull();
    // Still the bluest channel, just far darker.
    expect(water!.b).toBeGreaterThan(water!.r);
  });

  /**
   * A building outline belongs to the polygon, not to the road network. Lifted
   * into the figure band it turns every block into a bright box.
   */
  it("treats polygon outlines as ground, not as lines", () => {
    const outline = lightness(paint("fill-outline-color", "hsla(35,6%,79%,0.32)"));

    expect(outline).toBeLessThanOrEqual(0.4);
  });

  /** Shaded relief is a bright raster that swamps a dark map at full strength. */
  it("dims raster layers instead of recolouring them", () => {
    const style = darkenStyle({
      layers: [{ id: "hillshade", type: "raster", paint: { "raster-opacity": 1 } }],
    });

    expect(style.layers[0].paint?.["raster-opacity"]).toBeLessThan(0.2);
  });
});

describe("figure", () => {
  /**
   * Roads are the *lightest* thing on a light basemap — Liberty draws minor
   * streets pure white — and they have to stay the lightest thing on a dark one.
   * Inverting them, as the first attempt did, turned the whole road network into
   * dark ribbons a shade off the land they cross.
   */
  it("leaves roads brighter than the land they cross", () => {
    const minor = lightness(paint("line-color", "#fff"));
    const primary = lightness(paint("line-color", "#fea"));

    expect(minor).toBeGreaterThan(LAND + 0.3);
    expect(primary).toBeGreaterThan(LAND + 0.3);
  });

  /** A casing is the road's outline. Brighter than its road and it reads inside out. */
  it("keeps road casings darker than their roads", () => {
    expect(lightness(paint("line-color", "#fff"))).toBeGreaterThan(
      lightness(paint("line-color", "#cfcdca")),
    );
  });

  it("keeps boundaries dimmer than roads", () => {
    expect(lightness(paint("line-color", "hsl(248,1%,41%)"))).toBeLessThan(
      lightness(paint("line-color", "#fff")),
    );
  });

  it("keeps a motorway orange", () => {
    const motorway = parseColor(String(paint("line-color", "hsl(26,87%,62%)")));

    expect(motorway).not.toBeNull();
    expect(motorway!.r).toBeGreaterThan(motorway!.b);
  });

  /** Even a style that drew dark lines on light land must leave them visible. */
  it("holds every line clear of the ground", () => {
    for (const input of ["#000", "#333", "#bbb", "#fff"]) {
      expect(lightness(paint("line-color", input))).toBeGreaterThan(LAND);
    }
  });
});

describe("paint values that are not plain colours", () => {
  /**
   * Real styles put colours inside zoom interpolations and legacy stop objects.
   * Walking the value and transforming any string that parses handles all of
   * them without this file having to understand the expression grammar.
   */
  it("walks into expressions", () => {
    const result = paint("fill-color", [
      "interpolate",
      ["linear"],
      ["zoom"],
      9,
      "hsla(0,3%,85%,0.84)",
      12,
      "hsla(35,57%,88%,0.49)",
    ]) as unknown[];

    expect(result[0]).toBe("interpolate");
    expect(result[3]).toBe(9);
    expect(lightness(result[4])).toBeLessThanOrEqual(0.4);
    expect(lightness(result[6])).toBeLessThanOrEqual(0.4);
  });

  it("walks into legacy stop functions", () => {
    const result = paint("fill-color", {
      base: 1,
      stops: [
        [8, "#ffffff"],
        [14, "#eeeeee"],
      ],
    }) as { stops: [number, string][] };

    expect(result.stops[0][0]).toBe(8);
    expect(lightness(result.stops[0][1])).toBeLessThanOrEqual(0.4);
  });

  /** Anything unparseable is left exactly as it was, which is the safe default. */
  it("passes through what it cannot read", () => {
    expect(paint("line-color", "rebeccapurple")).toBe("rebeccapurple");
    expect(paint("line-color", ["get", "color"])).toEqual(["get", "color"]);
  });

  it("leaves properties that are not colours alone", () => {
    expect(paint("line-width", 3)).toBe(3);
    expect(paint("fill-opacity", 0.5)).toBe(0.5);
  });
});

describe("darkenStyle", () => {
  it("keeps everything that is not a layer", () => {
    const style = darkenStyle({
      version: 8,
      name: "Liberty",
      sources: { openmaptiles: { type: "vector" } },
      sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
      layers: [],
    });

    expect(style.version).toBe(8);
    expect(style.name).toBe("Liberty");
    expect(style.sprite).toContain("ofm");
    expect(style.sources).toEqual({ openmaptiles: { type: "vector" } });
  });

  it("survives a layer with no paint at all", () => {
    const style = darkenStyle({
      layers: [{ id: "tunnels", type: "line", "source-layer": "transportation" }],
    });

    expect(style.layers[0]["source-layer"]).toBe("transportation");
  });
});
