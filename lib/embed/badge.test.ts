import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BADGE_MARK, publishBadge } from "./badge";

describe("publishBadge", () => {
  it("draws the same mark as the public logo file", () => {
    const file = readFileSync(join(process.cwd(), "public/logo/pinglide-mark.svg"), "utf8");
    const shapes = (svg: string) => svg.match(/<(path|circle)[^>]*>/g);

    expect(shapes(BADGE_MARK)).toEqual(shapes(file));
  });

  it("ships the mark as a data URI, never a URL on our own host", () => {
    const logo = publishBadge()?.logo ?? "";

    expect(logo.startsWith("data:image/svg+xml,")).toBe(true);
    expect(decodeURIComponent(logo.slice(logo.indexOf(",") + 1))).toBe(BADGE_MARK);
  });
});
