import { describe, expect, it } from "vitest";

import { applyLabelLevel } from "./style-labels";
import type { StyleLike } from "./style-tint";

/**
 * The layers are real ones, quoted from the live Liberty style, because the rule
 * being tested is "which source-layer is this drawn from" and invented fixtures
 * would let a rule that matches on layer ids pass. Liberty's ids are Liberty's
 * private business; the other four style documents name the same things
 * differently, and all five have to work.
 */
const STYLE: StyleLike = {
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f8f4f0" } },
    { id: "water", type: "fill", "source-layer": "water" },
    { id: "road_minor", type: "line", "source-layer": "transportation" },
    { id: "poi_r1", type: "symbol", "source-layer": "poi" },
    { id: "poi_transit", type: "symbol", "source-layer": "poi" },
    { id: "highway-name-minor", type: "symbol", "source-layer": "transportation_name" },
    { id: "water_name_point_label", type: "symbol", "source-layer": "water_name" },
    { id: "airport", type: "symbol", "source-layer": "aerodrome_label" },
    { id: "label_city", type: "symbol", "source-layer": "place" },
    { id: "label_country_1", type: "symbol", "source-layer": "place" },
    { id: "label_village", type: "symbol", "source-layer": "place" },
  ],
};

function visibility(style: StyleLike, id: string): unknown {
  const layer = style.layers?.find((candidate) => candidate.id === id);
  return (layer?.layout as Record<string, unknown> | undefined)?.visibility;
}

describe("applyLabelLevel", () => {
  /**
   * Identity, and by reference. The light path hands MapLibre a plain URL and
   * never parses the style at all, which only works while "all" costs nothing.
   */
  it("returns the style untouched at the default level", () => {
    expect(applyLabelLevel(STYLE, "all")).toBe(STYLE);
  });

  it("hides every symbol layer and nothing else at none", () => {
    const result = applyLabelLevel(STYLE, "none");

    for (const id of ["poi_r1", "highway-name-minor", "label_city", "airport"]) {
      expect(visibility(result, id)).toBe("none");
    }

    // The map itself is not a label.
    expect(visibility(result, "water")).toBeUndefined();
    expect(visibility(result, "road_minor")).toBeUndefined();
    expect(visibility(result, "background")).toBeUndefined();
  });

  /**
   * The middle setting, and the one worth asserting: it keeps what orients you
   * and drops what fills space. Villages stay — they are place names, and a rule
   * that started dropping them by rank would need Liberty's own filters, which
   * the other four styles do not share.
   */
  it("keeps place names and airports at some, and drops the detail", () => {
    const result = applyLabelLevel(STYLE, "some");

    for (const id of ["label_city", "label_country_1", "label_village", "airport"]) {
      expect(visibility(result, id)).toBeUndefined();
    }

    for (const id of [
      "poi_r1",
      "poi_transit",
      "highway-name-minor",
      "water_name_point_label",
    ]) {
      expect(visibility(result, id)).toBe("none");
    }
  });

  it("does not mutate the style it was given", () => {
    applyLabelLevel(STYLE, "none");

    expect(visibility(STYLE, "label_city")).toBeUndefined();
  });

  it("survives a style with no layers", () => {
    expect(applyLabelLevel({ version: 8 }, "none")).toEqual({ version: 8, layers: [] });
  });
});
