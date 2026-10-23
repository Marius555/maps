import { EUROPE_PLACES, type EuropePlace } from "@/lib/marketing/europe-map/places";

import { flatView } from "../../europe-map/flat-view";

/**
 * The patch of Europe the three step drawings stand on: Barcelona to Berlin,
 * Paris to Vienna. The same dot mask and the same coffee chain as the showcase
 * map above them (components/marketing/europe-map/), cropped to where its
 * shops are thickest, so the section reads as a closer look at that map.
 */
export const STAGE_VIEW = flatView({ west: 1, east: 19, north: 54, south: 41 }, 400, true);

/** A dot's radius in view units: about a quarter of the grid step, as on the showcase. */
export const STAGE_DOT = 3.4;

export type StagePlace = EuropePlace & {
  /** In view units, for SVG drawn on the ground. */
  x: number;
  y: number;
  /** Percent across and down the ground, for HTML standing on it. */
  left: number;
  top: number;
};

export function stagePlace(name: string): StagePlace {
  const place = EUROPE_PLACES.find((p) => p.name === name);
  if (!place) throw new Error(`No Europe map place named ${name}`);
  const { x, y } = STAGE_VIEW.project(place);

  return {
    ...place,
    x,
    y,
    left: (x / STAGE_VIEW.width) * 100,
    top: (y / STAGE_VIEW.height) * 100,
  };
}

export const stagePlaces = (names: readonly string[]) => names.map(stagePlace);
