import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND } from "@/lib/brand";
import { LEGAL_DOCUMENTS } from "./documents";
import { fillPlaceholders } from "./placeholders";
import { legalPlaceholderValues } from "./values";

/**
 * Whether a legal document is a draft decides whether a contract is shown to
 * the public, so the rule is tested here rather than eyeballed on the page.
 */

describe("fillPlaceholders", () => {
  it("fills every placeholder that has a value", () => {
    const result = fillPlaceholders("**{{name}}** at {{ website }}", {
      name: "Pinglide",
      website: "https://pinglide.com",
    });

    expect(result.text).toBe("**Pinglide** at https://pinglide.com");
    expect(result.unfilled).toEqual([]);
    expect(result.isDraft).toBe(false);
  });

  it("leaves a missing or blank value in the text, and lists it once", () => {
    const result = fillPlaceholders(
      "{{company.address}}, {{company.vatNumber}}, {{company.address}}",
      { "company.vatNumber": "   " },
    );

    expect(result.text).toBe(
      "{{company.address}}, {{company.vatNumber}}, {{company.address}}",
    );
    expect(result.unfilled).toEqual(["company.address", "company.vatNumber"]);
    expect(result.isDraft).toBe(true);
  });

  it("is still a draft while a VERIFY or provider marker remains", () => {
    for (const marker of [
      "[VERIFY: Resend log retention]",
      "Geoapify GmbH [REMOVE IF UNUSED]",
      "Cloudflare, Inc. [IF USED]",
    ]) {
      const result = fillPlaceholders(marker, {});
      expect(result.markerCount).toBe(1);
      expect(result.isDraft).toBe(true);
    }
  });
});

describe("legalPlaceholderValues", () => {
  const values = legalPlaceholderValues();

  it("reads what brand.json holds from brand.json", () => {
    expect(values.name).toBe(BRAND.name);
    expect(values["contact.supportEmail"]).toBe(BRAND.contact.supportEmail);
    expect(values["company.legalName"]).toBe(BRAND.company.legalName);
  });

  it("links the documents to one another before brand.json does", () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      const key = `legal.${doc.brandKey}`;
      expect(values[key]).toBe(
        BRAND.legal[doc.brandKey] ?? `${BRAND.website ?? ""}${doc.path}`,
      );
    }
    expect(values["legal.subprocessorsUrl"]).toMatch(
      /\/dpa#annex-iii--sub-processors$/,
    );
  });

  // A placeholder spelled differently from every key here can never be filled,
  // and would keep its document a draft forever with nothing saying why.
  it("has a key for every placeholder the documents use", () => {
    for (const doc of Object.values(LEGAL_DOCUMENTS)) {
      const markdown = readFileSync(
        path.join(process.cwd(), "documents", "legal", doc.file),
        "utf8",
      );
      const used = [...markdown.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(
        (match) => match[1],
      );

      for (const placeholder of used) {
        expect(Object.keys(values), `${doc.file}: {{${placeholder}}}`).toContain(
          placeholder,
        );
      }
    }
  });
});
