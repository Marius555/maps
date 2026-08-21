import { describe, expect, it } from "vitest";

import {
  looksSwapped,
  parseCoordinate,
  parseDms,
  parseLatLngPair,
  parseMapLink,
} from "./coordinates";

describe("parseCoordinate", () => {
  it("reads a decimal", () => {
    expect(parseCoordinate("52.5200")).toBe(52.52);
    expect(parseCoordinate("-13.4050")).toBe(-13.405);
  });

  it("reads a decimal comma", () => {
    // European spreadsheets write "54,687"; reading that as 54 puts the pin in
    // the wrong country.
    expect(parseCoordinate("54,687")).toBe(54.687);
  });

  it("strips thousands separators", () => {
    // Both a comma and a dot means the comma is grouping, not the decimal point.
    expect(parseCoordinate("1,234.5")).toBe(1234.5);
  });

  it("rejects text and blanks", () => {
    expect(parseCoordinate("")).toBeNull();
    expect(parseCoordinate("   ")).toBeNull();
    expect(parseCoordinate("north")).toBeNull();
    // Number("") is 0, which would place a pin in the Atlantic.
    expect(parseCoordinate("-")).toBeNull();
  });
});

describe("parseDms", () => {
  it("reads degrees, minutes and seconds", () => {
    expect(parseDms("52°31'12\"N")).toBeCloseTo(52.52, 4);
  });

  it("reads a leading hemisphere", () => {
    expect(parseDms("N 52° 31' 12\"")).toBeCloseTo(52.52, 4);
  });

  it("makes south and west negative", () => {
    expect(parseDms("33°52'12\"S")).toBeCloseTo(-33.87, 4);
    expect(parseDms("118°15'0\"W")).toBeCloseTo(-118.25, 4);
  });

  it("reads degrees and decimal minutes", () => {
    expect(parseDms("52° 31.2' N")).toBeCloseTo(52.52, 4);
  });

  it("declines without a hemisphere", () => {
    // Without N/S/E/W this is a number with stray punctuation, and guessing the
    // sign would be worse than declining.
    expect(parseDms("52°31'12\"")).toBeNull();
  });

  it("rejects impossible minutes and seconds", () => {
    expect(parseDms("52°71'12\"N")).toBeNull();
  });

  it("rejects a latitude past 90", () => {
    expect(parseDms("112°31'12\"N")).toBeNull();
  });
});

describe("parseLatLngPair", () => {
  it("reads a comma-separated pair", () => {
    expect(parseLatLngPair("52.5200, 13.4050")).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("reads a parenthesised pair", () => {
    expect(parseLatLngPair("(52.5200, 13.4050)")).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("reads a space-separated pair", () => {
    expect(parseLatLngPair("52.5200 13.4050")).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("reads a semicolon-separated pair", () => {
    expect(parseLatLngPair("52.5200; 13.4050")).toEqual({
      lat: 52.52,
      lng: 13.405,
    });
  });

  it("reads a DMS pair", () => {
    const pair = parseLatLngPair("52°31'12\"N 13°24'18\"E");

    expect(pair?.lat).toBeCloseTo(52.52, 3);
    expect(pair?.lng).toBeCloseTo(13.405, 3);
  });

  it("does not split one decimal-comma number into a pair", () => {
    // "52,52" is a single European-formatted number, not the pair 52 and 52.
    expect(parseLatLngPair("52,52")).toBeNull();
  });

  it("rejects an out-of-range pair", () => {
    expect(parseLatLngPair("152.52, 13.405")).toBeNull();
  });

  it("rejects a single number", () => {
    expect(parseLatLngPair("52.52")).toBeNull();
  });
});

describe("parseMapLink", () => {
  it("reads the @lat,lng form from the address bar", () => {
    expect(
      parseMapLink("https://www.google.com/maps/@52.5200,13.4050,15z"),
    ).toEqual({ lat: 52.52, lng: 13.405 });
  });

  it("reads the ?q=lat,lng share form", () => {
    expect(
      parseMapLink("https://maps.google.com/?q=52.5200,13.4050"),
    ).toEqual({ lat: 52.52, lng: 13.405 });
  });

  it("ignores anything that isn't a link", () => {
    expect(parseMapLink("52.5200,13.4050")).toBeNull();
  });

  it("ignores a link with no coordinates in it", () => {
    expect(parseMapLink("https://example.com/stores/berlin")).toBeNull();
  });
});

describe("looksSwapped", () => {
  it("spots a latitude column holding longitudes", () => {
    // A value past ±90 cannot be a latitude, so this is proof rather than a hunch.
    expect(
      looksSwapped([
        { lat: "113.4050", lng: "52.5200" },
        { lat: "109.9937", lng: "53.5511" },
        { lat: "106.9603", lng: "50.9375" },
        { lat: "111.5820", lng: "48.1351" },
      ]),
    ).toBe(true);
  });

  it("leaves a correct pair alone", () => {
    expect(
      looksSwapped([
        { lat: "52.5200", lng: "13.4050" },
        { lat: "53.5511", lng: "9.9937" },
        { lat: "50.9375", lng: "6.9603" },
      ]),
    ).toBe(false);
  });

  it("does not fire on a couple of bad rows", () => {
    expect(
      looksSwapped([
        { lat: "52.5200", lng: "13.4050" },
        { lat: "53.5511", lng: "9.9937" },
        { lat: "50.9375", lng: "6.9603" },
        { lat: "150.0000", lng: "6.9603" },
      ]),
    ).toBe(false);
  });

  it("needs enough rows to be sure", () => {
    expect(looksSwapped([{ lat: "113.40", lng: "52.52" }])).toBe(false);
  });
});
