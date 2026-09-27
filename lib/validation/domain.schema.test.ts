import { describe, expect, it } from "vitest";

import {
  allowedDomainsSchema,
  isDomainAllowed,
  MAX_ALLOWED_DOMAINS,
  normalizeDomain,
  parseDomainEntries,
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

describe("parseDomainEntries", () => {
  it("adds one pasted URL as its bare hostname", () => {
    expect(parseDomainEntries("https://www.Example.com/shop?x=1", [])).toEqual({
      added: ["www.example.com"],
      rejected: [],
    });
  });

  it("refuses an empty entry with a reason", () => {
    const result = parseDomainEntries("   ", []);

    expect(result.added).toEqual([]);
    expect(result.rejected).toHaveLength(1);
  });

  it("refuses something that is not a domain", () => {
    const result = parseDomainEntries("not_a_domain!", []);

    expect(result.added).toEqual([]);
    expect(result.rejected[0].entry).toBe("not_a_domain!");
  });

  it("refuses a domain already on the list, after normalising it", () => {
    const result = parseDomainEntries("https://example.com/", ["example.com"]);

    expect(result.added).toEqual([]);
    expect(result.rejected[0].reason).toContain("already allowed");
  });

  it("keeps the good entries of a pasted list and reports the bad ones", () => {
    const result = parseDomainEntries("a.com, b_c, d.com\ne.com a.com", []);

    expect(result.added).toEqual(["a.com", "d.com", "e.com"]);
    expect(result.rejected.map((r) => r.entry)).toEqual(["b_c", "a.com"]);
  });

  it("stops at the ceiling", () => {
    const existing = Array.from({ length: MAX_ALLOWED_DOMAINS - 1 }, (_, i) => `d${i}.com`);
    const result = parseDomainEntries("x.com y.com", existing);

    expect(result.added).toEqual(["x.com"]);
    expect(result.rejected[0].reason).toContain(`${MAX_ALLOWED_DOMAINS}`);
  });
});
