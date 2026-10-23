import {
  EUROPE_PLACES,
  EUROPE_ROUTE,
  placeNamed,
  type EuropePlace,
} from "@/lib/marketing/europe-map/places";
import { gridBounds } from "@/lib/marketing/world-dots";

import { flatView } from "./flat-view";
import { smoothPath } from "./smooth-path";

/** Europe at 0.5°, squeezed to its middle latitude so it is not stretched. */
export const TILT_VIEW = flatView(gridBounds("europe"), 540, true);

export type TiltPin = EuropePlace & {
  x: number;
  y: number;
  /** Percent across and down the plane, for the HTML pins standing on it. */
  left: number;
  top: number;
};

export const TILT_PINS: readonly TiltPin[] = EUROPE_PLACES.map((place) => {
  const { x, y } = TILT_VIEW.project(place);
  return {
    ...place,
    x,
    y,
    left: (x / TILT_VIEW.width) * 100,
    top: (y / TILT_VIEW.height) * 100,
  };
});

export const TILT_ROUTE_D = smoothPath(
  EUROPE_ROUTE.map((name) => TILT_VIEW.project(placeNamed(EUROPE_PLACES, name))),
);

export const TILT_ROUTE_STOPS = new Set(EUROPE_ROUTE);
