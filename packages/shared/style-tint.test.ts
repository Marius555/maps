import { describe, expect, it } from "vitest";

import { tintStyle, type Band, type StyleTint } from "./style-tint";

function band(overrides: Partial<Band> = {}): Band {
  return { floor: 0.2, range: 0.7, chroma: 1, invert: false, ...overrides };
}

function tint(ground: Band): StyleTint {
  return {
    ground,
    figure: band(),
    text: band(),
    halo: "#ffffff",
    haloWidth: 1,
    rasterOpacity: 0.3,
    textMinAlpha: 0.8,
  };
}

function rasterPaint(t: StyleTint): Record<string, unknown> {
  const style = tintStyle(
    { layers: [{ id: "natural_earth", type: "raster", paint: { "raster-opacity": 1 } }] },
    t,
  );

  return style.layers?.[0].paint ?? {};
}

/**
 * Liberty's low-zoom shaded relief is a green-and-brown raster whose pixels no
 * band can reach, so on Mono it painted the zoomed-out map green and then
 * vanished at z7, where the layer stops drawing.
 */
describe("tintStyle on a raster", () => {
  it("drains the colour out of the relief on a greyscale theme", () => {
    expect(rasterPaint(tint(band({ chroma: 0 })))["raster-saturation"]).toBe(-1);
  });

  it("drains it on a hued theme too, whose hue a raster cannot take", () => {
    expect(rasterPaint(tint(band({ hue: 40, hueChroma: 0.05 })))["raster-saturation"]).toBe(-1);
  });

  it("leaves the colour alone when the ground keeps its own", () => {
    expect(rasterPaint(tint(band({ chroma: 1 })))["raster-saturation"]).toBe(0);
  });

  it("fades out by z7 rather than vanishing in one frame", () => {
    expect(rasterPaint(tint(band()))["raster-opacity"]).toEqual([
      "interpolate", ["linear"], ["zoom"], 5, 0.3, 7, 0,
    ]);
  });
});
