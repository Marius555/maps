import { describe, expect, it } from "vitest";

import { detectColumnMapping, validateColumnMapping } from "./column-mapping";

describe("detectColumnMapping", () => {
  it("maps a tidy header row", () => {
    const mapping = detectColumnMapping([
      "Name",
      "Address",
      "City",
      "Postcode",
      "Country",
      "Category",
      "Phone",
      "Email",
      "Website",
    ]);

    expect(mapping).toEqual({
      name: "Name",
      address: "Address",
      city: "City",
      postcode: "Postcode",
      country: "Country",
      category: "Category",
      phone: "Phone",
      email: "Email",
      url: "Website",
    });
  });

  it("ignores case, spaces and punctuation", () => {
    const mapping = detectColumnMapping(["Store Name", "STREET_ADDRESS", "Zip Code"]);

    expect(mapping.name).toBe("Store Name");
    expect(mapping.address).toBe("STREET_ADDRESS");
    expect(mapping.postcode).toBe("Zip Code");
  });

  it("prefers an exact match over a partial one", () => {
    // "Email Address" ends with "address", so a naive matcher puts it in the
    // address field and the real address column loses.
    const mapping = detectColumnMapping(["Name", "Address", "Email Address"]);

    expect(mapping.address).toBe("Address");
    expect(mapping.email).toBe("Email Address");
  });

  it("never assigns one column to two fields", () => {
    const mapping = detectColumnMapping(["Location", "Location"]);
    const used = Object.values(mapping);

    expect(new Set(used).size).toBe(used.length);
  });

  it("recognises coordinate columns under several spellings", () => {
    expect(detectColumnMapping(["lat", "lon"])).toMatchObject({
      lat: "lat",
      lng: "lon",
    });
    expect(detectColumnMapping(["Latitude", "Longitude"])).toMatchObject({
      lat: "Latitude",
      lng: "Longitude",
    });
  });

  it("leaves unrecognised columns unmapped", () => {
    const mapping = detectColumnMapping(["Name", "Internal Ref", "Sales Rep"]);

    expect(mapping.name).toBe("Name");
    expect(Object.values(mapping)).not.toContain("Internal Ref");
    expect(Object.values(mapping)).not.toContain("Sales Rep");
  });

  it("returns nothing for headers it cannot place", () => {
    expect(detectColumnMapping(["foo", "bar"])).toEqual({});
  });
});

describe("validateColumnMapping", () => {
  const headers = ["Name", "Address", "Lat", "Lng", "Other"];

  it("accepts a name plus an address", () => {
    expect(
      validateColumnMapping({ name: "Name", address: "Address" }, headers),
    ).toEqual([]);
  });

  it("accepts a name plus coordinates", () => {
    expect(
      validateColumnMapping({ name: "Name", lat: "Lat", lng: "Lng" }, headers),
    ).toEqual([]);
  });

  it("requires a name column", () => {
    const problems = validateColumnMapping({ address: "Address" }, headers);

    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe("name");
  });

  it("requires either an address or coordinates", () => {
    const problems = validateColumnMapping({ name: "Name" }, headers);

    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("address column");
  });

  it("rejects a half-mapped coordinate pair", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Address", lat: "Lat" },
      headers,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe("lng");
  });

  it("rejects the same column used twice", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Name" },
      headers,
    );

    expect(problems.some((problem) => problem.message.includes("only be used once"))).toBe(
      true,
    );
  });

  it("rejects a column the file doesn't have", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Missing" },
      headers,
    );

    expect(problems.some((problem) => problem.field === "address")).toBe(true);
  });
});
