import { describe, expect, it } from "vitest";

import { mappingForLink } from "./link-mapping";

describe("mappingForLink", () => {
  it("stores the combined column instead of the two it was split into", () => {
    expect(
      mappingForLink(
        { name: "Name", lat: "Latitude", lng: "Longitude" },
        { sourceHeader: "Coordinates", latHeader: "Latitude", lngHeader: "Longitude" },
      ),
    ).toEqual({ name: "Name", latlng: "Coordinates" });
  });

  it("still traces the split back after the two were swapped", () => {
    expect(
      mappingForLink(
        { name: "Name", lat: "Longitude", lng: "Latitude" },
        { sourceHeader: "Coordinates", latHeader: "Latitude", lngHeader: "Longitude" },
      ),
    ).toEqual({ name: "Name", latlng: "Coordinates" });
  });

  it("leaves a mapping alone that never used the split", () => {
    const mapping = { name: "Name", lat: "Lat", lng: "Lng" };

    expect(
      mappingForLink(mapping, {
        sourceHeader: "Coordinates",
        latHeader: "Latitude",
        lngHeader: "Longitude",
      }),
    ).toEqual(mapping);
    expect(mappingForLink(mapping, null)).toEqual(mapping);
  });
});
