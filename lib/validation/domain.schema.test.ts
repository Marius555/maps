import { describe, expect, it } from "vitest";

import {
  allowedDomainsSchema,
  isDomainAllowed,
  normalizeDomain,
} from "./domain.schema";

describe("normalizeDomain", () => {
  it("keeps a bare hostname as it is", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
  });

  it("accepts what people actually paste out of the address bar", () => {
    // Every one of these is a real thing a customer will type into the field.
    expect(normalizeDomain("https://www.example.com/shops?page=2")).toBe(
      "www.example.com",
    );
    expect(normalizeDomain("http://example.com/")).toBe("example.com");
    expect(normalizeDomain("  Example.COM  ")).toBe("example.com");
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("handles localhost with a port, which is how anyone tests an embed", () => {
    expect(normalizeDomain("http://localhost:3000")).toBe("localhost");
  });
});

describe("allowedDomainsSchema", () => {
  it("normalises and deduplicates entries", () => {
    const result = allowedDomainsSchema.parse([
      "https://example.com",
      "example.com/",
      "EXAMPLE.com",
    ]);

    expect(result).toEqual(["example.com"]);
  });

  it("rejects something that isn't a domain", () => {
    expect(() => allowedDomainsSchema.parse(["not a domain"])).toThrow();
    expect(() => allowedDomainsSchema.parse([""])).toThrow();
  });

  it("accepts an empty list, which means anywhere", () => {
    expect(allowedDomainsSchema.parse([])).toEqual([]);
  });
});

describe("isDomainAllowed", () => {
  it("allows anything when the list is empty", () => {
    expect(isDomainAllowed("anyone.example", [])).toBe(true);
  });

  it("matches the exact host", () => {
    expect(isDomainAllowed("example.com", ["example.com"])).toBe(true);
  });

  it("matches subdomains of an allowed domain", () => {
    // Making a customer add the www separately is a support ticket, not a
    // safeguard.
    expect(isDomainAllowed("www.example.com", ["example.com"])).toBe(true);
    expect(isDomainAllowed("shop.eu.example.com", ["example.com"])).toBe(true);
  });

  it("does not match a domain that merely ends with the same letters", () => {
    // The failure that matters: "notexample.com" must not pass "example.com".
    expect(isDomainAllowed("notexample.com", ["example.com"])).toBe(false);
  });

  it("does not treat an allowed subdomain as allowing its parent", () => {
    expect(isDomainAllowed("example.com", ["shop.example.com"])).toBe(false);
  });

  it("compares case-insensitively", () => {
    expect(isDomainAllowed("WWW.Example.COM", ["example.com"])).toBe(true);
  });
});
