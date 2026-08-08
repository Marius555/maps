import { describe, expect, it } from "vitest";

import type { MapCategory } from "@/lib/repositories/types";
import { MAX_CATEGORIES } from "@/lib/validation/category.schema";
import { resolveCategories } from "./resolve-categories";

const existing: MapCategory[] = [
  { id: "retail", label: "Retail", color: "#e8590c" },
];

describe("resolveCategories", () => {
  it("reuses an existing category regardless of case or padding", () => {
    const result = resolveCategories(["  retail ", "RETAIL"], existing);

    expect(result.added).toEqual([]);
    expect(result.categories).toHaveLength(1);
    expect(result.idByLabel.get("retail")).toBe("retail");
  });

  it("creates a category for an unseen label", () => {
    const result = resolveCategories(["Wholesale"], existing);

    expect(result.added).toHaveLength(1);
    expect(result.added[0].label).toBe("Wholesale");
    expect(result.categories).toHaveLength(2);
  });

  it("gives new categories distinct colours", () => {
    const result = resolveCategories(["A", "B", "C"], []);
    const colors = result.added.map((category) => category.color);

    expect(new Set(colors).size).toBe(colors.length);
  });

  it("gives every new category a distinct id", () => {
    const result = resolveCategories(["Retail", "retail!", "Retail "], []);
    const ids = result.categories.map((category) => category.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not collide with an existing id", () => {
    // "Retail!" slugs to "retail", which is already taken.
    const result = resolveCategories(["Retail!"], existing);

    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).not.toBe("retail");
  });

  it("ignores blank labels", () => {
    const result = resolveCategories(["", "   "], existing);

    expect(result.added).toEqual([]);
  });

  it("reports labels dropped once the map is full rather than silently ignoring them", () => {
    const full: MapCategory[] = Array.from({ length: MAX_CATEGORIES }, (_, index) => ({
      id: `c-${index}`,
      label: `Category ${index}`,
      color: "#e8590c",
    }));

    const result = resolveCategories(["Overflow"], full);

    expect(result.added).toEqual([]);
    expect(result.dropped).toEqual(["Overflow"]);
    expect(result.categories).toHaveLength(MAX_CATEGORIES);
  });

  it("truncates a label to the column width", () => {
    const result = resolveCategories(["x".repeat(100)], []);

    expect(result.added[0].label).toHaveLength(64);
  });
});
