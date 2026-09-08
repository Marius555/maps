import {
  DAY_LABELS,
  DAY_LABELS_SHORT,
  dayIndex,
  formatDay,
  isEmptyHours,
  isOpenNow,
} from "@/packages/shared/hours";
import { formatDistance, formatDuration, pathLengthM } from "@/packages/shared/geo";
import { buttonTargetOf } from "@/packages/shared/card-button";
import { directionsLink } from "./directions";
import type { Fix } from "./search";
import { overrideBlock } from "@/packages/shared/card-overrides";
import {
  CARD_ZONES,
  blockBox,
  buttonStyleOf,
  cardRowBox,
  cardRows,
  chipStyleOf,
  justifyOf,
  defaultCardLayout,
  logoImageOf,
  logoRadiusOf,
  detailsContents,
  leadBox,
  rowOffsetHolder,
  upwardLiftOf,
  type CardBlock,
  type CardBlockType,
  type CardLayout,
  type CardRow,
} from "@/packages/shared/card-layout";
import {
  pinCssVars,
  pinSvg,
  resolvePin,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";
import type {
  SnapshotCategory,
  SnapshotField,
  SnapshotPlace,
  SnapshotShape,
} from "@/packages/shared/snapshot";
import { pinColorOfChips, type TagChip } from "@/packages/shared/tags";

import { button, el, icon, link } from "./dom";

/**
 * The card shown when a visitor clicks a pin.
 *
 * Built as DOM nodes rather than an HTML string. Every field here is customer
 * text landing on a third party's page, and `textContent` makes injection
 * impossible rather than merely unlikely.
 *
 * **The order is the owner's, not ours.** This was a fixed sequence written
 * here; it is now a walk over the layout they built in the dashboard
 * (packages/shared/card-layout.ts). Nothing about the designer ships to a
 * visitor — the layout arrives already resolved and clamped inside the
 * snapshot, so this only ever has to draw one.
 *
 * **Four things visible and the rest folded away** is still the shape of the
 * default, and the reasoning is worth keeping: a location with a photo, a
 * paragraph of description, seven rows of opening hours and three extra fields
 * produced a card taller than the map it floats over, so opening a pin near the
 * top of the frame showed a card with its own name off screen. What a visitor is
 * deciding is *which* of these places to go to, and that is answered by the
 * picture, the name, what kind of place it is and where it is; the rest is what
 * they read once they have chosen, one click behind "More details". An owner who
 * drags the description out of the fold is choosing a taller card knowingly.
 *
 * A block this location has no data for renders nothing and takes no space,
 * which is what makes one layout safe across three thousand locations that are
 * each filled in differently.
 */
export function buildPopup(
  place: SnapshotPlace,
  /**
   * Legacy, read-only: the category this place wore on a snapshot published
   * before categories became tags. Undefined on every file published since, and
   * read by exactly one builder — the retired `category` block, which such a
   * file's own `cardLayout` may still name (§7 keeps it drawing).
   */
  category: SnapshotCategory | undefined,
  fields: SnapshotField[] = [],
  /**
   * Absent on every snapshot published before the designer existed, and on every
   * map whose owner has never opened it — both of which must keep rendering
   * exactly the card they always did (CLAUDE.md §7).
   */
  layout: CardLayout = defaultCardLayout(),
  /**
   * The map's own pins, which is where a Logo block's picture comes from.
   *
   * Defaulted, like `layout` above and for the same reason: every snapshot
   * published before the block existed has none, and a card with no logo on it
   * never asks.
   */
  pins: readonly CustomPinIcon[] = [],
  /**
   * This location's tags, resolved once per map by the caller and **in the
   * location's own order** — the first is what colours its pin.
   *
   * Defaulted like `layout` and `pins` above and for the same reason: every
   * snapshot published before this block existed carries no `tagGroups`, and
   * must keep rendering exactly the card it always did (CLAUDE.md §7).
   */
  tagChips: readonly TagChip[] = [],
  /**
   * Where the visitor is, for this card's Directions links.
   *
   * Defaulted for the reason `layout`, `pins` and `tagChips` above are: absent
   * is the link every card has always drawn, so nothing published moves and the
   * dashboard's own preview — which has no visitor to locate — needs no
   * argument.
   */
  me: Fix | null = null,
): HTMLElement {
  // `--place`, because the fixed box that class carries belongs to a location
  // card alone: a shape holds a name and a sentence and is meant to be smaller
  // (see `buildShapePopup`).
  const root = el("div", "lm-popup lm-popup--place");
  // Which location this card is for, for the one delegated listener that counts
  // link presses across both the card and the results list (embed/src/track.ts).
  // An attribute rather than a closure because that listener lives on the root
  // and never sees the builder that made the row it was clicked in.
  root.dataset.lmPlace = place.id;
  /*
   * `width`, not only `maxWidth`, and that one word is a real bug fixed.
   *
   * A popup is content-sized, so with a cap alone a location with a short
   * address and one link drew at 133px — the same saved design at a different
   * size on every pin, and at no size the studio ever showed. The cap stays
   * beside it for the frame that is narrower than the card.
   */
  root.style.width = `${String(layout.width)}px`;
  root.style.maxWidth = `${String(layout.width)}px`;

  /*
   * The legacy category, folded in as the first chip.
   *
   * A snapshot published before categories became tags carries *both*: colourless
   * `tagGroups` and a `category`. Drawing `tagChips` alone would silently drop the
   * one chip such a card has always shown — the coloured one that explains the
   * pin — from every map already live on a customer's site (§7). Folded in here
   * rather than branched on inside each builder, so the dot, the logo's fallback
   * colour and the retired Category block all get the same answer.
   *
   * Skipped when the layout names a Category block of its own, which would then
   * draw the same chip a second time. Unreachable while the card designer is off
   * (nothing publishes a `cardLayout` at all), and one boolean is cheaper than
   * finding out it was reachable after all.
   */
  const hasCategoryBlock = CARD_ZONES.some((zone) =>
    layout.zones[zone].some((block) => block.type === "category"),
  );

  const chips: TagChip[] =
    category && !hasCategoryBlock && !pinColorOfChips(tagChips)
      ? [
          { id: category.id, label: category.label, color: category.color },
          ...tagChips,
        ]
      : [...tagChips];

  const context: BlockContext = {
    place,
    category,
    fields,
    tagChips: chips,
    pinColor: pinColorOfChips(chips),
    pins,
    folded: detailsContents(layout),
    me,
  };

  for (const zone of CARD_ZONES) {
    const section = el("div", `lm-popup__zone lm-popup__zone--${zone}`);

    /*
     * Every block the layout names, drawn or not.
     *
     * A builder returning null used to drop the block, the way `CardView` used
     * to filter — so a location that filled in less than the next one got a
     * card whose blocks sat somewhere else, at positions its owner had never
     * been shown. An empty block now keeps its box, its padding and the gap
     * after it, and pairing runs over all of them, so the lines a visitor sees
     * are the lines the studio drew. `renderZone` in
     * components/card/card-view.tsx is the same change on the other side.
     */
    const built: { block: CardBlock; node: HTMLElement }[] = [];

    /*
     * This location's own card, where it has one.
     *
     * `overrideBlock` hands the design's own block straight back for every
     * location nobody singled out, which is nearly all of them, so a map with no
     * overrides in it does exactly what it did before this existed. It runs
     * here, on the pairing's own input, because a width or an overlap decides
     * how blocks pair into lines -- overriding after `cardRows` below would draw
     * a line the pairing never agreed to.
     *
     * What is published is already narrowed and clamped (`publishedCardBlocks`
     * in lib/snapshot/build.ts), which is why the whole of the embed's side of
     * this is one lookup.
     */
    for (const raw of layout.zones[zone]) {
      const block = overrideBlock(raw, place.cardBlocks);

      /*
       * A type this build does not have a builder for.
       *
       * The embed draws `snapshot.cardLayout` **as it was published**, without
       * running it back through `resolveCardLayout` (embed/src/map.ts) — which
       * is what keeps a card live on a customer's site drawing what it drew.
       * The other half of that bargain is this line: a block kind we have since
       * retired is still in those bytes, and indexing a table that no longer
       * has the key would throw on a stranger's page rather than skip one
       * block. `fields` is the one that has gone so far.
       */
      const build = BUILDERS[block.type] as BlockBuilder | undefined;
      if (!build) continue;

      // The floor an empty block holds — see `.lm-popup__block--empty` in
      // styles.css, and `.card-block--empty`, its opposite number.
      const node = build(context, block) ?? el("div", "lm-popup__block--empty");
      built.push({ block, node });
    }

    for (const row of cardRows(built.map((entry) => entry.block), layout)) {
      const wrapped = row.blocks.map((block, i) =>
        /*
         * Where this block's **line** sits among the ones that actually drew
         * something, which is what "first" and "last" have to mean. The list is
         * the same one `CardView` counts, so a logo at the top of a zone on a
         * location with no photo behaves the same in both renderers — and it is
         * the *line's* ends rather than the block's own, because a block is
         * pulled over the line above it and every member of the top line has the
         * same nothing above it. Only the overlap reads them. See `upwardLiftOf`
         * in packages/shared/card-layout.ts.
         */
        wrapBlock(
          block,
          built[row.index + i].node,
          layout,
          row.index === 0,
          row.end === built.length,
          row.shared,
        ),
      );

      /*
       * The line's leading space, as a box of its own that gives way — see
       * `leadBox` in packages/shared/card-layout.ts. It used to be a
       * `margin-top` on the line, which cannot shrink: a week of opening hours
       * a visitor opened pushed everything under it off the bottom of the card
       * rather than closing up the gap above it.
       */
      const lead = rowOffsetHolder(row.blocks)?.offset ?? 0;
      if (lead > 0) section.append(buildLead(lead, layout));

      section.append(row.shared ? wrapRow(row, layout, wrapped) : wrapped[0]);
    }

    /*
     * Every zone, including one this location fills in nothing for.
     *
     * The middle zone is the `flex: 1 1 0%` item, so it is what holds the
     * bottom strip against the bottom of the card. Dropping it — which is what
     * this line used to do — left a card whose owner had put a button at the
     * bottom drawing that button halfway up. An empty zone draws nothing and
     * pays no padding (`:not(:empty)` in styles.css, and the classes below).
     */
    root.append(section);
  }

  /*
   * The card's vertical padding belongs to the zones that actually drew, not to
   * the ones named top and bottom.
   *
   * The dashboard's `zoneClass` (components/card/card-frame.tsx) carries the
   * argument in full; the short of it is that a location with no photo and no
   * contact details loses both end zones and, with them, every pixel of
   * vertical padding — leaving its name flush against the top edge of a card
   * seventy pixels tall. With all three zones present these classes land on the
   * top and the bottom, which is why no populated card moves.
   *
   * Every zone is in the DOM now, so "the zones that drew" is the ones with
   * children in them rather than the ones that got appended.
   *
   * The `--top` / `--bottom` classes stay exactly as they were: the bleed rules
   * key off them, and a zone with blocks in it is the first one anyway.
   */
  const drawn = [...root.children].filter((zone) => zone.childElementCount > 0);
  if (drawn.length > 0) {
    drawn[0].classList.add("lm-popup__zone--pad-top");
    drawn[drawn.length - 1].classList.add("lm-popup__zone--pad-bottom");
  }

  return root;
}

/** Everything a block builder is allowed to know about. */
type BlockContext = {
  place: SnapshotPlace;
  /** Legacy, read-only — see `buildPopup`. */
  category: SnapshotCategory | undefined;
  fields: SnapshotField[];
  /**
   * This location's tags, already resolved, in the location's own order — with a
   * pre-merge snapshot's category folded in at the front (see `buildPopup`).
   *
   * Resolved rather than ids plus the map's vocabulary, because the resolution
   * is one lookup for the whole map and `map.ts` already builds one there —
   * doing it per popup would walk sixty tags every time somebody clicks a pin.
   * It is also what keeps this and the dashboard's `CardBlockData` taking the
   * same input, which is what stops the preview panel showing two different sets
   * of chips beside each other.
   */
  tagChips: readonly TagChip[];
  /**
   * The colour this location's pin took, so exactly one chip can be marked as
   * its source. Worked out once per popup rather than per chip.
   */
  pinColor: string | undefined;
  /** The map's pins — what a Logo block draws. */
  pins: readonly CustomPinIcon[];
  /** What "More details" holds — whatever was not pulled onto the card itself. */
  folded: CardBlockType[];
  /**
   * Where the visitor is, if the browser has said — the start point for every
   * Directions link on this card. Null is the link this card has always drawn,
   * which is what a visitor who has granted nothing still gets. See `me` in
   * index.ts for why this is not the list's measuring origin.
   */
  me: Fix | null;
};

/**
 * One builder per block type, each returning null when this location has nothing
 * to put in it.
 *
 * A table rather than a switch because `buildMore` indexes into it too: the fold
 * holds the same blocks the card does, so both are built by the same code and
 * cannot drift into two versions of a description.
 */
type BlockBuilder = (
  context: BlockContext,
  /**
   * The block itself, for the two builders with options of their own. Optional
   * because the fold builds a type with no block behind it — see `buildMore`,
   * and `Details` in components/card/card-block.tsx, which passes the same
   * nothing.
   */
  block?: CardBlock,
) => HTMLElement | null;

const BUILDERS: Record<CardBlockType, BlockBuilder> = {
  gallery: (context) => buildGallery(photosOf(context.place)),
  logo: (context, block) =>
    buildLogo(
      context.place,
      // The first tag's colour, falling back to the legacy category's for a
      // snapshot published before the two merged.
      context.pinColor ?? context.category?.color,
      context.pins,
      block,
    ),
  name: (context) => el("h3", "lm-popup__name", context.place.name),
  /*
   * The retired Category block, on a snapshot old enough to name it.
   *
   * Two files can reach here and they carry different things. One published
   * before categories became tags has a `category` and no `tagGroups`, so the
   * legacy branch answers; one published after has tags and its layout only
   * names this block if its owner arranged the card back then, in which case the
   * nearest true thing is the tag that now colours the pin — which is what a
   * category was. Either way it is one chip, which is what the block is.
   */
  category: (context, block) => {
    if (context.category) {
      return buildTags([context.category], block);
    }

    return context.tagChips.length > 0
      ? buildTags(context.tagChips.slice(0, 1), block)
      : null;
  },
  tags: (context, block) =>
    context.tagChips.length > 0 ? buildTags(context.tagChips, block) : null,
  address: (context) =>
    context.place.address
      ? el("p", "lm-popup__address", context.place.address)
      : null,
  description: (context, block) =>
    context.place.description
      ? buildDescription(context.place.description, block)
      : null,
  hours: (context, block) => buildHours(context.place, block),
  details: (context) => buildMore(context),
  actions: (context, block) =>
    buildActions(context.place, context.fields, block, context.me),
  button: (context, block) =>
    block ? buildButton(context.place, context.fields, block, context.me) : null,
  divider: () => el("div", "lm-popup__divider"),
  spacer: () => el("div", "lm-popup__spacer"),
};

/**
 * A row of pills, wearing whatever the owner made of them.
 *
 * The twin of `TagChips` in components/card/card-block.tsx, built by hand
 * because the embed must not ship React (§4). What has to match is *what a chip
 * is*, not how the DOM is made — which is why the three values come from
 * `chipStyleOf` in packages/shared rather than being read off the block here.
 * Nothing is written for a block nobody has styled, so `.lm-popup__tag`'s own
 * rule stays in charge and a card published years ago draws what it drew.
 *
 * No chip carries a colour dot. The first one used to, saying which tag the pin
 * outside the popup had taken its colour from; it read as a stray bubble inside
 * a pill whose colours are now the owner's to choose, and the pin it explains is
 * on screen right beside the card.
 */
function buildTags(
  chips: readonly TagChip[],
  /**
   * Absent inside the fold, which builds a type with no block behind it to have
   * been styled — see `BlockBuilder`. Unstyled is the right answer there.
   */
  block?: CardBlock,
): HTMLElement {
  const row = el("div", "lm-popup__tags");
  const chip = block ? chipStyleOf(block) : undefined;

  // `justify-content`, and it is the whole of the Alignment control working on
  // this block: `align` arrives as `text-align`, which cannot move a flex item.
  if (chip?.justify) row.style.justifyContent = chip.justify;

  for (const tag of chips) {
    const pill = el("span", "lm-popup__tag", tag.label);

    // A custom property rather than `background`, so the stylesheet keeps its
    // own default in the `var()` fallback — the pattern every other optional
    // field on a card follows.
    if (chip?.background) pill.style.setProperty("--lm-chip-bg", chip.background);
    if (chip?.padding) pill.style.setProperty("--lm-chip-pad", chip.padding);

    // The outline, which `chipStyleOf` hands over as a pair or not at all — a
    // colour with no width draws nothing and a width with no colour draws a
    // line nobody picked.
    if (chip?.border) pill.style.setProperty("--lm-chip-border", chip.border);
    if (chip?.borderWidth) {
      pill.style.setProperty("--lm-chip-border-width", chip.borderWidth);
    }

    row.append(pill);
  }

  return row;
}

/**
 * A block in its box, sized as the owner sized it.
 *
 * The arithmetic is `blockBox` in packages/shared, which the editor's card and
 * the designer canvas run too — "70% of the card" has to mean the same thing in
 * the studio and on the customer's site, and one function is the only way that
 * stays true.
 */
function wrapBlock(
  block: CardBlock,
  node: HTMLElement,
  layout: CardLayout,
  /**
   * Whether this block's **line** is the first or last of its zone. Only the
   * overlap reads them, and it reads them because a block is pulled over the
   * *line above it* — the top line of a zone has none, and pulling a block out
   * of the zone anyway is a card that clips its own logo. `blockEdges` in
   * components/card/card-frame.tsx is the same decision on the dashboard's side,
   * and `upwardLiftOf` in packages/shared is where the rule itself lives.
   */
  isFirstLine: boolean,
  isLastLine: boolean,
  /**
   * Whether this block is a flex item of a **row** rather than of the zone's own
   * column — `row.shared`. Only a self-sized mark reads it: `align-self` is
   * horizontal in a column and vertical in a row, so a logo that has gained a
   * neighbour is positioned by that neighbour rather than by its own `align`.
   */
  onRow: boolean,
): HTMLElement {
  const box = blockBox(block, layout, onRow);
  // The clamp is a class rather than a bare custom property, because the rule it
  // switches on changes the paragraph's `display` — see `--clamp` in styles.css.
  const wrap = el(
    "div",
    `lm-popup__block lm-popup__block--${block.type}${
      box.lines ? " lm-popup__block--clamp" : ""
    }`,
  );

  // Neither is emitted any more — a narrowed block is a flex item of its own
  // row, so its share is the `flex` basis below and where it sits on the line is
  // the row's `justify-content`. Kept as a pass-through because `CardBlockBox`
  // still declares them and this file's job is to apply whatever it hands back,
  // not to know which of its fields are currently in use.
  if (box.width) wrap.style.width = box.width;
  if (box.alignSelf) wrap.style.alignSelf = box.alignSelf;

  if (box.textAlign) wrap.style.textAlign = box.textAlign;

  // How much room to hold when this location filled the block in with nothing.
  // Set on the wrapper and inherited by the empty node inside it — see
  // `.lm-popup__block--empty` in styles.css and `emptyBlockHeight`, which is the
  // one place the number is worked out for all three renderers.
  if (box.emptyHeight) {
    wrap.style.setProperty("--lm-block-empty-h", box.emptyHeight);
  }

  // The class is what cancels the card's vertical padding at the very top and
  // bottom (see `--bleed` in styles.css); the inline margin is the horizontal
  // half, which is a number rather than the two states that class can express.
  //
  // The two *ends* are their own classes rather than `:first-child` /
  // `:last-child`, which is what the stylesheet used to match on. A line can now
  // be preceded by its own leading space (`buildLead`), so the block at the top
  // of a zone is not necessarily the first element in it — and a photo that
  // stopped being `:first-child` would silently stop reaching the card's top
  // edge. This is also what `blockEdges` in components/card/card-frame.tsx has
  // always asked: the line's index, not the DOM's.
  if (box.bleed) {
    wrap.classList.add("lm-popup__block--bleed");
    if (isFirstLine) wrap.classList.add("lm-popup__block--bleed-start");
    if (isLastLine) wrap.classList.add("lm-popup__block--bleed-end");
  }
  if (box.marginInline) wrap.style.marginInline = box.marginInline;

  // How far it is pulled over its neighbour, on the same terms and for the same
  // reason: the stylesheet composes it with the offset above, and an inline
  // `margin-top` would replace that rather than add to it.
  if (box.overlap && upwardLiftOf(block, layout, !isFirstLine) > 0) {
    wrap.style.setProperty("--lm-block-overlap-above", box.overlap);
  }
  if (box.overlap && box.overlapEdge === "below" && !isLastLine) {
    wrap.style.setProperty("--lm-block-overlap-below", box.overlap);
  }

  // A block drawn over its neighbour rather than beside it. Tree order alone
  // covers overlapping the block *above*; it does not cover the other direction.
  if (box.raised) {
    wrap.style.position = "relative";
    wrap.style.zIndex = "1";
  }

  // Fill or Fit, for the one block whose content has a shape of its own. A
  // custom property because the element it belongs on is the `img` inside, and
  // `.lm-popup__photo` falls back through it to the crop every card drew before
  // the control existed. The dashboard publishes the same thing as `--card-fit`;
  // the two names are kept in step by hand, as `--lm-card-gap` and `--card-gap`
  // already are.
  if (box.objectFit) wrap.style.setProperty("--lm-card-fit", box.objectFit);

  /*
   * The owner's own type, and the two block options that are lengths.
   *
   * Custom properties rather than declarations, for the reason the dashboard's
   * `blockStyle` gives at length: each rule in styles.css names its own current
   * value as the fallback, so a block nobody has styled resolves to exactly the
   * pixels it has always drawn — which is what lets this land without moving a
   * single card already live on a customer's site (CLAUDE.md §7). Nothing is
   * written for such a block, so its DOM is byte-for-byte what it was.
   */
  if (box.text) {
    const { font, size, color, weight } = box.text;

    if (font) wrap.style.setProperty("--lm-card-font", font);
    if (size) wrap.style.setProperty("--lm-card-font-size", size);
    if (color) wrap.style.setProperty("--lm-card-color", color);
    if (weight) wrap.style.setProperty("--lm-card-font-weight", weight);
  }

  if (box.lines) wrap.style.setProperty("--lm-card-lines", box.lines);
  if (box.rowGap) wrap.style.setProperty("--lm-hours-gap", box.rowGap);

  if (box.height) wrap.style.height = box.height;

  // `flex` is `blockBox`'s to decide, because two rules want it: a block with a
  // height needs `none`, or the zone's flex column shrinks it back to its
  // content, and a narrowed block needs its share of the line instead. A
  // narrowed photo wants both a height and a basis, so neither can be written
  // blind.
  if (box.flex) wrap.style.flex = box.flex;
  // And the floor it may be squeezed to, which only the week has: `0 1 auto`
  // shrinks nothing without it.
  if (box.minHeight) wrap.style.minHeight = box.minHeight;
  if (box.overflowWrap) wrap.style.overflowWrap = box.overflowWrap;

  // The stylesheet already sets `box-sizing: border-box` on everything under
  // `.lm-root`, so a padded gallery's `height: 100%` photo still fills the box
  // it was given rather than growing past it.
  if (box.padding) wrap.style.padding = box.padding;

  /*
   * A narrowed block draws its content smaller, and the shrink goes on an
   * element of its own — `zoom` on `wrap` itself would resolve the flex basis
   * just written above inside a scaled coordinate space, and the basis is the
   * one thing about a column that has to be exact.
   */
  if (box.contentZoom === undefined) {
    wrap.append(node);
  } else {
    const inner = el("div", "lm-popup__block-content");
    inner.style.zoom = String(box.contentZoom);
    inner.append(node);
    wrap.append(inner);
  }

  return wrap;
}

/**
 * The location's own pin, drawn at whatever size its block was given.
 *
 * Not a second upload and not a second drawing: `pinSvg` is the same markup the
 * marker on the map is made of and the same the dashboard's card renders, so the
 * badge on the card and the pin the visitor clicked to open it are one design.
 * A pin carrying an uploaded image is the customer's logo; one carrying a glyph
 * is the mark that map uses for this kind of place. Both are this location's
 * badge, which is why nothing here returns null.
 *
 * `innerHTML` where the rest of this file is scrupulously `textContent`, and it
 * is safe for a reason worth writing down: none of this string is customer text.
 * The paths are ours, and the one customer-supplied value — an uploaded image —
 * is a `data:image/(png|webp);base64,…` matched against a regex with no quote in
 * its character class before it can be stored at all (lib/validation/
 * pin-icon.schema.ts). The dashboard's own marker and preview take the same
 * string the same way.
 *
 * The colour falls back to the first tag's, never to a theme's: a snapshot is
 * looked at by strangers, and `resolvePin` already answers the fixed grey for a
 * location with neither.
 */
function buildLogo(
  place: SnapshotPlace,
  fallbackColor: string | undefined,
  pins: readonly CustomPinIcon[],
  /**
   * Absent for a snapshot published before the block could be asked which of
   * its three drawings it is — which is the pin, exactly as `logoImageOf` reads
   * an absent `logoMode`.
   */
  block?: CardBlock,
): HTMLElement | null {
  const pin = resolvePin(place.icon ?? "", pins);

  /*
   * The mark that is strictly a logo, on a location that has none.
   *
   * Null, so `buildPopup` draws the empty block and the space the owner
   * designed is held — rather than quietly substituting a pin, which is what
   * `logoMode: "mixed"` is for and is the whole difference between the two. See
   * `logoImageOf`, and `hasBlockContent` in components/card/card-block.tsx,
   * which reaches the same answer for the dashboard's twin of this card.
   */
  if (block?.logoMode === "image" && !place.logoUrl && !pin?.image) return null;

  /*
   * The uploaded logo on its own, when the owner asked for that and this
   * location has one.
   *
   * `logoImageOf` and not a comparison here, because the dashboard's own `Logo`
   * asks the same function: the preview panel draws the two side by side, and a
   * card showing a logo in the studio and a pin on the customer's site is
   * exactly the drift `packages/shared` exists to stop. An `img` `src` rather
   * than `innerHTML`, so the `data:` URI never goes near markup at all.
   */
  const image = block && logoImageOf(block, pin?.image ?? "", place.logoUrl);
  if (block && image) {
    const node = el("div", "lm-popup__logo lm-popup__logo--image");
    const picture = el("img", "lm-popup__logo-image");

    picture.src = image;
    picture.alt = "";
    picture.draggable = false;
    // The corner the owner chose, or nothing at all for the square every card
    // published before the control existed draws. `logoRadiusOf` is the same
    // function the dashboard's `Logo` asks, for `logoImageOf`'s reason.
    const radius = logoRadiusOf(block);
    if (radius) picture.style.borderRadius = radius;
    node.append(picture);

    return node;
  }

  const node = el("div", "lm-popup__logo");

  // Ring, thickness, glyph colour and size, through the one helper the markers
  // and the dashboard's own preview also use.
  for (const [name, value] of Object.entries(
    pinCssVars(pin, undefined, fallbackColor),
  )) {
    node.style.setProperty(name, value);
  }

  node.innerHTML = pinSvg(pin);

  return node;
}

/**
 * A line holding one or two narrowed blocks.
 *
 * Only ever built for a shared row. A full-width block stays a *direct* child of
 * its zone, which is what keeps the three `--bleed` rules in styles.css working:
 * two of them are `:first-child` / `:last-child` under a `>` combinator and could
 * not reach into a wrapper. A card with nothing narrowed on it therefore builds
 * the DOM it has always built.
 */
/**
 * The empty space above a line, as an element rather than a margin.
 *
 * `leadBox` holds the argument and the three numbers; all this does is put them
 * on a div. Only ever appended when there is space to draw, so a card with no
 * offsets on it — which is every card published so far — builds exactly the DOM
 * it always built.
 */
function buildLead(offset: number, layout: CardLayout): HTMLElement {
  const lead = el("div", "lm-popup__lead");
  const box = leadBox(offset, layout);

  lead.style.flex = box.flex;
  lead.style.minHeight = box.minHeight;
  lead.style.marginBottom = box.marginBottom;
  lead.setAttribute("aria-hidden", "true");

  return lead;
}

function wrapRow(
  row: CardRow,
  layout: CardLayout,
  children: readonly HTMLElement[],
): HTMLElement {
  const wrap = el("div", "lm-popup__row");
  const box = cardRowBox(row, layout);

  wrap.style.columnGap = box.columnGap;
  // Which end the line's unspent share sits at — a lone narrowed block moved to
  // the end of its line, or a mark leading a line it shares. See `cardRowBox`.
  if (box.justifyContent) wrap.style.justifyContent = box.justifyContent;
  wrap.append(...children);

  return wrap;
}

/**
 * The gallery, as one image the visitor steps through.
 *
 * **No counter.** There was a `2 / 3` over the picture, on the argument that a
 * strip of thumbnails would say the same thing and cost forty pixels of a card
 * this rework exists to shorten. Both are answers to a question nobody asked: a
 * visitor looking at a shop's photos is not counting them, and the chevrons
 * already say there are more. It was also the one thing on the card the studio
 * never drew — `Gallery` in components/card/card-block.tsx shows the first photo
 * and nothing else — so removing it narrows the drift between the twins.
 *
 * Only the current `src` is ever assigned. A place with eight photos would
 * otherwise start eight downloads the moment its pin is clicked, on a visitor's
 * phone, for seven pictures they may never look at — `loading="lazy"` does not
 * help, because by then the image is on screen.
 */
function buildGallery(photos: string[]): HTMLElement {
  /*
   * A place with no picture still gets the band, as a plain fill.
   *
   * The photo block is a thing the map's owner put on the card, not a thing this
   * location filled in, so dropping it here made one saved design draw at a
   * different height on every pin — and at a height the studio never showed,
   * since its canvas keeps every block it was given. The twin of `Gallery`'s own
   * empty half in components/card/card-block.tsx.
   */
  if (photos.length === 0) {
    return el("div", "lm-popup__gallery lm-popup__gallery--empty");
  }

  const root = el("div", "lm-popup__gallery");
  const image = el("img", "lm-popup__photo");

  // The name is the caption right below it; repeating it as alt text makes a
  // screen reader read it twice.
  image.alt = "";
  image.loading = "lazy";
  image.src = photos[0];
  root.append(image);

  if (photos.length === 1) return root;

  let at = 0;

  const show = (next: number) => {
    // Wraps, so back from the first photo reaches the last rather than
    // dead-ending on a control that looks live.
    at = (next + photos.length) % photos.length;
    image.src = photos[at];
  };

  const step = (delta: number, side: string, path: string) => {
    const control = button("lm-popup__step lm-popup__step--" + side, "");
    const name = delta < 0 ? "Previous photo" : "Next photo";

    control.setAttribute("aria-label", name);
    control.title = name;
    control.append(icon([path]));
    control.addEventListener("click", (event) => {
      // The card sits over the map, and a click that reaches the canvas pans it.
      event.stopPropagation();
      show(at + delta);
    });

    return control;
  };

  show(0);
  root.append(step(-1, "back", "M15 18 9 12l6-6"), step(1, "on", "m9 18 6-6-6-6"));

  return root;
}

/**
 * A place's photos, both contracts read.
 *
 * `photoUrls` is only written for a real gallery, and every snapshot published
 * before galleries existed carries `photoUrl` alone — both are live on
 * customers' sites right now (@/packages/shared/snapshot.ts).
 */
function photosOf(place: SnapshotPlace): string[] {
  if (place.photoUrls?.length) return place.photoUrls;

  return place.photoUrl ? [place.photoUrl] : [];
}

/**
 * Everything a visitor reads *after* choosing this place, behind one line.
 *
 * A `<details>` because it is one, and because it then opens from the keyboard
 * with no code — the same call `buildHours` already made for the week. Null when
 * there is nothing inside, so a bare location does not grow a fold that opens
 * onto nothing.
 *
 * What it holds is whatever the owner has *not* pulled out onto the card itself
 * (`detailsContents`), built through the same table the card uses. Without that
 * subtraction a description dragged into the middle would render twice — once
 * where they put it and once in here.
 *
 * The order is the fold's own, not the order the blocks sit in elsewhere: the
 * description, then the week, then the extra fields. A row-shaped extra field
 * reads as part of the description, which is why it comes after it; the
 * button-shaped ones are not here at all, they land with the other actions.
 */
function buildMore(context: BlockContext): HTMLElement | null {
  const inner = el("div", "lm-popup__more-body");

  for (const type of context.folded) {
    const node = BUILDERS[type](context);
    if (node) inner.append(node);
  }


  if (inner.childElementCount === 0) return null;

  const root = el("details", "lm-popup__more");
  const summary = el("summary", "lm-popup__more-summary", "More details");
  summary.append(icon(["m6 9 6 6 6-6"]));

  root.append(summary, inner);

  return root;
}

/**
 * The card shown when a visitor clicks a shape.
 *
 * Smaller than a place's, because a shape holds less: a name, what it means, and
 * a swatch tying the card to the wash of colour it came from. No directions link
 * — an area is not somewhere you can be routed to.
 *
 * A line also carries how long it is, because that is usually the thing it was
 * drawn to say. Measured here from the points in the snapshot rather than stored
 * alongside them: a number and the geometry it describes, shipped separately, is
 * one republish away from disagreeing, and the sum costs microseconds. A route
 * adds its travel time beside that, which is the one figure that argument does
 * not cover — it cannot be recomputed from the points at all.
 *
 * Same `textContent`-only construction as above, for the same reason: this is
 * customer text landing on a third party's page.
 */
export function buildShapePopup(shape: SnapshotShape): HTMLElement {
  const root = el("div", "lm-popup");
  const body = el("div", "lm-popup__body");

  const heading = el("h3", "lm-popup__name", shape.name);
  const swatch = el("span", "lm-popup__swatch");
  swatch.style.setProperty("--lm-shape-color", shape.color);
  heading.prepend(swatch);

  body.append(heading);

  if (shape.kind === "line") {
    // Length measured, travel time read. The first is a sum over the points
    // right here; the second cannot be derived from them at any price, so it is
    // the one number a route ships (packages/shared/snapshot.ts). Absent for a
    // hand-drawn line, which then reads exactly as it always did.
    const parts = [formatDistance(pathLengthM(shape.points) / 1000)];
    if (shape.durationS) parts.push(formatDuration(shape.durationS));

    body.append(el("p", "lm-popup__distance", parts.join(" · ")));
  }

  if (shape.description) {
    body.append(el("p", "lm-popup__description", shape.description));
  }

  root.append(body);

  return root;
}

/**
 * The description, folded when its owner clipped it.
 *
 * A clipped paragraph is one whose last sentence a visitor cannot read, so
 * `clampLines` carries a chevron with it — see the field's own note in
 * packages/shared/card-layout.ts. A `<details>`, which is what the week and the
 * fold below already are: it opens from the keyboard with no code, and the
 * chevron is the same path `buildHours` and `buildMore` draw.
 *
 * **One paragraph, in both states.** The clamp comes off in CSS when the
 * `<details>` opens (`.lm-popup__description-fold[open]` in styles.css) rather
 * than a second copy of the text appearing below the summary, so a screen reader
 * is never read a location's description twice.
 *
 * Unclipped is the plain `<p>` it has always been — no fold, no chevron, no
 * extra element — which is every card published so far.
 */
function buildDescription(text: string, block?: CardBlock): HTMLElement {
  const paragraph = el("p", "lm-popup__description", text);
  if (!block?.clampLines) return paragraph;

  const root = el("details", "lm-popup__description-fold");
  const summary = el("summary", "lm-popup__description-summary");

  summary.append(paragraph, icon(["m6 9 6 6 6-6"]));
  root.append(summary);

  return root;
}

/**
 * The week, as a `<details>` that opens on today.
 *
 * Collapsed unless its owner said otherwise, because the answer a visitor
 * actually wants is "can I go now" — that is the summary line. Seven rows of
 * times unprompted would push the address and the directions link out of a
 * 280px popup, which is why the absence of `hoursOpen` has to keep meaning
 * closed: every card published so far is drawn from that absence.
 *
 * The chevron is the same path `buildMore` draws, and deliberately so — one
 * shape for "there is more of this here", and no new bytes for a second.
 */
function buildHours(
  place: SnapshotPlace,
  /** Absent for a week inside the fold, which has no block of its own. */
  block?: CardBlock,
): HTMLElement | null {
  const hours = place.hours ?? null;
  if (isEmptyHours(hours) || !hours) return null;

  const root = el("details", "lm-popup__hours");
  if (block?.hoursOpen) root.open = true;

  const summary = el("summary", "lm-popup__hours-summary");

  const open = isOpenNow(hours);
  const state = el(
    "span",
    open ? "lm-popup__hours-state lm-popup__hours-state--open" : "lm-popup__hours-state",
    open ? "Open now" : "Closed now",
  );

  const today = dayIndex();
  summary.append(state, el("span", "lm-popup__hours-today", formatDay(hours[today])));
  summary.append(icon(["m6 9 6 6 6-6"]));
  root.append(summary);

  const list = el("dl", "lm-popup__hours-list");
  const labels = block?.hoursLongDays ? DAY_LABELS : DAY_LABELS_SHORT;

  for (let day = 0; day < hours.length; day += 1) {
    const term = el("dt", "lm-popup__hours-day", labels[day]);
    const value = el("dd", "lm-popup__hours-time", formatDay(hours[day]));

    if (day === today) {
      term.classList.add("lm-popup__hours-day--today");
      value.classList.add("lm-popup__hours-time--today");
    }

    list.append(term, value);
  }

  root.append(list);

  return root;
}

/**
 * A field's value as something the visitor can act on, where that makes sense.
 *
 * `link()` checks the scheme, so a `url` field holding `javascript:...` — which
 * the dashboard's own validation would accept as a parseable URL — degrades to
 * plain text on a stranger's page rather than becoming a hazard. `tel` and
 * `mailto` are composed here, so what the owner typed is never the whole href.
 */
function fieldValue(
  field: SnapshotField,
  value: string,
  className: string,
): HTMLElement {
  switch (field.type) {
    case "url":
      return link(className, value, value);
    case "tel":
      return link(className, value, `tel:${value}`);
    case "email":
      return link(className, value, `mailto:${value}`);
    default:
      return el("span", className, value);
  }
}

/**
 * One press, drawn as a button.
 *
 * The twin of `CardButton` in components/card/card-block.tsx. Both ask
 * `buttonTargetOf` where it goes and `buttonStyleOf` how it looks, which is the
 * whole of what keeps the studio's button and this one the same button — the
 * DOM is built by hand here because the embed must not ship React (§4), and
 * that is a difference in *how it is made*, never in what it is.
 *
 * `null` when there is nowhere to go, so the block takes no space at all on a
 * location that has not filled the link in. The studio draws a placeholder
 * there instead; a visitor gets nothing, because there is nothing for them to
 * do about it.
 *
 * Every value is written as a custom property with `styles.css` naming the
 * fallback, exactly as `wrapBlock` writes the text group — so a button nobody
 * has styled costs zero inline bytes and a card published years from now still
 * draws through this stylesheet.
 */
/** The only class names a stored treatment or hover may become. See below. */
const VARIANT_CLASS: Record<string, string | undefined> = {
  outline: "lm-popup__button--outline",
  soft: "lm-popup__button--soft",
  ghost: "lm-popup__button--ghost",
};

const HOVER_CLASS: Record<string, string | undefined> = {
  none: "lm-popup__button--hover-none",
  lighten: "lm-popup__button--hover-lighten",
  lift: "lm-popup__button--hover-lift",
};

function buildButton(
  place: SnapshotPlace,
  fields: SnapshotField[],
  block: CardBlock,
  /** Only read for a Directions button — see `buttonTargetOf`. */
  me: Fix | null,
): HTMLElement | null {
  const target = buttonTargetOf(block, place, fields, me);
  if (!target) return null;

  /*
   * A Directions button is the same link as the row's, so it goes through the
   * same builder — otherwise the press that asks for a position would work on
   * one of them and not the other, which is the harder half of the bug to
   * notice. `buttonAction` is spelled as `"link"`, so absent is Directions: see
   * `CardBlock.buttonAction`, and `buttonTargetOf`, which reads it the same way
   * round.
   */
  const node =
    block.buttonAction === "link"
      ? link("lm-popup__button", target.label, target.href)
      : directionsLink("lm-popup__button", target.label, place, me);
  const style = buttonStyleOf(block);

  if (block.buttonFull) node.classList.add("lm-popup__button--full");

  /*
   * The treatment and the hover, **looked up rather than interpolated**.
   *
   * This is the one place in the card where that distinction is load-bearing.
   * The embed draws `snapshot.cardLayout` exactly as it was published and never
   * re-runs `readCardLayout` (see embed/src/map.ts), so the string on the block
   * here is whatever wrote the file — a hand-edited row, a snapshot from a
   * future version, anything. `classList.add(block.buttonVariant)` would put
   * that straight into the class attribute of an element on a stranger's site.
   * A table can only ever yield a class this stylesheet defines.
   *
   * The dashboard's twin (`buttonModifiers` in components/card/card-block.tsx)
   * interpolates, and may: its block has already been through the parse.
   */
  const variant = VARIANT_CLASS[block.buttonVariant ?? ""];
  if (variant) node.classList.add(variant);

  const hover = HOVER_CLASS[block.buttonHover ?? ""];
  if (hover) node.classList.add(hover);

  if (style?.background) {
    node.style.setProperty("--lm-button-bg", style.background);
  }
  if (style?.padding) node.style.setProperty("--lm-button-pad", style.padding);
  if (style?.radius) node.style.setProperty("--lm-button-radius", style.radius);
  if (style?.border) node.style.setProperty("--lm-button-border", style.border);
  if (style?.borderWidth) {
    node.style.setProperty("--lm-button-border-width", style.borderWidth);
  }

  return node;
}

/*
 * The four glyphs the Links row wears, as path data.
 *
 * Lucide's own `phone`, `mail`, `globe` and `navigation` — the same four
 * `Actions` imports in components/card/card-block.tsx, copied rather than
 * imported because the embed must not ship a React icon package (§4). The two
 * that lucide files as a `rect`, a `circle` and a `polygon` are written here as
 * the equivalent path, since `icon()` draws paths and nothing else.
 */
const PHONE_ICON = [
  "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384",
];

const MAIL_ICON = [
  "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",
  "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
];

const GLOBE_ICON = [
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",
  "M2 12h20",
];

const NAVIGATION_ICON = ["M3 11 22 2l-9 19-2-8-8-2z"];

/**
 * One way to reach the place: a glyph, then a label.
 *
 * The node is passed in already built, because `link()` is what decides whether
 * a customer-supplied href is safe enough to be an anchor at all — a row whose
 * scheme failed that test is a `<span>`, and it still gets its icon.
 *
 * The label is a child rather than the row's own text so it can `truncate`
 * independently: a forty-character email must shorten itself rather than push
 * the other three rows off a card 320px wide.
 */
function actionRow(node: HTMLElement, glyph: string[], label: string): HTMLElement {
  node.textContent = "";
  node.append(icon(glyph), el("span", "lm-popup__link-label", label));

  return node;
}

/**
 * What the Links row calls a website: its host and path, never the whole URL.
 *
 * `https://example.com/stores/bristol/` reads as `example.com/stores/bristol`,
 * which is the studio's own expression (`Actions` in
 * components/card/card-block.tsx) and the reason this is not simply the string
 * the owner typed — forty characters of scheme and tracking parameters is not a
 * label. Anything unparseable falls back to that string, because a row that
 * says something imperfect beats a row that disappears.
 */
function siteLabel(url: string): string {
  try {
    const parsed = new URL(url, window.location.href);

    return parsed.host + parsed.pathname.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function buildActions(
  place: SnapshotPlace,
  fields: SnapshotField[],
  /**
   * Optional, because the fold builds this type with no block behind it (see
   * `buildMore`) — and an unconfigured row shows all four, which is what an
   * absent `hide*` means everywhere. It is also what every card published
   * before these four fields existed says, so nothing already live moves.
   */
  block?: CardBlock,
  /** Where the visitor is, for the Directions row alone. */
  me: Fix | null = null,
): HTMLElement | null {
  const actions = el("div", "lm-popup__actions");

  // `justify-content`, for `buildTags`' reason one function up: this row is a
  // flex list, and `align` arrives as `text-align`, which cannot move a flex
  // item. One mapping, shared with the studio, so the two draw one row.
  const justify = justifyOf(block?.align);
  if (justify) actions.style.justifyContent = justify;

  /*
   * Phone, email, website, Directions — the studio's order, which this row did
   * not have.
   *
   * The two renderers drew genuinely different rows: this one led with a link
   * labelled "Website", at 13px in a hard-coded link blue with no glyph, where
   * `Actions` in components/card/card-block.tsx has always drawn icon-and-label
   * pairs at 11px in the card's own text colour, phone first. An owner arranges
   * the card in the studio, so the studio is what a customer's site now draws —
   * which is a §7 exception taken knowingly, the same one the deleted tag chips
   * are: the bundle is shared, so a map already published changes on the next
   * deploy without its owner republishing.
   */
  if (place.phone && !block?.hidePhone) {
    actions.append(
      actionRow(
        link("lm-popup__link", "", `tel:${place.phone}`),
        PHONE_ICON,
        place.phone,
      ),
    );
  }
  if (place.email && !block?.hideEmail) {
    actions.append(
      actionRow(
        link("lm-popup__link", "", `mailto:${place.email}`),
        MAIL_ICON,
        "Email",
      ),
    );
  }
  if (place.url && !block?.hideWebsite) {
    actions.append(
      actionRow(
        link("lm-popup__link", "", place.url),
        GLOBE_ICON,
        siteLabel(place.url),
      ),
    );
  }

  if (!block?.hideDirections) {
    actions.append(
      actionRow(
        directionsLink("lm-popup__link", "", place, me),
        NAVIGATION_ICON,
        "Directions",
      ),
    );
  }

  /*
   * The owner's own calls to action, after ours.
   *
   * These are the reason custom fields exist — "Book a fitting", "View the menu"
   * — so they are given the label the owner wrote rather than the value, which
   * for a URL would be forty characters of tracking parameters. A button-shaped
   * field with no link type still renders, as plain text, because the alternative
   * is silently dropping something the owner filled in.
   */
  const values = place.fields;

  if (values) {
    for (const field of fields) {
      if (field.showAs !== "button") continue;

      const value = values[field.id];
      if (!value) continue;

      /*
       * The same row as the four above, where it used to be an outlined pill of
       * its own (`--cta`). One row shape for one block: the studio draws these
       * through the very same `ContactRow` it draws Directions with, and a card
       * that changes shape depending on whether the link came from us or from a
       * custom field is two designs wearing one name.
       *
       * `actionRow` clears the text `fieldValue` set, which is the value — the
       * label is what goes on screen, for the reason above.
       */
      actions.append(
        actionRow(fieldValue(field, value, "lm-popup__link"), GLOBE_ICON, field.label),
      );
    }
  }

  return actions.childElementCount > 0 ? actions : null;
}
