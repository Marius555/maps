import { describe, expect, it } from "vitest";

import {
  DIRECTIONS_LABEL,
  WEBSITE_LABEL,
  buttonTargetOf,
  type CardButtonField,
  type CardButtonPlace,
} from "./card-button";
import type { CardBlock } from "./card-layout";

/**
 * Where a Button block points, per location.
 *
 * This is the one function three renderers share — the studio canvas, the
 * editor's own place card and the embed's popup — so a mistake here is a button
 * that goes somewhere else on a customer's site than it does in the studio. None
 * of the three has tests of its own.
 *
 * `navigator` is absent under vitest's node environment, which is deliberately
 * left alone: `isApplePlatform` guards on exactly that and the Google answer is
 * what every non-Apple visitor gets, so these assertions describe the common
 * case rather than the branch.
 */

const button = (block: Partial<CardBlock>): CardBlock => ({
  id: "a",
  type: "button",
  ...block,
});

const place: CardButtonPlace = {
  name: "Vélo Nord",
  lat: 48.8566,
  lng: 2.3522,
  url: "https://velonord.example",
  fields: {
    booking: "https://booking.example/velo-nord",
    workshop: "+33123456789",
    code: "FR-114",
  },
};

const FIELDS: CardButtonField[] = [
  { id: "booking", label: "Book a fitting", type: "url" },
  { id: "workshop", label: "Workshop", type: "tel" },
  { id: "desk", label: "Front desk", type: "email" },
  { id: "code", label: "Dealer code", type: "text" },
];

describe("buttonTargetOf", () => {
  /*
   * Absent is directions, and this is the assertion that pins it: a Button
   * dragged onto the card has to work before anybody configures it, and every
   * location has coordinates while not every one has a URL.
   */
  it("routes a button nobody has configured", () => {
    const target = buttonTargetOf(button({}), place, FIELDS);

    expect(target?.href).toContain("google.com/maps/dir");
    // Coordinates, never the name — a stockist inside a department store
    // resolves to the department store.
    expect(target?.href).toContain("48.8566,2.3522");
    expect(target?.label).toBe(DIRECTIONS_LABEL);
  });

  it("reads the location's own website when link mode names no source", () => {
    const target = buttonTargetOf(button({ buttonAction: "link" }), place, []);

    expect(target?.href).toBe("https://velonord.example/");
    expect(target?.label).toBe(WEBSITE_LABEL);
  });

  it("reads a custom field, and calls the button by that field's name", () => {
    const target = buttonTargetOf(
      button({ buttonAction: "link", buttonSource: "booking" }),
      place,
      FIELDS,
    );

    // The field's label rather than its value, which is what the card's CTA
    // rows have always done: a URL's value is forty characters of tracking.
    expect(target).toEqual({
      href: "https://booking.example/velo-nord",
      label: "Book a fitting",
    });
  });

  it("follows the field's own type into a tel: or a mailto:", () => {
    expect(
      buttonTargetOf(
        button({ buttonAction: "link", buttonSource: "workshop" }),
        place,
        FIELDS,
      )?.href,
    ).toBe("tel:+33123456789");

    expect(
      buttonTargetOf(
        button({ buttonAction: "link", buttonSource: "desk" }),
        { ...place, fields: { desk: "shop@velonord.example" } },
        FIELDS,
      )?.href,
    ).toBe("mailto:shop@velonord.example");
  });

  it("lets a label the owner typed win over every default", () => {
    expect(
      buttonTargetOf(button({ buttonLabel: "Take me there" }), place, FIELDS)
        ?.label,
    ).toBe("Take me there");

    expect(
      buttonTargetOf(
        button({
          buttonAction: "link",
          buttonSource: "booking",
          buttonLabel: "Book now",
        }),
        place,
        FIELDS,
      )?.label,
    ).toBe("Book now");
  });

  /*
   * `null` is the common case worth designing for, not an error path. One layout
   * has to be right for three thousand locations that are each filled in
   * differently, so a button to a booking page is only a button on the locations
   * that have one — everywhere else the block draws nothing and takes no space,
   * which is the rule every other block already follows.
   */
  it("goes nowhere for a location that left the field blank", () => {
    const bare: CardButtonPlace = { name: "Depot", lat: 1, lng: 2 };

    expect(
      buttonTargetOf(
        button({ buttonAction: "link", buttonSource: "booking" }),
        bare,
        FIELDS,
      ),
    ).toBeNull();

    expect(buttonTargetOf(button({ buttonAction: "link" }), bare, [])).toBeNull();
  });

  it("goes nowhere for a source the map no longer has", () => {
    // The consequence of a layout saved per *account* against field ids that
    // are per *map*: on a map with no such field the button simply is not there,
    // which is the same thing it does for a location that left it blank.
    expect(
      buttonTargetOf(
        button({ buttonAction: "link", buttonSource: "gone" }),
        place,
        FIELDS,
      ),
    ).toBeNull();
  });

  it("goes nowhere for a field that is not a link at all", () => {
    // A control that cannot be pressed is worse than one that is not there —
    // the one place this differs from the Links row's CTA rows, which draw a
    // typeless field as plain text rather than dropping what the owner wrote.
    expect(
      buttonTargetOf(
        button({ buttonAction: "link", buttonSource: "code" }),
        place,
        FIELDS,
      ),
    ).toBeNull();
  });

  it("refuses a scheme that is not http or https", () => {
    // Customer input, written into an `href` on a stranger's page.
    for (const url of ["javascript:alert(1)", "data:text/html,x", "not a url"]) {
      expect(
        buttonTargetOf(button({ buttonAction: "link" }), { ...place, url }, []),
      ).toBeNull();
    }
  });
});
