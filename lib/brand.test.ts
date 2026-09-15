import { describe, expect, it } from "vitest";

import raw from "@/brand.json";
import { parseBrand } from "./brand";

/**
 * brand.json is edited by hand and read by every page, so the one thing worth
 * testing is that a bad edit is caught at build time with the field named —
 * and that a blank one switches its link off rather than drawing it empty.
 */

const MINIMAL = { name: "Acme Maps", tagline: "Maps for shops." };

describe("parseBrand", () => {
  it("accepts the committed brand.json", () => {
    expect(() => parseBrand(raw)).not.toThrow();
  });

  it("reads an empty or blank string as not set", () => {
    const brand = parseBrand({
      ...MINIMAL,
      logo: { light: "" },
      contact: { supportEmail: "" },
      legal: { termsUrl: "   " },
    });

    expect(brand.logo.light).toBeUndefined();
    expect(brand.contact.supportEmail).toBeUndefined();
    expect(brand.legal.termsUrl).toBeUndefined();
  });

  it("fills in a section that is missing entirely", () => {
    const brand = parseBrand(MINIMAL);

    expect(brand.legal.privacyUrl).toBeUndefined();
    expect(brand.company.legalName).toBeUndefined();
  });

  it("accepts a full address and a path to a file in /public", () => {
    const brand = parseBrand({
      ...MINIMAL,
      logo: { light: "/brand/logo.svg", dark: "https://cdn.example.com/logo-dark.png" },
      legal: { termsUrl: " https://example.com/terms " },
    });

    expect(brand.logo.light).toBe("/brand/logo.svg");
    expect(brand.logo.dark).toBe("https://cdn.example.com/logo-dark.png");
    expect(brand.legal.termsUrl).toBe("https://example.com/terms");
  });

  it.each([
    "terms",
    "ftp://example.com/terms",
    "//elsewhere.example/terms",
    "javascript:alert(1)",
  ])("rejects %j as a link, naming the field", (value) => {
    expect(() => parseBrand({ ...MINIMAL, legal: { termsUrl: value } })).toThrow(
      /legal\.termsUrl/,
    );
  });

  it("rejects a malformed support email, naming the field", () => {
    expect(() =>
      parseBrand({ ...MINIMAL, contact: { supportEmail: "support at acme" } }),
    ).toThrow(/contact\.supportEmail/);
  });

  it("rejects a misspelt key instead of ignoring it", () => {
    expect(() =>
      parseBrand({ ...MINIMAL, legal: { termUrl: "https://example.com/terms" } }),
    ).toThrow(/termUrl/);
  });

  it("asks for a light logo when only a dark one is set", () => {
    expect(() =>
      parseBrand({ ...MINIMAL, logo: { dark: "/brand/logo-dark.png" } }),
    ).toThrow(/logo\.light/);
  });

  it("requires a name", () => {
    expect(() => parseBrand({ ...MINIMAL, name: " " })).toThrow(/name/);
  });
});
