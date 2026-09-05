// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { defaultCardLayout, type CardBlock } from "@/packages/shared/card-layout";
import type { SnapshotPlace } from "@/packages/shared/snapshot";
import { buildPopup } from "./popup";

/**
 * The card a visitor gets, built from the bytes a publish wrote.
 *
 * The first test to live under `/embed`, and it is here rather than in `/lib`
 * because what it is checking is this file's own reading of a snapshot -- the
 * dashboard's twin of this card is a React tree and cannot be asked the same
 * question. `vitest.config.mts` was widened by one line to find it.
 *
 * Per-place card overrides are worth the new home. They are the one thing on a
 * card that differs *between* pins, so a bug here does not look like a bug: it
 * looks like a card, drawn correctly, for the wrong location -- on a customer's
 * site, in a file that is read forever (CLAUDE.md §7). The three cases below are
 * the whole contract: a pin with no overrides draws the shared design, a pin
 * with one draws its own, and the first is not disturbed by the second.
 */

const layout = defaultCardLayout();

const actions: CardBlock | undefined = [
  ...layout.zones.top,
  ...layout.zones.middle,
  ...layout.zones.bottom,
].find((block) => block.type === "actions");

const PHONE = "+37060000000";

const base: SnapshotPlace = {
  id: "p1",
  name: "Central store",
  lat: 54.687,
  lng: 25.28,
  address: "Gedimino pr. 1",
  phone: PHONE,
  email: "hi@example.com",
  url: "https://example.com",
};

function cardText(place: SnapshotPlace): string {
  return buildPopup(place, undefined, [], layout, []).textContent ?? "";
}

describe("buildPopup, per-place card overrides", () => {
  it("draws the shared design for a place that has singled nothing out", () => {
    const text = cardText(base);

    expect(text).toContain(PHONE);
    expect(text).toContain("Email");
    expect(text).toContain("Website");
  });

  it("drops the links one place's own card turns off", () => {
    expect(actions).toBeDefined();

    const text = cardText({
      ...base,
      cardBlocks: {
        [actions!.id]: { ...actions!, hidePhone: true, hideEmail: true },
      },
    });

    expect(text).not.toContain(PHONE);
    expect(text).not.toContain("Email");
    // The one that was left on is still there — this is a narrowing, not a
    // wholesale replacement of the row.
    expect(text).toContain("Website");
  });

  /*
   * The promise the whole feature rests on. `overrideBlock` reads the block's
   * own id, so a stored override must not follow the design onto the next pin.
   */
  it("leaves every other place on the shared design", () => {
    expect(cardText({ ...base, id: "p2" })).toContain(PHONE);
  });

  /* A block the published layout no longer has is ignored rather than drawn. */
  it("ignores an override naming a block this card does not have", () => {
    const text = cardText({
      ...base,
      cardBlocks: { gone: { id: "gone", type: "actions", hidePhone: true } },
    });

    expect(text).toContain(PHONE);
  });
});
