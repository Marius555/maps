import { describe, expect, it } from "vitest";

import {
  buildSearchIndex,
  matchesSearch,
  searchNeedle,
  type SearchSource,
} from "./search-text";
import type { SnapshotPlace } from "./snapshot";

const place = (over: Partial<SnapshotPlace> & { id: string }): SnapshotPlace => ({
  name: "Camden Store",
  lat: 51.54,
  lng: -0.14,
  ...over,
});

const source = (over: Partial<SearchSource> = {}): SearchSource => ({
  places: [],
  categories: [{ id: "retail", label: "Retail", color: "#1c7ed6" }],
  tagGroups: [
    { id: "sells", label: "Sells", tags: [{ id: "bikes", label: "Bikes" }] },
  ],
  ...over,
});

const find = (src: SearchSource, query: string): string[] => {
  const index = buildSearchIndex(src);
  const needle = searchNeedle(query);

  return src.places
    .filter((one) => matchesSearch(index, one, needle))
    .map((one) => one.id);
};

describe("buildSearchIndex", () => {
  it("finds a place by its category's label", () => {
    const src = source({
      places: [
        place({ id: "a", category: "retail" }),
        place({ id: "b", name: "Depot" }),
      ],
    });

    expect(find(src, "retail")).toEqual(["a"]);
  });

  it("finds a place by a tag's label", () => {
    const src = source({
      places: [
        place({ id: "a", tags: ["bikes"] }),
        place({ id: "b", name: "Depot" }),
      ],
    });

    expect(find(src, "bikes")).toEqual(["a"]);
  });

  it("still finds a place by name and by address", () => {
    const src = source({
      places: [
        place({ id: "a", address: "12 Camden High St" }),
        place({ id: "b", name: "Depot", address: "9 Kings Road" }),
      ],
    });

    expect(find(src, "camden")).toEqual(["a"]);
    expect(find(src, "kings")).toEqual(["b"]);
  });

  it("ignores a tag the map no longer defines", () => {
    // The id would otherwise be matchable text nothing on the map ever shows.
    const src = source({ places: [place({ id: "a", tags: ["deleted"] })] });

    expect(find(src, "deleted")).toEqual([]);
  });

  it("is case and whitespace insensitive", () => {
    const src = source({ places: [place({ id: "a", category: "retail" })] });

    expect(find(src, "  ReTaIl ")).toEqual(["a"]);
  });

  it("treats an empty query as no filter", () => {
    const src = source({
      places: [place({ id: "a" }), place({ id: "b", name: "Depot" })],
    });

    expect(find(src, "   ")).toEqual(["a", "b"]);
  });

  it("copes with a map that defines no tag groups at all", () => {
    const src = source({
      tagGroups: undefined,
      places: [place({ id: "a", tags: ["bikes"] })],
    });

    expect(find(src, "camden")).toEqual(["a"]);
    expect(find(src, "bikes")).toEqual([]);
  });
});
