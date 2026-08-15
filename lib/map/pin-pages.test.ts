import { describe, expect, it } from "vitest";

import { MAX_PIN_ICONS } from "@/lib/validation/pin-icon.schema";
import { PIN_ICONS, type CustomPinIcon } from "@/packages/shared/pin-icons";
import {
  PIN_MENU_CELLS,
  PIN_MENU_PIN_CELLS,
  allPinIcons,
  pinPages,
} from "./pin-pages";

/** `n` icon ids, distinct and irrelevant — pagination never reads them. */
function icons(n: number): string[] {
  return Array.from({ length: n }, (_, index) => `icon-${index}`);
}

function customPins(n: number): CustomPinIcon[] {
  return Array.from({ length: n }, (_, index) => ({
    id: `pin${index}`,
    label: `Pin ${index}`,
    color: "#1c7ed6",
    glyph: "store",
    image: "",
  }));
}

describe("allPinIcons", () => {
  it("puts the plain pin first, then the map's own, then the built-ins", () => {
    expect(allPinIcons(customPins(2))).toEqual([
      "",
      "custom:pin0",
      "custom:pin1",
      ...PIN_ICONS.map((icon) => icon.id),
    ]);
  });

  it("still offers the plain pin and the built-ins on a map with no pins", () => {
    expect(allPinIcons([])).toEqual(["", ...PIN_ICONS.map((icon) => icon.id)]);
  });

  /*
   * The whole point of the ordering: with six visible pin slots and fifteen pins,
   * a built-in this map keeps reaching for has to beat one it has never used.
   */
  it("floats recently used pins to the front, behind the plain one", () => {
    expect(allPinIcons([], ["landmark", "bed"])).toEqual([
      "",
      "landmark",
      "bed",
      ...PIN_ICONS.map((icon) => icon.id).filter(
        (id) => id !== "landmark" && id !== "bed",
      ),
    ]);
  });

  it("offers a recent pin once, in the slot it earned", () => {
    const all = allPinIcons(customPins(2), ["custom:pin1"]);

    expect(all).toEqual([
      "",
      "custom:pin1",
      "custom:pin0",
      ...PIN_ICONS.map((icon) => icon.id),
    ]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("pinPages", () => {
  it("keeps everything on one page when it fits, spending no slot on More", () => {
    expect(pinPages(icons(PIN_MENU_PIN_CELLS))).toEqual([
      icons(PIN_MENU_PIN_CELLS),
    ]);
  });

  /*
   * The case the whole function exists for. One pin too many and the last pin cell
   * stops being a pin, so page one holds six rather than seven — the eighth cannot
   * simply push the seventh off, it has to take More's slot into account.
   */
  it("gives up a slot to More as soon as one page is not enough", () => {
    const pages = pinPages(icons(PIN_MENU_PIN_CELLS + 1));

    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(PIN_MENU_PIN_CELLS - 1);
    expect(pages[1]).toEqual(["icon-6", "icon-7"]);
  });

  /*
   * A middle page pays twice — Back in its first cell, More in its last — on top of
   * the cell New takes on all three. Fifteen is the real ceiling: one plain pin,
   * MAX_PIN_ICONS custom, six built-in.
   */
  it("pages a full map three deep, because a middle page pays for Back and More", () => {
    const all = allPinIcons(customPins(MAX_PIN_ICONS));
    expect(all).toHaveLength(15);

    const pages = pinPages(all);

    expect(pages.map((page) => page.length)).toEqual([6, 5, 4]);
    expect(pages.flat()).toEqual(all);
  });

  it("never loses or repeats a pin, at any count", () => {
    for (let count = 1; count <= 40; count += 1) {
      const all = icons(count);

      expect(pinPages(all).flat()).toEqual(all);
    }
  });

  it("leaves room for New and the navigation on every page it makes", () => {
    for (let count = 1; count <= 40; count += 1) {
      const pages = pinPages(icons(count));

      pages.forEach((page, index) => {
        const back = index === 0 ? 0 : 1;
        const more = index === pages.length - 1 ? 0 : 1;

        // The `+ 1` is New, which is on every page.
        expect(page.length + back + more + 1).toBeLessThanOrEqual(PIN_MENU_CELLS);
      });
    }
  });
});
