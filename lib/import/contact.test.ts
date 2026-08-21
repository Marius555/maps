import { describe, expect, it } from "vitest";
import { z } from "zod";

import { normalizeEmail, normalizeUrl } from "./contact";

/** The exact rule the server applies, so these tests can't drift from it. */
const url = z.url();
const email = z.email();

describe("normalizeUrl", () => {
  it("adds a scheme to a bare domain", () => {
    // The case that broke a real import: every row in the file wrote its site
    // this way, and z.url() rejects all of them.
    expect(normalizeUrl("www.equinox.com")).toBe("https://www.equinox.com");
    expect(normalizeUrl("barnesandnoble.com")).toBe("https://barnesandnoble.com");
    expect(normalizeUrl("sweetgreen.com/menu")).toBe("https://sweetgreen.com/menu");
  });

  it("leaves a real URL alone", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
    expect(normalizeUrl("http://example.com/a?b=1")).toBe("http://example.com/a?b=1");
  });

  it("trims", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com");
  });

  it("drops junk rather than inventing a link", () => {
    // new URL("https://N/A") parses happily, reading "n" as the host — so
    // without the domain guard these would all import as broken links.
    for (const junk of ["N/A", "-", "none", "call us", "TBC", ""]) {
      expect(normalizeUrl(junk)).toBe("");
    }
  });

  it("produces something the server's own schema accepts", () => {
    // The point of the whole module. If this ever fails, the import is sending
    // values that will come back as "Check the highlighted fields".
    for (const raw of [
      "www.equinox.com",
      "barnesandnoble.com",
      "sweetgreen.com/menu",
      "https://example.com",
      "example.co.uk",
    ]) {
      expect(url.safeParse(normalizeUrl(raw)).success).toBe(true);
    }
  });
});

describe("normalizeEmail", () => {
  it("keeps a valid address", () => {
    expect(normalizeEmail("hi@example.com")).toBe("hi@example.com");
    expect(normalizeEmail("  hi@example.com ")).toBe("hi@example.com");
  });

  it("strips a mailto: prefix", () => {
    // Normal in an XML feed exported from a CMS.
    expect(normalizeEmail("mailto:hi@example.com")).toBe("hi@example.com");
  });

  it("drops anything that isn't an address", () => {
    for (const junk of ["N/A", "-", "ask in store", "hi@", "@example.com", ""]) {
      expect(normalizeEmail(junk)).toBe("");
    }
  });

  it("produces something the server's own schema accepts", () => {
    for (const raw of ["hi@example.com", "mailto:a.b+c@sub.example.co.uk"]) {
      expect(email.safeParse(normalizeEmail(raw)).success).toBe(true);
    }
  });
});
