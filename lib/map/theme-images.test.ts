import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CONCRETE_MAP_STYLES } from "./style";
import { THEME_IMAGE_FILE_NAMES, themeImagesFor } from "./theme-images";

/**
 * The maps list draws these files with no fallback, so a missing one is a broken
 * image in the product. A theme added without regenerating fails here instead —
 * open `/dev/map-themes` (or `?run=1`) and commit what it writes.
 */
describe("theme images", () => {
  const directory = path.join(process.cwd(), "public", "map-themes");

  it.each([...THEME_IMAGE_FILE_NAMES])("%s is committed", (name) => {
    expect(existsSync(path.join(directory, name))).toBe(true);
  });

  it("covers every style a map can be set to", () => {
    for (const style of ["auto" as const, ...CONCRETE_MAP_STYLES]) {
      const { light, dark } = themeImagesFor(style);
      for (const name of [light, dark].filter(Boolean)) {
        expect(THEME_IMAGE_FILE_NAMES.has(`${name}.webp`)).toBe(true);
      }
    }
  });
});
