import { describe, expect, it } from "vitest";

import type { MapField, Place } from "@/lib/repositories/types";
import type { CardBlock } from "@/packages/shared/card-layout";
import type { TagChip } from "@/packages/shared/tags";
import { cardSlotOf } from "./card-slots";

/**
 * Which blocks offer to be filled in, and with what.
 *
 * Worth testing where the card's rendering is not (§9 skips UI layout): this is
 * the one place the rule lives, it is a table of thirteen block types against a
 * location's twelve fields, and getting it wrong shows up as a dashed box over
 * content that is already there — or, worse, as no invitation at all on the
 * location that most needs one.
 */

const EMPTY: Place = {
  id: "p1",
  mapId: "m1",
  name: "",
  lat: 48.8566,
  lng: 2.3522,
  address: "",
  tags: [],
  fields: {},
  icon: "",
  description: null,
  phone: null,
  email: null,
  url: null,
  hours: null,
  photoIds: [],
  photoUrls: [],
  photoUrl: null,
  logoId: null,
  logoUrl: null,
  sortOrder: 0,
  geocodeConfidence: null,
  geocodeStatus: "manual",
  addressParts: null,
  groupId: "",
  cardBlocks: {},
  createdAt: "",
  updatedAt: "",
};

const place = (over: Partial<Place> = {}): Place => ({ ...EMPTY, ...over });

const block = (over: Partial<CardBlock> & Pick<CardBlock, "type">): CardBlock => ({
  id: "b",
  ...over,
});

const FIELDS: MapField[] = [
  { id: "booking", label: "Book a fitting", type: "url", showAs: "row" },
  { id: "code", label: "Dealer code", type: "text", showAs: "row" },
];

const CHIP: TagChip = { id: "t1", label: "Bikes", color: "#1c7ed6" };

const slot = (
  b: CardBlock,
  p: Place = EMPTY,
  chips: readonly TagChip[] = [],
  fields: MapField[] = FIELDS,
) => cardSlotOf(b, p, fields, chips);

describe("cardSlotOf", () => {
  it("offers each of the plain fields when this location has none of them", () => {
    expect(slot(block({ type: "name" }))).toEqual({ kind: "name" });
    expect(slot(block({ type: "address" }))).toEqual({ kind: "address" });
    expect(slot(block({ type: "description" }))).toEqual({ kind: "description" });
    expect(slot(block({ type: "hours" }))).toEqual({ kind: "hours" });
  });

  it("offers nothing once they are filled in", () => {
    expect(slot(block({ type: "name" }), place({ name: "Vélo Nord" }))).toBeNull();
    expect(slot(block({ type: "address" }), place({ address: "12 Rue" }))).toBeNull();
    expect(
      slot(block({ type: "description" }), place({ description: "Bikes." })),
    ).toBeNull();
    expect(
      slot(
        block({ type: "hours" }),
        place({
          hours: [{ open: "09:00", close: "17:00" }, null, null, null, null, null, null],
        }),
      ),
    ).toBeNull();
  });

  // A week of seven closed days is a week nobody filled in — the same test
  // `PlaceCardHours` returns null on.
  it("reads an all-closed week as no week at all", () => {
    const closed = place({ hours: [null, null, null, null, null, null, null] });

    expect(slot(block({ type: "hours" }), closed)).toEqual({ kind: "hours" });
  });

  /*
   * The one place this parts company with `hasBlockContent`, which reports a
   * photo band as content whether or not there is a picture in it — correctly,
   * because the band is the owner's design and holds its place. A photo is
   * still the most obvious thing on a card to offer to add.
   */
  it("offers the gallery a photo, where hasBlockContent calls it filled", () => {
    expect(slot(block({ type: "gallery" }))).toEqual({ kind: "photos" });
    expect(
      slot(
        block({ type: "gallery" }),
        place({ photoUrls: ["https://x/1.jpg"], photoUrl: "https://x/1.jpg" }),
      ),
    ).toBeNull();
  });

  // Both tag blocks, the retired `category` included: it draws this location's
  // first tag, so it is missing exactly what the Tags block is.
  it("asks both tag blocks the same question", () => {
    expect(slot(block({ type: "tags" }))).toEqual({ kind: "tags" });
    expect(slot(block({ type: "category" }))).toEqual({ kind: "tags" });

    expect(slot(block({ type: "tags" }), EMPTY, [CHIP])).toBeNull();
    expect(slot(block({ type: "category" }), EMPTY, [CHIP])).toBeNull();
  });

  /*
   * Never, and each for its own reason: a mark always draws the location's pin,
   * a rule and a gap are shapes rather than content, and the retired fold holds
   * only fields that are on the card in their own right.
   */
  it("offers nothing on the blocks that are not content", () => {
    expect(slot(block({ type: "logo" }))).toBeNull();
    expect(slot(block({ type: "divider" }))).toBeNull();
    expect(slot(block({ type: "spacer" }))).toBeNull();
    expect(slot(block({ type: "details" }))).toBeNull();
  });

  describe("the Links row", () => {
    // Every location has coordinates, so a row still showing Directions is a
    // row that drew — there is no hole in the card to fill.
    it("offers nothing while the row still draws directions", () => {
      expect(slot(block({ type: "actions" }))).toBeNull();
    });

    it("offers the links the row is allowed to draw and this location lacks", () => {
      expect(slot(block({ type: "actions", hideDirections: true }))).toEqual({
        kind: "contact",
        phone: true,
        email: true,
        website: true,
      });
    });

    it("leaves out the ones its owner turned off", () => {
      expect(
        slot(
          block({ type: "actions", hideDirections: true, hideEmail: true }),
        ),
      ).toEqual({ kind: "contact", phone: true, email: false, website: true });
    });

    it("offers nothing when one of the links is already there", () => {
      expect(
        slot(
          block({ type: "actions", hideDirections: true }),
          place({ phone: "+33123456789" }),
        ),
      ).toBeNull();
    });

    // Every link the row could draw is off, so the row is empty by design
    // rather than by omission and there is nothing to invite.
    it("offers nothing on a row with everything turned off", () => {
      expect(
        slot(
          block({
            type: "actions",
            hideDirections: true,
            hidePhone: true,
            hideEmail: true,
            hideWebsite: true,
          }),
        ),
      ).toBeNull();
    });
  });

  describe("a Button", () => {
    // Directions always resolve, so a button nobody has configured is never
    // missing anything.
    it("offers nothing on the button everybody gets", () => {
      expect(slot(block({ type: "button" }))).toBeNull();
    });

    it("offers the location's own website to a link with no source", () => {
      expect(slot(block({ type: "button", buttonAction: "link" }))).toEqual({
        kind: "url",
      });

      expect(
        slot(
          block({ type: "button", buttonAction: "link" }),
          place({ url: "https://velonord.example" }),
        ),
      ).toBeNull();
    });

    it("offers the custom field it was bound to", () => {
      expect(
        slot(
          block({ type: "button", buttonAction: "link", buttonSource: "booking" }),
        ),
      ).toEqual({ kind: "field", fieldId: "booking" });

      expect(
        slot(
          block({ type: "button", buttonAction: "link", buttonSource: "booking" }),
          place({ fields: { booking: "https://booking.example" } }),
        ),
      ).toBeNull();
    });

    /*
     * Two cases with nothing to type into. A field this map does not have is
     * the documented consequence of field ids being per-map, and a `text` field
     * is never a link however it is filled in — both are fixed in the designer,
     * not on the card.
     */
    it("offers nothing it cannot fix", () => {
      expect(
        slot(block({ type: "button", buttonAction: "link", buttonSource: "gone" })),
      ).toBeNull();

      expect(
        slot(block({ type: "button", buttonAction: "link", buttonSource: "code" })),
      ).toBeNull();
    });
  });
});

/**
 * The mark, which is the one block whose slot depends on how it was *designed*
 * rather than only on what the location holds.
 */
describe("the logo block", () => {
  const logo = (mode?: "image" | "mixed"): CardBlock => ({
    id: "b",
    type: "logo",
    ...(mode ? { logoMode: mode } : {}),
  });

  it("offers nothing on Pin or Mixed, which always draw something", () => {
    expect(cardSlotOf(logo(), EMPTY, [], [])).toBeNull();
    expect(cardSlotOf(logo("mixed"), EMPTY, [], [])).toBeNull();
  });

  it("offers the upload on Logo, for a location with no mark at all", () => {
    expect(cardSlotOf(logo("image"), EMPTY, [], [])).toEqual({ kind: "logo" });
  });

  it("offers nothing once the location has a logo of its own", () => {
    expect(
      cardSlotOf(
        logo("image"),
        { ...EMPTY, logoUrl: "https://cdn.example.com/logo.png" },
        [],
        [],
      ),
    ).toBeNull();
  });

  /*
   * The pin's own image counts as a mark, because `logoImageOf` falls back to
   * it — a `+` over a block that is drawing a logo would be an invitation
   * stacked on top of content.
   */
  it("offers nothing when the pin this location wears carries an image", () => {
    expect(cardSlotOf(logo("image"), EMPTY, [], [], true)).toBeNull();
  });
});
