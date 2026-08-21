import { describe, expect, it } from "vitest";

import { validateColumnMapping } from "./column-mapping";

describe("validateColumnMapping", () => {
  const headers = ["Name", "Address", "Lat", "Lng", "Position", "Other"];

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

  it("accepts a name plus one combined coordinate column", () => {
    expect(
      validateColumnMapping({ name: "Name", latlng: "Position" }, headers),
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

  it("accepts a state column as an address part", () => {
    // It is in ADDRESS_PARTS and gets composed into the geocoded address, so
    // rejecting it here would contradict what the import actually does with it.
    expect(
      validateColumnMapping({ name: "Name", state: "Other" }, headers),
    ).toEqual([]);
  });

  it("rejects a half-mapped coordinate pair", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Address", lat: "Lat" },
      headers,
    );

    expect(problems).toHaveLength(1);
    expect(problems[0].field).toBe("lng");
  });

  it("excuses a half-mapped pair when one column holds both", () => {
    // A file with a combined column and a stray "Lat" is mapped correctly; the
    // pair rule would otherwise block a mapping that can place every row.
    expect(
      validateColumnMapping(
        { name: "Name", latlng: "Position", lat: "Lat" },
        headers,
      ),
    ).toEqual([]);
  });

  it("rejects the same column used twice", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Name" },
      headers,
    );

    expect(
      problems.some((problem) => problem.message.includes("only be used once")),
    ).toBe(true);
  });

  it("names the field that already claimed the column", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Name" },
      headers,
    );

    expect(problems[0].message).toContain("Name");
  });

  it("rejects a column the file doesn't have", () => {
    const problems = validateColumnMapping(
      { name: "Name", address: "Missing" },
      headers,
    );

    expect(problems.some((problem) => problem.field === "address")).toBe(true);
  });
});
