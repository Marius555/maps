import { describe, expect, it } from "vitest";

import { readProperties } from "./properties";

describe("name", () => {
  it.each([
    ["name", "Ontario"],
    ["NAME", "ONTARIO"],
    ["Name", "Ontario"],
    ["title", "Ontario"],
    ["TITLE", "ONTARIO"],
    ["label", "Ontario"],
    ["nom", "Ontario"],
    ["Bezeichnung", "Ontario"],
  ])("reads %s", (key, value) => {
    expect(readProperties({ [key]: value }).name).toBe(value);
  });

  it.each(["zoneName", "zone_name", "NAME_EN", "name:en", "areaName"])(
    "reads anything ending in name — %s",
    (key) => {
      // The entry that reads the file this whole rewrite started with.
      expect(readProperties({ [key]: "Central Park" }).name).toBe("Central Park");
    },
  );

  it("prefers the table's order over the object's", () => {
    // Two files with the same styling must import the same way, whatever order
    // their exporter happened to serialise the keys in.
    expect(readProperties({ zone: "Z", name: "N" }).name).toBe("N");
    expect(readProperties({ name: "N", zone: "Z" }).name).toBe("N");
  });

  it("falls back to an id only when there is nothing better", () => {
    expect(readProperties({ OBJECTID: 4021 }).name).toBe("4021");
    expect(readProperties({ OBJECTID: 4021, title: "Ward 3" }).name).toBe("Ward 3");
  });

  it("ignores a name that is only whitespace", () => {
    expect(readProperties({ name: "   " }).name).toBeNull();
  });

  it("has no opinion about an empty bag", () => {
    expect(readProperties(null)).toEqual({
      name: null,
      description: null,
      color: null,
      opacity: null,
    });
  });
});

describe("colour", () => {
  it.each([
    ["#3b82f6", "#3b82f6"],
    ["#3B82F6", "#3b82f6"],
    ["3b82f6", "#3b82f6"],
    ["#abc", "#aabbcc"],
    ["#3b82f680", "#3b82f6"],
  ])("normalises %s", (value, expected) => {
    expect(readProperties({ fill: value }).color).toBe(expected);
  });

  it("prefers the simplestyle fill over a stroke or a generic colour", () => {
    const bag = { color: "#111111", stroke: "#222222", fill: "#333333" };

    expect(readProperties(bag).color).toBe("#333333");
  });

  it("ignores anything that is not a hex value", () => {
    // A named colour is a 148-entry table for a case no export produces, and the
    // palette fallback is a better answer than a partial one.
    expect(readProperties({ fill: "cornflowerblue" }).color).toBeNull();
    expect(readProperties({ fill: "rgb(1,2,3)" }).color).toBeNull();
    expect(readProperties({ fill: "#12345" }).color).toBeNull();
  });
});

describe("opacity", () => {
  it("reads a fraction and a percentage alike", () => {
    expect(readProperties({ "fill-opacity": 0.2 }).opacity).toBe(0.2);
    expect(readProperties({ fillOpacity: "0.35" }).opacity).toBe(0.35);
    // Nobody means an opacity of twenty.
    expect(readProperties({ opacity: 20 }).opacity).toBe(0.2);
  });

  it("ignores what it cannot read", () => {
    expect(readProperties({ opacity: "opaque" }).opacity).toBeNull();
    expect(readProperties({ opacity: -1 }).opacity).toBeNull();
    expect(readProperties({ opacity: 400 }).opacity).toBeNull();
  });
});

describe("description", () => {
  it.each(["description", "desc", "notes", "comment", "remarks"])(
    "reads %s",
    (key) => {
      expect(readProperties({ [key]: "Weekdays only" }).description).toBe(
        "Weekdays only",
      );
    },
  );

  it("truncates past the column's width", () => {
    // An overflow fails the insert for the whole 50-shape chunk, not just its
    // own row.
    expect(readProperties({ description: "x".repeat(6000) }).description).toHaveLength(
      5000,
    );
  });
});
