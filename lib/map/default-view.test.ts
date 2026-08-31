import { describe, expect, it } from "vitest";

import { DEFAULT_CENTER } from "@/lib/config";
import { isDefaultView } from "./default-view";

const view = (lat: number, lng: number, zoom: number) => ({
  defaultLat: lat,
  defaultLng: lng,
  defaultZoom: zoom,
});

describe("isDefaultView", () => {
  it("recognises the current default", () => {
    expect(
      isDefaultView(
        view(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, DEFAULT_CENTER.zoom),
      ),
    ).toBe(true);
  });

  it("recognises the Vilnius default every older map still holds", () => {
    expect(isDefaultView(view(54.687, 25.28, 11))).toBe(true);
  });

  it("treats a saved view as chosen", () => {
    expect(isDefaultView(view(51.5074, -0.1278, 12))).toBe(false);
  });

  it("treats a nudged default as chosen", () => {
    // Same place, different zoom: the owner pressed Save after scrolling once.
    expect(isDefaultView(view(54.687, 25.28, 12))).toBe(false);
  });
});
