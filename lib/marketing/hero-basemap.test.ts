import { describe, expect, it } from "vitest";

import { HERO_ROAD_OPACITY, HERO_ROAD_WIDTHS, quietHeroRoads } from "./hero-basemap";

const zoomWidth = ["interpolate", ["exponential", 1.2], ["zoom"], 5, 0, 20, 18];

function road(id: string) {
  return {
    id,
    type: "line",
    "source-layer": "transportation",
    paint: { "line-width": zoomWidth, "line-color": "#fff" },
  };
}

const STYLE = {
  version: 8,
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#eee" } },
    road("road_motorway"),
    road("road_motorway_casing"),
    road("bridge_trunk_primary"),
    road("tunnel_secondary_tertiary"),
    road("road_minor"),
    road("road_path_pedestrian"),
    road("road_major_rail"),
    { id: "road_label", type: "symbol", "source-layer": "transportation_name" },
  ],
};

function layer(style: typeof STYLE, id: string) {
  return style.layers.find((entry) => entry.id === id) as {
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  };
}

describe("quietHeroRoads", () => {
  const quiet = quietHeroRoads(STYLE);

  it("draws the larger roads as constant hairlines", () => {
    expect(layer(quiet, "road_motorway").paint?.["line-width"]).toBe(HERO_ROAD_WIDTHS.motorway);
    expect(layer(quiet, "bridge_trunk_primary").paint?.["line-width"]).toBe(
      HERO_ROAD_WIDTHS.trunk_primary,
    );
    expect(layer(quiet, "tunnel_secondary_tertiary").paint?.["line-opacity"]).toBe(
      HERO_ROAD_OPACITY,
    );
    // The colour is the look's, untouched.
    expect(layer(quiet, "road_motorway").paint?.["line-color"]).toBe("#fff");
  });

  it("recolours the roads it keeps when asked, and only those", () => {
    const grey = quietHeroRoads(STYLE, { color: "#bdbdbd" });

    expect(layer(grey, "road_motorway").paint?.["line-color"]).toBe("#bdbdbd");
    expect(layer(grey, "road_minor").paint?.["line-color"]).toBe("#fff");
  });

  it("hides every casing, small street, path and rail", () => {
    for (const id of ["road_motorway_casing", "road_minor", "road_path_pedestrian", "road_major_rail"]) {
      expect(layer(quiet, id).layout?.visibility).toBe("none");
    }
  });

  it("leaves everything that is not a road alone", () => {
    expect(layer(quiet, "background")).toBe(layer(STYLE, "background"));
    expect(layer(quiet, "road_label")).toBe(layer(STYLE, "road_label"));
  });

  it("builds a copy rather than editing the style it was given", () => {
    expect(layer(STYLE, "road_motorway").paint?.["line-width"]).toBe(zoomWidth);
    expect(layer(STYLE, "road_minor").layout).toBeUndefined();
  });
});
