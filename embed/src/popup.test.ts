// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  defaultCardLayout,
  type CardBlock,
  type CardLayout,
} from "@/packages/shared/card-layout";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { SnapshotPlace } from "@/packages/shared/snapshot";
import type { TagChip } from "@/packages/shared/tags";
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
/*
 * What the website row actually says.
 *
 * Not the word "Website": the Links row draws a site as its host and path, which
 * is the studio's own label (`Actions` in components/card/card-block.tsx) and is
 * what this row was changed to draw when the two renderers were reconciled.
 */
const SITE = "example.com";

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
    expect(text).toContain(SITE);
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
    expect(text).toContain(SITE);
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

/**
 * Where a card's colours come from, and the one thing that must be true of
 * them: **the card and the marker it opened off agree**.
 *
 * Two blocks read the pin's colour and they read it through different
 * mechanisms — the Logo writes `--pin-color` for an SVG fill, the Button writes
 * `--lm-button-bg` for a background — so the bug this guards against is not a
 * card that fails to draw. It is a card drawn perfectly in the wrong colour,
 * beside a pin in the right one, on a customer's site.
 *
 * The ladder under test is `colorOf` in map.ts, restated for the popup in
 * `BlockContext.pinColor`: a group's answer, then the custom pin's own, then
 * the first tag's. `place.color` is how a group reaches a snapshot at all — it
 * is written only when one actually decided (lib/snapshot/build.ts).
 */
const COLOURED: CardLayout = {
  ...layout,
  zones: {
    top: [{ id: "logo", type: "logo" }],
    middle: [{ id: "name", type: "name" }],
    // No `buttonAction`, so it is a Directions button — which needs nothing of
    // the place but its coordinates and therefore always draws.
    bottom: [{ id: "cta", type: "button" }],
  },
};

const CUSTOM_PIN: CustomPinIcon = {
  id: "ab12cd34",
  label: "Store",
  color: "#7048e8",
  glyph: "store",
  image: "",
};

function colours(
  place: SnapshotPlace,
  tagChips: TagChip[] = [],
  pins: readonly CustomPinIcon[] = [],
): { logo: string; button: string } {
  const card = buildPopup(place, undefined, [], COLOURED, pins, tagChips);
  const logo = card.querySelector<HTMLElement>(".lm-popup__logo");
  const button = card.querySelector<HTMLElement>(".lm-popup__button");

  expect(logo).not.toBeNull();
  expect(button).not.toBeNull();

  return {
    logo: logo?.style.getPropertyValue("--pin-color") ?? "",
    button: button?.style.getPropertyValue("--lm-button-bg") ?? "",
  };
}

const TAG: TagChip = { id: "t1", label: "Stockist", color: "#2f9e44" };

describe("buildPopup, the pin's colour on the card", () => {
  it("takes a group's colour, on both blocks at once", () => {
    // `place.color` out-ranks the custom pin *and* the tag, which is the only
    // case a card could not work out for itself — a snapshot carries no groups.
    const { logo, button } = colours(
      { ...base, color: "#e8590c", icon: "custom:ab12cd34" },
      [TAG],
      [CUSTOM_PIN],
    );

    expect(logo).toBe("#e8590c");
    expect(button).toBe("#e8590c");
  });

  it("takes a custom pin's own colour over its first tag", () => {
    const { logo, button } = colours(
      { ...base, icon: "custom:ab12cd34" },
      [TAG],
      [CUSTOM_PIN],
    );

    expect(logo).toBe(CUSTOM_PIN.color);
    expect(button).toBe(CUSTOM_PIN.color);
  });

  it("falls to the first tag for a place wearing a built-in pin", () => {
    const { logo, button } = colours({ ...base, icon: "store" }, [TAG]);

    expect(logo).toBe(TAG.color);
    expect(button).toBe(TAG.color);
  });

  /*
   * §7, and the reason this file exists. A place the map says nothing about
   * leaves both properties unwritten, so the stylesheet's own chains answer —
   * `--lm-pin` for the pin, `--lm-focus` for the button — exactly as they did
   * on every card published before any of this.
   */
  it("writes nothing at all for a place the map says nothing about", () => {
    const { logo, button } = colours(base);

    expect(logo).toBe("");
    expect(button).toBe("");
  });

  /*
   * A colour the owner chose beats the pin on the button and **only** on the
   * button: the Logo block draws the pin itself, so there is nothing there for
   * a button's ground to override.
   */
  it("lets a designed button colour win, and leaves the logo on the pin", () => {
    const card = buildPopup(
      base,
      undefined,
      [],
      {
        ...COLOURED,
        zones: {
          ...COLOURED.zones,
          bottom: [{ id: "cta", type: "button", buttonBackground: "#f54600" }],
        },
      },
      [],
      [TAG],
    );

    expect(
      card
        .querySelector<HTMLElement>(".lm-popup__button")
        ?.style.getPropertyValue("--lm-button-bg"),
    ).toBe("#f54600");
    expect(
      card
        .querySelector<HTMLElement>(".lm-popup__logo")
        ?.style.getPropertyValue("--pin-color"),
    ).toBe(TAG.color);
  });
});
