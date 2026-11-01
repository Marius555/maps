import { describe, expect, it } from "vitest";

import {
  parseStorefrontMaps,
  withoutStorefrontMap,
  withStorefrontMap,
  type StorefrontMaps,
} from "./storefront-maps";

const SCRIPT = "https://cdn.pinglide.com/embed/v1/map.js";
const a = { name: "Stockists", snapshot: "https://cdn.pinglide.com/s/a/live.json" };
const b = { name: "Events", snapshot: "https://cdn.pinglide.com/s/b/live.json" };

describe("withStorefrontMap", () => {
  it("makes the first map the default without being asked", () => {
    expect(withStorefrontMap(null, "a", a, { makeDefault: false, script: SCRIPT })).toEqual({
      default: "a",
      script: SCRIPT,
      maps: { a },
    });
  });

  it("keeps the default when another map is added", () => {
    const one = withStorefrontMap(null, "a", a, { makeDefault: false, script: SCRIPT });

    expect(withStorefrontMap(one, "b", b, { makeDefault: false, script: SCRIPT }).default).toBe("a");
  });

  it("moves the default when asked", () => {
    const one = withStorefrontMap(null, "a", a, { makeDefault: false, script: SCRIPT });

    expect(withStorefrontMap(one, "b", b, { makeDefault: true, script: SCRIPT }).default).toBe("b");
  });

  it("updates a map already on the list in place", () => {
    const one = withStorefrontMap(null, "a", a, { makeDefault: false, script: SCRIPT });
    const renamed = { ...a, name: "Our stockists" };

    expect(withStorefrontMap(one, "a", renamed, { makeDefault: false, script: SCRIPT }).maps).toEqual({
      a: renamed,
    });
  });
});

describe("withoutStorefrontMap", () => {
  const both: StorefrontMaps = { default: "a", script: SCRIPT, maps: { a, b } };

  it("moves the default to a map that is left", () => {
    expect(withoutStorefrontMap(both, "a")).toEqual({ default: "b", script: SCRIPT, maps: { b } });
  });

  it("keeps the default when another map goes", () => {
    expect(withoutStorefrontMap(both, "b")?.default).toBe("a");
  });

  it("leaves no default when the last map goes", () => {
    const one: StorefrontMaps = { default: "a", script: SCRIPT, maps: { a } };

    expect(withoutStorefrontMap(one, "a")).toEqual({ default: null, script: SCRIPT, maps: {} });
  });
});

describe("parseStorefrontMaps", () => {
  it("reads what the writers write", () => {
    const value: StorefrontMaps = { default: "a", script: SCRIPT, maps: { a, b } };

    expect(parseStorefrontMaps(JSON.stringify(value))).toEqual(value);
  });

  it("treats anything malformed as nothing stored", () => {
    expect(parseStorefrontMaps(null)).toBeNull();
    expect(parseStorefrontMaps("not json")).toBeNull();
    expect(parseStorefrontMaps("42")).toBeNull();
  });

  it("drops entries without a snapshot and a default that names nothing", () => {
    const parsed = parseStorefrontMaps(
      JSON.stringify({ default: "gone", script: SCRIPT, maps: { a, broken: { name: "x" } } }),
    );

    expect(parsed).toEqual({ default: null, script: SCRIPT, maps: { a } });
  });
});
