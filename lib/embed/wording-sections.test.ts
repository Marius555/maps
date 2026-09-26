import { describe, expect, it } from "vitest";

import { EMBED_STRING_KEYS } from "@/packages/shared/embed-strings";

import { WORDING_SECTIONS } from "./wording-sections";

describe("WORDING_SECTIONS", () => {
  it("offers every phrase the embed says, once", () => {
    const keys = WORDING_SECTIONS.flatMap((section) =>
      section.fields.map((field) => field.key),
    );

    expect([...keys].sort()).toEqual([...EMBED_STRING_KEYS].sort());
  });
});
