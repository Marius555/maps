import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

import { toAppMap } from "./mappers";
import type { MapRow } from "./types";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

function row(fields: Partial<MapRow>): MapRow {
  return {
    $id: "map1",
    $createdAt: "2026-10-01T00:00:00.000Z",
    $updatedAt: "2026-10-01T00:00:00.000Z",
    userId: "u1",
    name: "Map",
    slug: "map",
    style: "",
    defaultLat: 0,
    defaultLng: 0,
    defaultZoom: 2,
    ...fields,
  } as MapRow;
}

describe("toAppMap pin images", () => {
  it("keeps pins whose image is a data URI, and glyph pins untouched", () => {
    const icons = [
      { id: "a", label: "Logo", color: "#112233", glyph: "", image: PNG },
      { id: "b", label: "Shop", color: "#112233", glyph: "store" },
    ];
    const map = toAppMap(row({ pinIcons: JSON.stringify(icons) }));

    expect(map.pinIcons).toEqual(icons);
  });

  it("drops a pin whose image would break out of the attribute", () => {
    const icons = [
      { id: "a", label: "Bad", color: "#112233", glyph: "", image: `x" onload="alert(1)` },
      { id: "b", label: "Svg", color: "#112233", glyph: "", image: "data:image/svg+xml;base64,PHN2Zz4=" },
      { id: "c", label: "Ok", color: "#112233", glyph: "", image: PNG },
    ];
    const map = toAppMap(row({ pinIcons: JSON.stringify(icons) }));

    expect(map.pinIcons.map((icon) => icon.id)).toEqual(["c"]);
  });

  it("reads a column that is not an array as no pins", () => {
    expect(toAppMap(row({ pinIcons: '{"a":1}' })).pinIcons).toEqual([]);
    expect(toAppMap(row({ pinIcons: "not json" })).pinIcons).toEqual([]);
  });

  it("keeps a cluster icon that is a pin id or a real image", () => {
    expect(toAppMap(row({ clusterIcon: "custom:a" })).clusterIcon).toBe("custom:a");
    expect(toAppMap(row({ clusterIcon: PNG })).clusterIcon).toBe(PNG);
    expect(toAppMap(row({})).clusterIcon).toBe("");
  });

  it("drops a cluster image that is not one", () => {
    expect(toAppMap(row({ clusterIcon: `data:x" onload="alert(1)` })).clusterIcon).toBe("");
  });
});
