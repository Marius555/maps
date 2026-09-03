/**
 * The design of the card a visitor sees when they click a location.
 *
 * Runtime, not just types, and here rather than in /lib for the same reason
 * `shapes.ts` and `style-tint.ts` are (CLAUDE.md §4): three things render this
 * layout — the embed's popup, the editor's own place card, and the designer
 * canvas that is a preview of both — and a clamp that lived in only one of them
 * would be a card that looks one way in the studio and another on the customer's
 * site. Zero dependencies, vanilla TS, as that rule requires.
 *
 * **A stack of zones, not a free canvas.** A block belongs to `top`, `middle` or
 * `bottom` and is ordered within it. That is what makes every possible layout a
 * card rather than a collage: the actions row cannot end up above the name, and
 * a close button cannot end up in the middle at four times its size. Which zones
 * a block may enter is `CARD_BLOCKS` below, and it is the only place that rule
 * is written down.
 *
 * Every size is a percentage of the card's own box, so "no bigger than the card"
 * is true by construction rather than by checking. A block's own padding is the
 * one exception and is in pixels, because it is set against the card's padding —
 * which is pixels too.
 */

import { isCardFont } from "./card-fonts";

export type CardZone = "top" | "middle" | "bottom";

export const CARD_ZONES: readonly CardZone[] = ["top", "middle", "bottom"];

export type CardBlockType =
  | "gallery"
  | "logo"
  | "name"
  /**
   * Retired. Categories merged into tags, so this draws the location's *first*
   * tag — the one that colours its pin, which is what a category was.
   *
   * Kept in the union rather than removed, because a layout saved while
   * categories existed still parses and still names it, and a block that stopped
   * being a block would silently drop a row out of somebody's design. Nothing
   * puts it in a new layout: it is out of `defaultCardLayout` and marked
   * `retired`, so the palette does not offer it.
   */
  | "category"
  | "tags"
  | "address"
  | "description"
  | "hours"
  /**
   * Retired. The fold could only ever hold the description and the week, and
   * the default card carries both — so on the card everybody gets it drew
   * nothing at all, while still being a control the palette offered.
   *
   * Kept in the union on the Category block's terms, and for its reason: a
   * layout saved while it was offered still names it, and a block that stopped
   * being a block would silently drop a row out of somebody's design. It is out
   * of `defaultCardLayout` and marked `retired`, so nothing new picks it up,
   * and both renderers still build it wherever a stored layout asks.
   */
  | "details"
  | "actions"
  /**
   * One call to action, drawn as a button rather than as a line of text.
   *
   * The card's own `actions` row is the ways to *reach* a place — a phone
   * number, an address to route to — laid out as small links because three
   * filled buttons ate a third of a card. This is the other thing a card is
   * for: the one press its owner actually wants, sized and coloured to be
   * pressed. Not unique, because "Directions" and "Book a fitting" are two
   * buttons rather than one with two jobs.
   */
  | "button"
  | "divider"
  | "spacer";

/**
 * What can be adjusted about a block, and — as a list on the block's own spec —
 * the only things that can be.
 *
 * One declaration rather than several derived rules, because it has to answer
 * two questions that must never disagree: which controls the designer's panel
 * offers, and which patches `resizeCardBlock` will act on. A panel offering a
 * slider the edit path ignores is a control that silently does nothing, and a
 * block declaring nothing at all is a panel that looks like it failed to load.
 * Both were real, and both came from deriving controls out of how a block is
 * *sized* rather than out of what can actually be done to it.
 *
 * - `height` — a picture and a spacer have no natural height, so they carry one.
 *   Everything else grows to its content, which is what lets one layout be right
 *   for three thousand locations that are each filled in differently.
 * - `width` — narrower than the card, and **the room left over is a place another
 *   block can go**. There is no separate `half`: taking a block to 50% and
 *   dropping something into the 50% beside it is what "half" used to be, and
 *   every other split is now sayable too. The types that do not offer it are the
 *   ones a narrow column would make unreadable rather than merely narrow — a week
 *   of opening times, a paragraph of description, a list of label-and-value rows,
 *   a row of buttons.
 * - `align` — which side the block's own content sits on.
 * - `padding` — room inside the block's box, over and above the card's.
 * - `margin` — how far this block's own edges sit from the card's, *replacing*
 *   the card's padding for this one block. Zero reaches the card's edges, which
 *   is what the `bleed` boolean used to say and the only thing it could say.
 * - `fit` — whether a picture fills the box it was given, cropping what does not
 *   fit, or sits inside it whole. Only the gallery has one, because it is the
 *   only block whose content has a shape of its own to disagree with the box.
 * - `valign` — where the block sits on its line's *cross* axis, which is only a
 *   question once it shares one. A full-width block's line is exactly as tall as
 *   the block, so there is nothing there for this to move, and the panel hides
 *   it accordingly. It is offered by exactly the types that can be narrowed,
 *   because narrowing is what makes a line something to sit on — a rule about
 *   the table below that `card-layout.test.ts` is what holds.
 * - `overlap` — how far the block is pulled over the neighbour beside it in the
 *   stack, so it straddles the edge between them instead of following it. Only
 *   the logo has one, because it is the only block small enough to sit on top of
 *   another without hiding it.
 * - `text` — the typeface, size, colour and weight of a block made of words. One
 *   control rather than four, because they are one group in the panel and a
 *   block that has words has all four or none of them. Offered by exactly the
 *   types whose content is text; a photo, a mark, a rule and a gap have nothing
 *   for it to move, which is this table's own rule.
 * - `hours` — the three things only a week of opening times can be asked: whether
 *   it starts open or closed, whether its days are named in full, and how far
 *   apart its rows sit.
 * - `clamp` — whether a paragraph is shown whole or clipped after a few lines.
 *   Only the description has one; it is the only block holding text of a length
 *   its owner did not choose.
 * - `chips` — the ground, the outline and the roominess of the pills a block
 *   draws its content *as*. Its own control rather than more of `text`, because
 *   `text` moves words and this moves the box they sit in; the two blocks that
 *   have it are the two whose content is not a run of words at all. It is also
 *   what makes `align` work on them: a row of chips is a flex row, which
 *   `text-align` cannot move, so `chipStyleOf` hands back the `justify-content`
 *   that can.
 * - `logo` — whether the mark is drawn as the location's whole pin or as the
 *   uploaded logo inside it, on its own. Only the logo block has one, and it is
 *   the only control whose two answers are two different *drawings* rather than
 *   two sizes of the same one.
 * - `button` — what a button *does*: directions or a link, where that link comes
 *   from, and what it says. The one control whose answers change where a press
 *   goes rather than what it looks like, which is why it is separate from the
 *   one below and sits in the panel's Content group with the other two.
 * - `buttonStyle` — the ground, the outline and the corner of the box a button
 *   is drawn as. Its own control rather than more of `button`, on exactly the
 *   split `text` and `chips` already make: one moves the words, the other moves
 *   the box around them, and a panel that groups them together is a panel that
 *   has stopped answering questions one at a time.
 * - `links` — which of the four ways to reach a place the Links row draws. Only
 *   that block has one, and it is a control about *content* rather than about
 *   the box, which is where the panel puts it.
 */
export type CardBlockControl =
  | "height"
  | "width"
  | "align"
  | "padding"
  | "margin"
  | "fit"
  | "valign"
  | "overlap"
  | "text"
  | "hours"
  | "clamp"
  | "chips"
  | "logo"
  | "button"
  | "buttonStyle"
  | "links";

export type CardBlockSpec = {
  /** The zones this block may be dropped into, and the only ones. */
  zones: readonly CardZone[];
  /** At most one per card — two names is not a design, it is a mistake. */
  unique: boolean;
  /**
   * A block that still renders but is no longer offered.
   *
   * The palette reads it (`availableBlocks`), so a saved layout keeps drawing
   * what it drew while nothing new can pick the block up. This is the shape a
   * block gets deleted in: a card in a published snapshot is read forever (§7),
   * and dropping the type outright would change what those files draw.
   */
  retired?: boolean;
  /** What the designer offers for this block. See `CardBlockControl`. */
  controls: readonly CardBlockControl[];
  /** Starting height, as a percentage of the card. `height` blocks only. */
  defaultHeightPct?: number;
  /** The ceiling for `heightPct`. `height` blocks only. */
  maxHeightPct?: number;
  /** How narrow this block may go. `width` blocks only. */
  minWidthPct?: number;
  /**
   * The padding a *newly dropped* block of this type arrives with, in px.
   *
   * Only `makeCardBlock` reads it. Deliberately not a fallback in `readBlock` or
   * in `blockBox`: a block already on a card, or already inside a published
   * snapshot, keeps drawing exactly what it drew, and a block whose owner has
   * dragged the Padding slider back to zero stays at zero. This is a starting
   * value, not a default the renderers resolve against.
   */
  defaultPadding?: number;
  /**
   * How far a *newly dropped* block of this type is pulled over its neighbour,
   * as a percentage of its own height. `overlap` blocks only.
   *
   * Read by `makeCardBlock` to seed the field and by `readBlock` as the value an
   * unreadable one falls back to — the same pair `defaultHeightPct` plays. It is
   * 50 for the logo because straddling the edge is the layout someone dropping a
   * logo under a photo meant; anything else is a mark that looks misplaced until
   * they find the slider.
   */
  defaultOverlapPct?: number;
  /**
   * Where a *newly dropped* block of this type sits. `align` blocks only.
   *
   * One entry uses it — a logo arrives centred, because a mark over a photo is
   * centred far more often than not and the alternative is every owner's first
   * move being the same one. Read only by `makeCardBlock`, like the two above;
   * an unset `align` still means "inherit" everywhere else, which is what keeps
   * every card drawn before any of this existed drawing what it drew.
   */
  defaultAlign?: CardBlockAlign;
  /**
   * A *newly dropped* block of this type fills its block rather than hugging its
   * label. `buttonStyle` blocks only.
   *
   * One entry uses it, and the reason is the same one `defaultAlign` gives: a
   * call to action across the foot of a card is what almost everyone wants, so a
   * hugging button was every owner's first thing to fix. Read only by
   * `makeCardBlock` — `buttonFull` still means what it always meant, and absent
   * is still a button the width of what it says, so no card already published
   * moves (CLAUDE.md §7).
   */
  defaultButtonFull?: true;
};

/**
 * Narrowable to a quarter of the card — the one width floor in use.
 *
 * It is also, by the same token, the list of blocks that can share a line: what
 * makes room beside a block is narrowing it, so "can this be narrowed" and "can
 * something sit next to this" are one question with one answer. A quarter is the
 * floor because three-quarters of a card is the most that can be reserved and
 * still leave something worth dropping into.
 */
const NARROWABLE = { minWidthPct: 25 } as const;

/**
 * How much a narrowed block's own **text** shrinks, as a `zoom` factor.
 *
 * Belt and braces rather than the load-bearing fix: every block made of words
 * already wraps or clamps, so less width makes it taller, not wider. This is
 * what keeps a narrowed block reading as a column — text at the card's full type
 * scale reads as cramped long before it overflows — and it is one number here
 * rather than a rule in each stylesheet, so the studio and the customer's site
 * shrink by exactly the same amount.
 *
 * One factor rather than a curve keyed on the width, because it is the *fact* of
 * being a column that makes the type look wrong, not the exact number of pixels;
 * a scale that slid with the slider would also mean no two cards at 55% and 60%
 * ever quite matched.
 *
 * `zoom` rather than `font-size`, because the dashboard's blocks size their type
 * with Tailwind's `rem`-based utilities and an inherited `font-size` moves none
 * of them. It also takes the line-height and the padding with it, which is what
 * "smaller" actually means here.
 *
 * **Text, and only text** — see `UNZOOMED`. A picture halved does not read as
 * cramped, it reads as a picture, and shrinking it by a tenth only left a strip
 * of nothing under it inside a block whose height its owner had chosen.
 */
export const NARROW_CONTENT_SCALE = 0.9;

/**
 * The blocks narrowing never shrinks: they have nothing a shrink would help.
 *
 * A photo fills the height it was given, a spacer *is* a height, and a rule is a
 * line. Each of the three is drawn against its block's own box rather than
 * flowing inside it, so `zoom` does not make them read better — it makes them
 * miss the box by a tenth. The gallery is the one that showed: a narrowed photo
 * drew at 90% of its block with a band of card underneath, and because `zoom` is
 * what puts an element in a scaled coordinate space, a `height: 100%` inside it
 * is measured in that space too.
 */
const UNZOOMED: readonly CardBlockType[] = [
  "gallery",
  "logo",
  "spacer",
  "divider",
];

/**
 * The blocks whose box is a size of their own rather than a share of the line.
 *
 * Exactly one, and the distinction earns its name because it decides what
 * `align` *means*. Every other block fills the width it is given, so aligning it
 * can only move the words inside it — `text-align`. A logo is a mark with its own
 * width sitting in the zone's flex **column**, where the cross axis is
 * horizontal, so aligning it moves the box itself — `align-self`. One field, two
 * readings, told apart here and nowhere else.
 */
const SELF_SIZED: readonly CardBlockType[] = ["logo"];

/**
 * Whether this block's box is a size of its own rather than a share of a line.
 *
 * Exported because three things outside this file now have to ask: the drop
 * geometry, which offers the room beside such a block rather than a column of
 * it; the designer's resize handle, which grips a corner rather than an edge;
 * and the panel, which hides an alignment that a line-mate has taken over.
 */
export function isSelfSized(type: CardBlockType): boolean {
  return SELF_SIZED.includes(type);
}

/**
 * The blocks a drop may not split a line with.
 *
 * About the block **already sitting there**, never the one in the hand. A photo
 * is the one block whose whole job is its size, so halving it is a change to the
 * design rather than a way of making room — and the only thing that should
 * narrow a gallery is its owner reaching for the Width slider or its resize
 * handle. It can still be narrowed, and the room that opens beside it is a real
 * column like any other; what it cannot be is narrowed *by someone dropping
 * something on it*.
 *
 * So this is also the list of blocks a drop target may never be drawn over. A
 * pair target is the one thing the designer paints across a block that is
 * staying put, and taking it away is what leaves the gallery's own face refusing
 * the drop outright — see `blockedFaces` in lib/card/drop-slots.ts, which was
 * always computed for that line and only ever painted over.
 *
 * Dropping a gallery *onto* another block is untouched: that is a target on the
 * block underneath, which is allowed, and the gallery arrives at whatever share
 * the target names.
 *
 * A list rather than a field on `CardBlockSpec`, for the reason `SELF_SIZED` and
 * `UNZOOMED` are lists: it is one type out of twelve, and a row of `pairable:
 * true` on the other eleven is eleven chances to write the wrong one.
 */
const UNPAIRABLE: readonly CardBlockType[] = ["gallery"];

/**
 * Whether a drop onto this block may split its line in two.
 *
 * Asked twice on purpose. `pairTargets` in lib/card/drop-slots.ts asks it before
 * drawing a target, and `pair` in lib/card/card-edits.ts asks it again before
 * narrowing anything — the same belt-and-braces the width floor already gets,
 * because a target is an offer and the edit path is where a rule has to be true.
 */
export function isPairable(type: CardBlockType): boolean {
  return !UNPAIRABLE.includes(type);
}

/**
 * What a block made of words arrives with: a few pixels of room inside its own
 * box, so a name does not sit hard against the block above it and an address
 * dropped next to a photo is not touching it.
 *
 * Small on purpose. The card's own padding is what holds the design together;
 * this is the difference between a block that reads as placed and one that reads
 * as pasted, and anything larger starts making the choice for the owner.
 */
const TEXT_PADDING = { defaultPadding: 4 } as const;

/**
 * What each block is allowed to be, and where.
 *
 * The gallery's row is the shape of the whole rule: it may sit at the top, in
 * the middle or at the bottom, it may be up to 70% of the card's height and
 * never more, and it may be narrowed but never widened past the card. Every
 * other block is the same idea with different numbers.
 *
 * **Every block offers at least one control, and none offers one that does
 * nothing.** That is a rule about this table, not a coincidence in it. Opening
 * hours used to open an empty panel; a full-width row of links used to be
 * offered an alignment that `text-align` cannot move. It is also why `margin`
 * is on every row but the spacer's: a spacer draws nothing, so where its edges
 * sit is a number with no pixel behind it.
 */
export const CARD_BLOCKS: Record<CardBlockType, CardBlockSpec> = {
  gallery: {
    zones: CARD_ZONES,
    unique: true,
    // No `align`: a full-width photo fills its box, and a narrowed one centres,
    // which is what it has always done. `fit` is the one thing about a photo
    // that alignment cannot say — what happens to the part of it that does not
    // fit the height its owner chose.
    controls: ["height", "width", "padding", "margin", "fit", "valign"],
    /*
     * 25% of a 440px card is 110px, which is the photo height the card has
     * always drawn. The default layout has to reproduce today's card, not
     * improve on it — a map whose owner never opens the designer must not find
     * their popup redesigned (CLAUDE.md §7).
     */
    defaultHeightPct: 25,
    maxHeightPct: 70,
    ...NARROWABLE,
  },
  logo: {
    zones: CARD_ZONES,
    unique: true,
    /*
     * No `width`: a logo is a mark of a fixed size, not a column, so it cannot
     * share a line and has nothing for a share to be a share of. `height` is its
     * diameter — it is drawn square, because a brand mark that is wider than it
     * is tall is a wordmark and belongs in the name.
     *
     * `align` here moves the *box*, not the words — see `SELF_SIZED`.
     *
     * `logo` is the one thing about this block that is not a measurement: a pin
     * carrying an uploaded image can be drawn as that image on its own, without
     * the body and ring around it. See `logoImageOf`.
     */
    controls: ["height", "align", "overlap", "margin", "logo"],
    /*
     * 14% of a 440px card is 62px, which is about the size a brand mark reads at
     * over a photo without becoming the photo. The ceiling is well under the
     * gallery's own, because a logo taller than the picture it sits on is not a
     * logo.
     */
    defaultHeightPct: 14,
    maxHeightPct: 40,
    defaultOverlapPct: 50,
    defaultAlign: "center",
  },
  name: {
    // Not `bottom`: a card whose heading is the last thing on it reads as a
    // caption for the block above rather than as the name of the place.
    zones: ["top", "middle"],
    unique: true,
    controls: ["width", "align", "padding", "margin", "valign", "text"],
    ...NARROWABLE,
    ...TEXT_PADDING,
  },
  // Retired — see `CardBlockType`. Same controls as it always had, because a
  // layout that set them is still drawing them.
  category: {
    zones: ["top", "middle"],
    unique: true,
    retired: true,
    // `chips` alongside the rest because this draws a chip too — one, the
    // location's first tag. A retired block still has to be editable by whoever
    // saved it, and a panel poorer than the Tags one would make the fix for that
    // "delete the block and drop a different one", which is a design somebody
    // made being thrown away.
    controls: [
      "width",
      "align",
      "padding",
      "margin",
      "valign",
      "text",
      "chips",
    ],
    ...NARROWABLE,
    ...TEXT_PADDING,
  },
  /*
   * The tags this location wears, as a row of chips.
   *
   * A wrapping row of however many apply, which makes it the one text block
   * whose height genuinely varies with the *location* rather than with its
   * words. That is why it sits below the description in the default layout
   * rather than under the name — a stockist carrying six product lines would
   * otherwise push the address off the card.
   */
  tags: {
    zones: ["top", "middle"],
    unique: true,
    controls: [
      "width",
      "align",
      "padding",
      "margin",
      "valign",
      "text",
      "chips",
    ],
    ...NARROWABLE,
    ...TEXT_PADDING,
  },
  address: {
    zones: ["top", "middle"],
    unique: true,
    controls: ["width", "align", "padding", "margin", "valign", "text"],
    ...NARROWABLE,
    ...TEXT_PADDING,
  },
  description: {
    zones: ["middle"],
    unique: true,
    controls: ["align", "padding", "margin", "text", "clamp"],
    ...TEXT_PADDING,
  },
  hours: {
    zones: ["middle", "bottom"],
    unique: true,
    controls: ["align", "padding", "margin", "text", "hours"],
    ...TEXT_PADDING,
  },
  // Retired — see `CardBlockType`. Same controls as it always had, because a
  // layout that still names it is still drawing it, and an owner who saved one
  // has to be able to space it the way they always could.
  details: {
    zones: ["middle", "bottom"],
    unique: true,
    retired: true,
    // A summary line over a stack of rows. Room around it is the one thing
    // worth choosing; it is full width by nature and its rows are not text
    // `text-align` can move.
    controls: ["padding", "margin", "text"],
    ...TEXT_PADDING,
  },
  actions: {
    // Bottom only. These are the reason the card exists, and a card that puts
    // its calls to action above the address has buried the answer under them.
    zones: ["bottom"],
    unique: true,
    /*
     * `align` is here, and it needed a second thing to work at all: this row is
     * a wrapping flex list, and `align` reaches a block as `text-align`, which
     * cannot move a flex item. Both renderers read `justifyOf` for it — the
     * same fix `chipStyleOf`'s own `justify` is, and the reason that mapping is
     * exported now.
     */
    controls: ["align", "padding", "margin", "text", "links"],
  },
  /*
   * One press, drawn as a button.
   *
   * Middle as well as bottom, where the `actions` row is bottom-only: that rule
   * is about a *row of every way to reach a place* landing above the address it
   * is competing with. A single call to action under the description is a real
   * design, and the block is not the row.
   *
   * Not unique, for the divider's reason: two buttons is the point. Directions
   * and "Book a fitting" are different presses, and a card that could hold only
   * one of them would make its owner choose between them.
   */
  button: {
    zones: ["middle", "bottom"],
    unique: false,
    defaultButtonFull: true,
    controls: [
      "width",
      "align",
      "padding",
      "margin",
      "valign",
      "text",
      "button",
      "buttonStyle",
    ],
    ...NARROWABLE,
    ...TEXT_PADDING,
  },
  divider: {
    zones: CARD_ZONES,
    // The one block worth having twice.
    unique: false,
    // A rule has no content to align — narrowing it is how it is positioned.
    controls: ["width", "padding", "margin", "valign"],
    /*
     * A hairline is one pixel tall, which is a block nobody can click on, and
     * the divider is the one type with no height control to grow it with. Its
     * padding is therefore what gives it a body: 6 on each side makes a fresh
     * divider a 13px target that still draws a 1px rule. Slide it to 0 and the
     * old hairline is back.
     *
     * More room around a rule is also what a rule is usually for, so this is
     * closer to what someone dropping one meant than a line touching the block
     * above it was.
     */
    defaultPadding: 6,
    ...NARROWABLE,
  },
  spacer: {
    zones: CARD_ZONES,
    unique: false,
    // Nothing inside it, so there is nothing for padding or alignment to move.
    controls: ["height"],
    defaultHeightPct: 6,
    maxHeightPct: 30,
  },
};

/** Whether this block type offers this control. The one place that is asked. */
export function hasControl(
  type: CardBlockType,
  control: CardBlockControl,
): boolean {
  const spec = CARD_BLOCKS[type] as CardBlockSpec | undefined;

  return spec ? spec.controls.includes(control) : false;
}

/**
 * How much of its line this block takes, as a percentage. 100 is the whole card.
 *
 * **The one place a stored `half` is turned back into a number**, and the reason
 * it is a function rather than something `readBlock` alone handles: the embed
 * draws `snapshot.cardLayout` exactly as it was published, without re-resolving
 * it (embed/src/map.ts). So `cardRows` and `blockBox` — the two things that
 * decide what a line looks like — have to be able to read a layout that has never
 * been near the resolver, and every card published before the width control
 * existed says `half: true` rather than `widthPct: 50`.
 *
 * Everything else asks this instead of reading `widthPct`, so there is exactly
 * one place that knows the legacy field exists.
 */
export function shareOf(block: CardBlock): number {
  if (block.half === true) return 50;

  return block.widthPct ?? 100;
}

/** Whether this block leaves room on its line for another one. */
export function isNarrow(block: CardBlock): boolean {
  return shareOf(block) < 100;
}

/**
 * How wide a *line* is, in px — what a share is a share of.
 *
 * The card less its own padding, which the zone pays for every block alike. One
 * function because both this file and the drop geometry work in it, and a second
 * copy of `width - padding * 2` is a second place to forget the `* 2`.
 */
export function lineWidthOf(layout: CardLayout): number {
  return Math.max(1, layout.width - layout.padding * 2);
}

/**
 * What a self-sized block reserves of its line, as a share.
 *
 * A mark is a number of **pixels** — its own square — where every other block is
 * a percentage, so it has no share of its own to read. This derives one, which
 * is what lets a logo take part in the same greedy line-packing everything else
 * does instead of needing a model of its own.
 *
 * The `+ gap` is the column gap the mark costs the line it joins, and the `ceil`
 * is the direction that is safe to be wrong in: rounding a mark's share *up*
 * leaves the line a pixel short of full, where rounding down would let two
 * neighbours be offered a total the row cannot hold.
 *
 * Derived, never stored. A logo dragged bigger reserves more of its line the
 * next time anything asks, with nothing to keep in step — which is the same
 * argument that keeps pairing itself out of the layout (see `cardRows`).
 */
export function selfShareOf(block: CardBlock, layout: CardLayout): number {
  const spec = CARD_BLOCKS[block.type] as CardBlockSpec | undefined;
  const pct = block.heightPct ?? spec?.defaultHeightPct ?? 0;
  const size = Math.round((layout.maxHeight * pct) / 100);

  return Math.min(
    100,
    Math.ceil((100 * (size + layout.gap)) / lineWidthOf(layout)),
  );
}

/**
 * How much of its line this block takes, whichever kind of block it is.
 *
 * `shareOf` answers for everything that has a stored width; this is that plus
 * the one kind that does not. Everything deciding what fits on a line asks this
 * rather than `shareOf`, which stays the narrower question — "what does this
 * block's own `widthPct` say" — that the renderers still need on its own.
 */
export function shareOfAny(block: CardBlock, layout: CardLayout): number {
  return isSelfSized(block.type) ? selfShareOf(block, layout) : shareOf(block);
}

/**
 * How far this block is pulled over the neighbour beside it in the stack, in px.
 *
 * A percentage of the block's **own** height, so it needs that height resolved
 * against the card first — which is why it is a function of the layout and not
 * something a block can answer alone.
 *
 * Exported for the same reason `selfShareOf` is: the drop geometry has to draw
 * its outline where the block will actually land, and a logo lands half its own
 * height above the position its offset names. Two copies of this arithmetic —
 * one here for the renderer, one there for the outline — would be two numbers
 * that agree today, and the symptom of them drifting is a mark promising a
 * place the block does not go.
 *
 * Zero for every block that overlaps nothing, which is everything but the logo:
 * `normaliseBlock` only writes `overlapPct` where the spec offers the control.
 * Whether the overlap *applies* is a different question and not this one's — it
 * is against a sibling in the same zone, and only the renderer walking that zone
 * knows. See `blockEdges` in components/card/card-frame.tsx.
 */
export function overlapOf(block: CardBlock, layout: CardLayout): number {
  if (!block.overlapPct || !block.heightPct) return 0;

  const height = Math.round((layout.maxHeight * block.heightPct) / 100);

  return Math.round((height * block.overlapPct) / 100);
}

/**
 * How far this block is drawn **above** where it sits, in px.
 *
 * `overlapOf` is how far a block is pulled; this is how far it is *actually*
 * pulled, which is a different question because an overlap is against the line
 * above it and the top line of a zone has none. Pulling one up anyway takes it
 * out through the top of the zone — which the middle zone clips (it is the
 * card's only scroller) and the top zone answers by fighting its own padding
 * cancel.
 *
 * **A line, not a block, and that distinction is the whole reason this exists.**
 * It used to be asked as "is this the zone's first *block*", separately by
 * `blockEdges`, by the embed's `wrapBlock` and by the drop geometry. On a card
 * whose first line is `[address][logo]` the logo is the zone's second block, so
 * it was pulled up over a zone that had nothing above it — and moving the
 * address off that line made the logo the zone's *first* block, which switched
 * the pull off and dropped the logo half its own height. One gesture, two blocks
 * moving, with `layoutId` faithfully animating the one nobody touched.
 *
 * Zero for `overlapEdge: "below"`, which pulls the block *underneath* it up
 * instead and moves nothing about its own position.
 */
export function upwardLiftOf(
  block: CardBlock,
  layout: CardLayout,
  /**
   * Whether this block's **line** has another line above it in its own zone —
   * `row.index > 0`, never `blockIndex > 0`.
   */
  hasLineAbove: boolean,
): number {
  if (!hasLineAbove || block.overlapEdge === "below") return 0;

  return overlapOf(block, layout);
}

/**
 * The blocks the "More details" fold can hold, in the order it shows them.
 *
 * Both of them are on the default card, so the default card's fold draws
 * nothing — `detailsContents` subtracts whatever has been placed, and
 * `hasBlockContent("details")` is false for an empty fold. That is the fold
 * doing its job rather than a gap in it: it is there for the owner who drags
 * the description or the week *off* the card and wants them one click away.
 */
export const DETAILS_CONTENTS: readonly CardBlockType[] = [
  "description",
  "hours",
];

export type CardBlockAlign = "start" | "center" | "end";

/**
 * Where a block sits on the *cross* axis of the line it shares.
 *
 * Only two words, because the third is the absence: a flex row stretches its
 * items by default, and stretching is what every card drew before this field
 * existed. So "top" is not stored, in the same way full width is not stored — a
 * card nobody has centred anything on publishes the bytes it always did.
 */
export type CardBlockValign = "center" | "end";

export type CardBlock = {
  /**
   * Stable for the life of the block, so a drag is a move rather than a delete
   * and an add — which is what lets the list animate it travelling.
   */
  id: string;
  type: CardBlockType;
  /**
   * Percentage of the card's width. Absent means the full width.
   *
   * Anything under 100 also **reserves the rest of the line**: `cardRows` gives
   * the block a row of its own and the block after it joins that row if the two
   * shares fit together. So this one number says both how wide the block is and
   * whether something can sit beside it, which is what makes "put a name next to
   * the photo" a thing you do by dragging the width in rather than by finding a
   * separate control for it.
   */
  widthPct?: number;
  /**
   * **Legacy.** Half the card's width, sharing its line with the block beside it.
   *
   * Read, never written. It is exactly `widthPct: 50`, and `readBlock` turns it
   * into one — but `cardRows` and `blockBox` still honour it directly, because
   * the embed renders `snapshot.cardLayout` **as it was published** without
   * running it back through the resolver (embed/src/map.ts). A card live on a
   * customer's site today carries this field, and it has to keep drawing the two
   * columns it drew. Same shape as `bleed` below, which `margin` replaced.
   */
  half?: true;
  /**
   * This block begins its own line instead of joining the narrowed block before
   * it.
   *
   * The one thing greedy adjacency cannot say on its own, and it has to be
   * sayable: three consecutive narrow blocks that all fit together are always a
   * pair and then a single, so pulling one *out* of a pair to join the lone block
   * below it left the abandoned partner free to grab that one instead — and the
   * two blocks appeared to swap lines under the cursor. With this, the abandoned
   * partner keeps its own line and the intended pair forms below it.
   *
   * `true` or absent, never `false` — absent *is* the pairing every layout drew
   * before this field existed, and every snapshot already live on a customer's
   * site with it. Nothing sets it by hand — `preserveRows` in
   * lib/card/card-edits.ts writes it after an edit, as the record of which lines
   * were already there.
   *
   * Meaningless on a full-width block, which *is* its line, and therefore only
   * read on a narrowed one.
   */
  newLine?: true;
  /**
   * A narrowed block that is **alone** on its line sits at the line's end rather
   * than its start.
   *
   * A row is a plain flex row and a narrowed block never carries an `alignSelf`
   * (see `blockBox`), so it sat at the start and there was no way to ask for
   * anything else — the reserved space was always on the right, whatever its
   * owner wanted. This is that ask, and it is one word rather than a position
   * because there are only ever two ends to a line.
   *
   * Absent is the start, which is where a narrowed block has always sat. Ignored
   * once the line holds a pair: two shares and a gap already fill the row, so
   * there is nothing left for `justify-content` to move — see `cardRowBox`.
   *
   * Meaningless on a full-width block, and therefore only read on a narrowed one.
   */
  side?: "end";
  /**
   * Where this block sits on its line, top to bottom. Absent stretches, which is
   * what every block on a shared line did before this was adjustable.
   *
   * The one thing a pair of columns could not say. A row is `align-items:
   * stretch`, so a two-line name beside a photo four times its height drew at
   * the top of a column of empty space, and the only way to move it down was to
   * pad it by hand against a height that is different for every location.
   *
   * Read only on a narrowed block, alongside `newLine` and `side` and for the
   * same reason: it describes a *line*, and a full-width block is its own line —
   * exactly as tall as itself, with nothing for this to move. A block widened
   * back out therefore cannot leave a stale one behind.
   */
  valign?: CardBlockValign;
  /**
   * How far this block is pulled over the neighbour beside it in the stack, as a
   * percentage of its own height. `overlap` blocks only.
   *
   * 50 straddles the edge between them, which is the layout this exists for: a
   * mark half over the photo and half over the card below it. Zero is the
   * absence, on the same argument full width is the absence of a width.
   *
   * A percentage of the block rather than pixels, because it is set against the
   * block's own size — drag the logo bigger and "half over the edge" stays half
   * over the edge, where a stored number of pixels would quietly stop meaning
   * that.
   *
   * It applies against a **sibling in the same zone** and nowhere else. Only a
   * renderer knows whether there is one, so this is handed on as a length and
   * `blockEdges` decides — see `overlap` on `CardBlockBox`.
   */
  overlapPct?: number;
  /**
   * Which neighbour it overlaps. Absent is the one above it.
   *
   * Two directions because a card can put its photo at either end: a gallery in
   * the top zone is overlapped from below, and one in the bottom zone from
   * above. There is no third — a block only has two neighbours in a column.
   */
  overlapEdge?: "below";
  /**
   * How a picture meets the box it was given. `fit` blocks only.
   *
   * `"contain"` or absent, never `"cover"` — the absence *is* the cropping fill
   * every card has drawn since the gallery existed, including every snapshot
   * already live on a customer's site. The same argument full width is the
   * absence of a width.
   */
  fit?: "contain";
  /** Percentage of the card's height. `height` blocks only. */
  heightPct?: number;
  /**
   * Room inside the block's own box, in CSS pixels. Absent means none, which is
   * every card drawn before this field existed — so a layout saved then, and a
   * snapshot published then, still draws exactly what it drew.
   */
  padding?: number;
  /**
   * Which side the block's content sits on: its text, and the block itself once
   * it is narrower than the card. Absent inherits for text and centres a
   * narrowed block, which is what both did before this was adjustable.
   */
  align?: CardBlockAlign;
  /**
   * How far this block's own left and right edges sit from the card's, in CSS
   * pixels — *instead of* the card's padding, not on top of it. Zero reaches the
   * card's edges.
   *
   * Absent means the type's own default (`defaultMarginOf`), which is the card's
   * padding for everything except the blocks in `BLEEDS`. That is what makes
   * this field free to add: a layout saved before it existed, and a snapshot
   * already live on a customer's site, resolves to exactly the margins it drew.
   *
   * It replaces the `bleed` boolean, which could only say "zero or the card's
   * padding" and only said it for the gallery. A stored `bleed: true` is still
   * read, as `margin: 0` — see `readBlock`.
   */
  margin?: number;
  /**
   * Empty space *above* this block, in CSS pixels, on top of the card's own gap.
   *
   * This is how a card holds a block somewhere other than hard against the one
   * before it. Free space is stored as leading space on the block that follows
   * it rather than as an absolute position, because blocks are content-sized —
   * a name is as tall as the name — and the middle zone is the card's only
   * scroller. In a flex column, leading space cannot make two blocks overlap;
   * absolute positioning could, and on a card whose text is a different length
   * for every one of three thousand locations it would.
   *
   * Pixels, for the reason `padding` and `margin` are pixels: it is set against
   * the card's `gap`, which is pixels too. It is also what the designer's drop
   * slots are computed in, and a percentage of a 440px card quantises to 4.4px.
   *
   * Absent means none — which is every card drawn before this field existed, so
   * a layout saved then, and a snapshot already live on a customer's site, keep
   * drawing exactly what they drew.
   *
   * It is a **ceiling, not a reservation**. Every renderer draws it as a box
   * that gives way when the card runs out of room and comes back when the room
   * returns (`leadBox`), so what is stored is the space this block would like
   * above it and what is drawn is as much of that as the card can spare.
   */
  offset?: number;
  /**
   * The typeface this block's words are set in, as a `font-family` value.
   * `text` blocks only.
   *
   * A **stack**, not a name — the whole string, ready to write onto the
   * element. See packages/shared/card-fonts.ts for why the catalogue's key is
   * not what travels, and why the list is closed.
   *
   * Absent inherits the card's own font, which is what every block drew before
   * this field existed.
   */
  font?: string;
  /**
   * Type size in CSS pixels. `text` blocks only.
   *
   * Pixels, for the reason `padding` and `margin` are: it is set against a card
   * whose every other measurement is pixels, and a percentage of a 320px card
   * says nothing about how big a letter is.
   *
   * Absent is the block's own default size — 14px for a name, 13px for an
   * address — which each renderer keeps as the fallback in its own stylesheet
   * rather than resolving here. That is what makes this field free to add: a
   * block nobody has sized draws the pixels it always drew.
   */
  fontSize?: number;
  /**
   * The colour of this block's words, as a hex string. `text` blocks only.
   *
   * Absent is the block's own default — the foreground for a name, the muted
   * shade for an address — and, as with `CardLayout.background`, absent is
   * emphatically *not* a literal. A stored `#111111` is a card that stops
   * working the moment a visitor's map is dark.
   */
  color?: string;
  /**
   * Bold. `text` blocks only.
   *
   * `true` or absent, never `false`: the absence *is* the block's own weight,
   * which for a name is already 600. So this cannot un-bold a heading — it can
   * only make something bold that was not. The panel says so by showing the
   * name's checkbox already ticked.
   */
  bold?: true;
  /**
   * The week starts open rather than showing only today. `hours` blocks only.
   *
   * Absent collapses, and that is load-bearing rather than arbitrary: the embed
   * has always drawn a collapsed `<details>` here, and the embed is what a
   * customer publishes. Reading absence as anything else would reopen every
   * card already live on a customer's site.
   */
  hoursOpen?: true;
  /** "Monday" rather than "Mon". `hours` blocks only. Absent is short. */
  hoursLongDays?: true;
  /**
   * Space between the week's rows, in CSS pixels. `hours` blocks only.
   *
   * Absent is `DEFAULT_HOURS_ROW_GAP`, which is what the embed's list has
   * always drawn — so a week nobody has spaced out is the week it was.
   */
  hoursRowGap?: number;
  /**
   * Clip the paragraph after this many lines. `clamp` blocks only.
   *
   * Absent shows the whole thing, which is what both renderers have always
   * done. So the control reads as *"show the whole description"*, ticked, and
   * unticking it is what writes a number here.
   *
   * **A clipped paragraph is also a fold**, and this is the only field that says
   * so. Both renderers give it the chevron the week has, opening onto the rest
   * of the text — because clipping a description with no way to read the end of
   * it is not a design, it is a paragraph with its last sentence deleted. A
   * description nobody has clipped stays the plain `<p>` it has always been, so
   * no published card grows a control it did not have.
   */
  clampLines?: number;
  /**
   * The ground each chip is drawn on, as a hex string. `chips` blocks only.
   *
   * Absent is the soft neutral both renderers already draw, and absent is
   * emphatically *not* a literal, for `color`'s reason one step further out: a
   * stored `#f1f3f5` is a row of pale pills that disappear the moment a
   * visitor's map is dark. The colour belongs to the tags on a card, not to the
   * theme the card is being read in.
   */
  chipBackground?: string;
  /**
   * Room inside each chip, in CSS pixels, on top of what a chip already has.
   * `chips` blocks only.
   *
   * Additive rather than absolute, which is what keeps it free to add: absent is
   * zero, and zero is the pill every card has drawn since there were chips at
   * all. It is also the honest shape of the control — someone dragging this is
   * making the chips roomier than they are, not specifying a box from scratch.
   */
  chipPadding?: number;
  /**
   * The outline around each chip, as a hex string. `chips` blocks only.
   *
   * Absent is **no outline at all**, which is the pill both renderers have drawn
   * since there were chips — not a colour resolved from the theme. That is the
   * difference between this and `chipBackground`, whose absence is a real ground
   * the stylesheet paints: there is nothing to fall back to here, so absent has
   * to mean off, and `chipBorderWidth` is only a width of something once this is
   * set.
   */
  chipBorder?: string;
  /**
   * How thick that outline is, in CSS pixels. `chips` blocks only.
   *
   * Absent and zero are the same nothing, and zero is what every card already
   * draws — which is what makes the pair free to add (CLAUDE.md §7). The panel
   * only offers it once there is a colour, for the reason the card's own Border
   * width is only offered once the card has a border: a width with no colour is
   * a control that visibly does nothing.
   */
  chipBorderWidth?: number;
  /**
   * Draw the pin's uploaded image on its own, instead of the whole pin. `logo`
   * blocks only.
   *
   * Spelled as the one non-default value the way `fit` is: **absent is the pin**,
   * body and ring and glyph, which is what every card drawn before this field
   * existed draws and what a location with no uploaded logo still gets. See
   * `logoImageOf`, which is the one place the fallback is decided.
   */
  logoMode?: "image";
  /**
   * What pressing this button does. `button` blocks only.
   *
   * Spelled as the one non-default value, the way `fit` and `logoMode` are —
   * and **the absence is Directions**, which is the choice worth explaining. A
   * block arrives on the card before anybody configures it, and directions are
   * the one destination every location can answer for: it needs a coordinate,
   * and a coordinate is the one thing a place cannot be missing. A button that
   * defaulted to a link would draw nothing until its owner found the picker,
   * which reads as a block that failed to render.
   */
  buttonAction?: "link";
  /**
   * Which of the location's own values holds the link. `button` blocks only,
   * and only in link mode.
   *
   * Absent is the location's **Website** (`place.url`); a value is the id of one
   * of the map's custom fields. Website is the absence rather than a reserved
   * word, so there is no sentinel that a field id could one day collide with —
   * the same reason `newTagId` never derives an id from a label.
   *
   * A **source**, never a URL. The card design is saved per account and drawn
   * for every location on every map, so a URL stored here would send three
   * thousand pins to one page. The consequence is that a button bound to a
   * custom field draws nothing on a map that has no such field — which is
   * exactly what it does for a location that left the field blank, and the rule
   * every other block already follows.
   */
  buttonSource?: string;
  /**
   * What the button says. `button` blocks only.
   *
   * Absent is the action's own word — "Directions", "Website", or the custom
   * field's own label, which is what the card's CTA rows already use in
   * preference to the value (forty characters of tracking parameters is not a
   * label).
   */
  buttonLabel?: string;
  /**
   * The ground the button is drawn on, as a hex string. `buttonStyle` blocks
   * only.
   *
   * Absent is the ground the stylesheet paints, and absent is emphatically
   * *not* a literal — `chipBackground`'s argument, which bites harder here: a
   * stored `#ffffff` is a button that vanishes into a dark card, and a button
   * nobody can see is the one block on the card whose whole job is to be
   * pressed.
   */
  buttonBackground?: string;
  /**
   * The outline around the button, as a hex string. `buttonStyle` blocks only.
   *
   * Absent is **the button's own label colour**, which is `currentColor` in both
   * stylesheets — so an outline nobody has picked a colour for is theme-aware,
   * where a stored literal could not be, and an Outline treatment keeps the
   * colour the theme gave it.
   *
   * **Unlike `chipBorder`, this half is optional on its own.** A chip has
   * nothing under its edge to fall back to, so there absent has to mean off and
   * the pair travels as one. A button does: its label is already a colour the
   * owner can see, and the width alone is a complete answer to "put a line
   * round it". That is deliberate divergence rather than drift — the control
   * that used to enforce the pair here did it by stamping a hard-coded blue on
   * the first nudge of the width, which is a colour nobody picked appearing in
   * a field nobody opened.
   */
  buttonBorder?: string;
  /**
   * How thick that outline is, in CSS pixels. `buttonStyle` blocks only.
   *
   * Stands alone — see `buttonBorder`. Absent and zero are the same nothing,
   * which is what every card published before this existed draws.
   */
  buttonBorderWidth?: number;
  /**
   * How round the button's corners are, in CSS pixels. `buttonStyle` blocks
   * only. Absent is the corner the stylesheet already draws.
   */
  buttonRadius?: number;
  /**
   * Room inside the button, in CSS pixels, on top of what it already has.
   * `buttonStyle` blocks only.
   *
   * Additive rather than absolute, which is what keeps it free to add and is
   * the honest shape of the control: someone dragging this is making the button
   * chunkier than it is, not specifying a box from scratch. It is a different
   * question from the block's own `padding` — that holds the button off its
   * neighbours, this holds the label off the button's own edge.
   */
  buttonPadding?: number;
  /**
   * The button fills its block rather than hugging its label. `buttonStyle`
   * blocks only.
   *
   * `true` or absent, never `false` — the absence is a button the width of what
   * it says, which is what `align` then has something to move. Full width is
   * the state that has to be asked for, because a full-width button is a
   * decision about the card and a hugging one is just a button.
   */
  buttonFull?: true;
  /**
   * How the button's ground is painted. `buttonStyle` blocks only.
   *
   * **Absent is the filled button every card already draws**, which is what
   * makes this free to add (CLAUDE.md §7): a design published before this field
   * existed carries none of it and still draws the solid accent box it drew.
   *
   * Three treatments rather than three colours, and that is the decision worth
   * explaining. Outline, soft and ghost all need a *transparent or translucent*
   * ground, and `hex` below accepts `#rgb`/`#rrggbb` alone — no alpha, no
   * keyword — so none of them can be said as a `buttonBackground`. Widening the
   * colour parser was the alternative and is worse twice over: it puts a value
   * `ColorPickerField` cannot draw into the one field an owner edits by hand,
   * and it stores a literal where the absence is what keeps a card theme-aware.
   *
   * As a treatment instead, each one takes its line and its label from
   * `--card-button-bg`, which falls back to the theme's own accent — so a ghost
   * button stays readable on a dark card, where a stored `#ffffff` could not.
   * The renderers turn this into a class rather than a value; see `buildButton`
   * in embed/src/popup.ts, which must look the class up rather than trust the
   * string, because the embed draws a published snapshot without re-parsing it.
   */
  buttonVariant?: CardButtonVariant;
  /**
   * What the button does under the pointer. `buttonStyle` blocks only.
   *
   * **Absent is the darkening wash**, which is the hover both stylesheets have
   * always drawn — so, again, nothing already live moves. Spelled as the three
   * departures from it, the way `fit`, `logoMode` and `buttonAction` each spell
   * only their non-default value.
   *
   * It is here at all because a button is the one block on a card whose whole
   * job is to be pressed, and an owner who has coloured one to their brand has
   * no way to say that the wash over it is wrong.
   */
  buttonHover?: CardButtonHover;
  /**
   * The ways to reach a place this Links row does **not** draw. `links` blocks
   * only.
   *
   * Four fields rather than one list, because each is a separate question with
   * a separate checkbox, and a list would have to be sorted, deduplicated and
   * validated against a vocabulary to say the same thing.
   *
   * **Spelled as the hidden state, so absent means shown.** Every card already
   * live on a customer's site draws all four; were these `showPhone` the
   * absence would have to be read as `true`, and every snapshot would be
   * carrying a field whose meaning is the opposite of what it says. This way a
   * card nobody has touched publishes the bytes it always did — the same
   * argument `half`, `bleed` and `newLine` each carry.
   */
  hidePhone?: true;
  hideEmail?: true;
  hideWebsite?: true;
  hideDirections?: true;
};

/**
 * How a button's ground is painted. See `CardBlock.buttonVariant`, which holds
 * the argument for why this is a treatment rather than three stored colours.
 *
 * Absent — a filled button — is deliberately not a member: it is the state the
 * field says by not being there, and a word for it would be a second way to say
 * the same thing that every published card already says with silence.
 */
export type CardButtonVariant = "outline" | "soft" | "ghost";

/** What a button does under the pointer. Absent is the darkening wash. */
export type CardButtonHover = "none" | "lighten" | "lift";

export type CardShadow = "none" | "soft" | "strong";

export type CardLayout = {
  v: 1;
  /** CSS pixels. The embed may still cap the card against a short map. */
  width: number;
  maxHeight: number;
  radius: number;
  padding: number;
  /** Between blocks within a zone. */
  gap: number;
  /**
   * Hex, and **absent is not white** — absent means the surface colour of
   * whichever theme the card is drawn in. A stored `#ffffff` would be a card
   * that stops working the moment a visitor's map is dark, which is the same
   * trap an unstyled pin ring avoids by staying unset.
   */
  background?: string;
  border?: string;
  borderWidth: number;
  shadow: CardShadow;
  zones: Record<CardZone, CardBlock[]>;
};

const CARD_LIMITS = {
  width: [220, 480],
  maxHeight: [180, 720],
  radius: [0, 28],
  padding: [0, 28],
  gap: [0, 20],
  borderWidth: [0, 6],
  /*
   * A block's own padding, in pixels.
   *
   * Capped well below the card's width on purpose: this is room around content,
   * not a second layout system, and 24px on each side of a 220px card is
   * already most of it.
   */
  blockPadding: [0, 24],
  /*
   * A block's own margin, in pixels. The same ceiling as the card's padding,
   * because that is the number this one stands in for — a block may be pushed
   * as far in as the card itself could push everything, and no further.
   */
  blockMargin: [0, 28],
  /*
   * Type size, in pixels.
   *
   * The floor is where text stops being readable rather than merely small; the
   * ceiling is a name across a 220px card, which is the narrowest card there
   * can be. Anything larger is not a card, it is a poster.
   */
  fontSize: [10, 32],
  /*
   * How far apart the rows of a week sit, in pixels.
   *
   * Zero is the rows touching, which is a dense but real design. Twelve is
   * already seven times twelve pixels of leading in a card capped at 720, so
   * there is no honest reason to go further.
   */
  hoursRowGap: [0, 12],
  /*
   * Extra room inside a chip, in pixels, on top of what a chip already has.
   *
   * Ten rather than `blockPadding`'s twenty-four, and the ceiling is a different
   * question from the block's: this is added on *every* chip, so on a location
   * wearing six of them it is paid six times across a card that may be 220px
   * wide. Ten already turns a 20px pill into a 40px one.
   */
  chipPadding: [0, 10],
  /*
   * How thick a chip's outline is, in pixels.
   *
   * Four, and low on purpose: this is a hairline around a 20px pill, not a
   * frame. Past four the outline is most of what the chip is, and it is drawn
   * on every chip a location wears — the same multiplier `chipPadding` above is
   * capped for. Zero is off, which is what every published card draws.
   */
  chipBorderWidth: [0, 4],
  /*
   * How many lines of a description are shown before it is clipped.
   *
   * One is a headline; six is most of a 440px card. The absence of a number is
   * "all of it", which is the case this range does not have to cover.
   */
  clampLines: [1, 6],
  /*
   * How thick a button's outline is, in pixels.
   *
   * The card's own `borderWidth` ceiling rather than a chip's four: a button is
   * a box the size of a control, not a 20px pill, and there is exactly one of
   * it — so the multiplier that keeps `chipBorderWidth` low does not apply.
   */
  buttonBorderWidth: [0, 6],
  /*
   * How round a button's corners are, in pixels.
   *
   * The card's own `radius` ceiling. Past it a button is rounder than the card
   * holding it, which reads as a mistake rather than as a design — and at 28 on
   * a button about 32px tall it is already a pill, which is the roundest thing
   * anyone is reaching for.
   */
  buttonRadius: [0, 28],
  /*
   * How much room a button has inside its own box, in pixels.
   *
   * Its own number rather than `blockPadding`'s, because it is paid twice over:
   * the block's padding holds the button off its neighbours, and this holds the
   * label off the button's own edge. Fourteen on each side of a 220px card is
   * already a wide button with a short word in it.
   */
  buttonPadding: [0, 14],
} as const;

/** The narrowest and widest type a block may be set in, for the control. */
export const MIN_BLOCK_FONT_SIZE: number = CARD_LIMITS.fontSize[0];
export const MAX_BLOCK_FONT_SIZE: number = CARD_LIMITS.fontSize[1];

/** The ceiling on the space between a week's rows, for the control. */
export const MAX_HOURS_ROW_GAP: number = CARD_LIMITS.hoursRowGap[1];

/**
 * What a week's rows sit apart by when nobody has said.
 *
 * One pixel, because that is what `.lm-popup__hours-list` has always drawn and
 * a published card must not move. The dashboard's own list drew zero, which is
 * the one pixel of drift this field closes rather than preserves.
 */
export const DEFAULT_HOURS_ROW_GAP = 1;

/** How many lines an unticked "show it all" clips to. */
export const DEFAULT_CLAMP_LINES = 2;

/** The most lines a clipped description may keep, for the control. */
export const MAX_CLAMP_LINES: number = CARD_LIMITS.clampLines[1];

/** The thickest a chip's outline may be, for the control that sets it. */
export const MAX_CHIP_BORDER_WIDTH: number = CARD_LIMITS.chipBorderWidth[1];

/**
 * What an outline is set to the first time a colour is picked for one.
 *
 * A colour with no width would be a picker that visibly does nothing, so the
 * control seeds this alongside it. One pixel is a hairline, which is what an
 * outlined chip usually wants.
 */
export const DEFAULT_CHIP_BORDER_WIDTH = 1;

/** The ceiling on a block's own padding, for the control that sets it. */
export const MAX_BLOCK_PADDING: number = CARD_LIMITS.blockPadding[1];

/** The ceiling on the extra room inside a chip, for the control that sets it. */
export const MAX_CHIP_PADDING: number = CARD_LIMITS.chipPadding[1];

/** The ceiling on a block's own margin, for the control that sets it. */
export const MAX_BLOCK_MARGIN: number = CARD_LIMITS.blockMargin[1];

/** The thickest a button's outline may be, for the control that sets it. */
export const MAX_BUTTON_BORDER_WIDTH: number = CARD_LIMITS.buttonBorderWidth[1];

/**
 * What a button's outline is set to the first time a colour is picked for one.
 *
 * `DEFAULT_CHIP_BORDER_WIDTH`'s reason exactly: a colour with no width is a
 * picker that visibly does nothing, so the control seeds this alongside it.
 */
export const DEFAULT_BUTTON_BORDER_WIDTH = 1;

/** The roundest a button's corners may be, for the control that sets it. */
export const MAX_BUTTON_RADIUS: number = CARD_LIMITS.buttonRadius[1];

/** The most room a button may have inside it, for the control that sets it. */
export const MAX_BUTTON_PADDING: number = CARD_LIMITS.buttonPadding[1];

/**
 * The longest a button's own label may be, for the control and the schema.
 *
 * Forty characters is already more than fits across a 220px card, which is the
 * narrowest card there can be. It is a cap on what can be *stored* rather than
 * on what reads well — the card clips what does not fit either way, and the
 * reason to have a number at all is that this text is written into a stranger's
 * page.
 */
export const MAX_BUTTON_LABEL = 40;

/**
 * The longest a button's source id may be. A custom field id, and ids in this
 * codebase are short random strings — this is a bound on nonsense, not a
 * meaningful limit.
 */
export const MAX_BUTTON_SOURCE = 64;

/**
 * The ceiling on a block's `offset`, for the schema that bounds the column.
 *
 * The tallest card there can be, because free space is bounded by the card and
 * a card's own height is what bounds it. `readBlock` then clamps each block
 * against *this* card's `maxHeight`, which is the real limit; this is only a
 * bound on the number that can be stored at all.
 */
export const MAX_BLOCK_OFFSET: number = CARD_LIMITS.maxHeight[1];

const SHADOWS: readonly CardShadow[] = ["none", "soft", "strong"];
const ALIGNS: readonly CardBlockAlign[] = ["start", "center", "end"];
const VALIGNS: readonly CardBlockValign[] = ["center", "end"];

/**
 * The card every map gets, expressed as a layout.
 *
 * This is not a suggestion, it is a contract, and it binds in two directions:
 * `lib/snapshot/build.ts` omits the layout from a snapshot entirely when it
 * matches this, and `embed/src/popup.ts` falls back to it when a snapshot has
 * none. The two therefore have to agree exactly or a published map draws a
 * different card from the one its owner is looking at, and the test holds them
 * to it.
 *
 * It is also, for now, the *only* card: the designer is unfinished, so
 * lib/card/designer-status.ts routes every reader here regardless of what an
 * account has saved. That raises the bar on this function — it is no longer
 * "what someone gets before they design anything", it is what everyone gets.
 *
 * **Description and hours are on the card, not behind the fold.** They used to
 * be in `details` along with the custom fields, which meant the default card
 * showed a photo, a name, a chip and a street, and hid everything a visitor
 * standing outside the shop actually wants — when it opens, and what it is.
 * That was defensible while it was one of several cards an owner could choose
 * between. It is not defensible as the card. `fields` stays folded, because a
 * map's extra fields are as often an internal reference as they are something
 * to read.
 *
 * **"More details" is not on it, and is retired.** The fold could only ever
 * hold the description and the week, and both of those are on the card above —
 * so `detailsContents` subtracted them both and the block drew nothing at all,
 * on the card everybody gets. A control that is always empty is not a fold, it
 * is a row of dead pixels; it is out of this function and out of the palette,
 * and it still draws wherever a saved layout or a published snapshot names it.
 *
 * **Tags are on it, and the Category block is not.** The embed has always let a
 * visitor *filter* by tag; until the tags block there was nothing letting them
 * see which tags the pin they clicked actually wears, so "why did this one
 * match?" was answered nowhere. Categories then merged into tags outright, so
 * the Category block would be a second chip drawn from the same list — it stays
 * in `CardBlockType` for layouts that already name it and is `retired` here.
 *
 * Below the description rather than under the name, because it is a wrapping row
 * and a location with six tags would otherwise push the street off the card.
 *
 * Note what changing this function does and does not do: every account that has
 * never opened the designer gets the new arrangement immediately, and an account
 * with a *saved* layout does not — its design is its own, and quietly editing it
 * would be this function reaching into a card somebody arranged. Such a layout
 * keeps drawing its Category block, which is why that block is retired rather
 * than deleted.
 *
 * The order is the order somebody reads it in: what this is, where, what it's
 * like, what it offers, when it's open — then how to reach it.
 */
export function defaultCardLayout(): CardLayout {
  return {
    v: 1,
    width: 320,
    maxHeight: 440,
    radius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 0,
    shadow: "soft",
    zones: {
      top: [
        {
          id: "gallery",
          type: "gallery",
          heightPct: CARD_BLOCKS.gallery.defaultHeightPct,
        },
      ],
      middle: [
        { id: "name", type: "name" },
        { id: "address", type: "address" },
        { id: "description", type: "description" },
        { id: "tags", type: "tags" },
        { id: "hours", type: "hours" },
      ],
      bottom: [{ id: "actions", type: "actions" }],
    },
  };
}

/**
 * A blank card: the default's numbers, no padding, and no blocks at all.
 *
 * **The padding is the one number it does not take from the default**, and that
 * is the difference between a blank canvas and a finished card. A half-width or
 * narrowed block cannot bleed — `blockBox` forces its margin to the card's own
 * padding, because two bleeding halves side by side would make their row wider
 * than the card holding it — so on a padded blank card the first photo someone
 * halves sits a visible strip in from the wall, with nothing on the far side of
 * that strip to explain it. Someone arranging a card from nothing should start
 * against the edges and add room where they want it, rather than find room they
 * never asked for and have to take it back.
 *
 * Not what an unconfigured account publishes — `defaultCardLayout` above is
 * that contract, and this leaves it untouched. This is the designer's own
 * starting canvas and what Reset returns to: "empty when designing" and "what
 * a visitor gets from an account that has never opened the designer" are
 * deliberately different things. See `isSavedCardLayout` for how a caller
 * tells the two situations apart.
 */
export function emptyCardLayout(): CardLayout {
  return {
    ...defaultCardLayout(),
    padding: 0,
    zones: { top: [], middle: [], bottom: [] },
  };
}

/**
 * Whether `stored` is a layout someone actually saved — real zone arrays, not
 * a blob from before the designer existed or one hand-edited into nonsense.
 *
 * The same test `resolveCardLayout` runs internally to decide when to fall
 * back to the populated default. Exposed so a caller can pick a *different*
 * fallback for its own purposes — the designer seeds a never-touched account
 * with `emptyCardLayout()` rather than the classic look a live, unconfigured
 * site still publishes.
 */
export function isSavedCardLayout(stored: unknown): boolean {
  if (!isRecord(stored)) return false;
  const zones = isRecord(stored.zones) ? stored.zones : {};
  return CARD_ZONES.some((zone) => Array.isArray(zones[zone]));
}

/**
 * Anything at all, turned into a layout that can be rendered.
 *
 * **Never throws**, the same contract `mappers.ts` holds its row readers to: a
 * blob written by an older version of the app, hand-edited in the Appwrite
 * console, or shipped inside a snapshot published years ago must degrade to
 * something drawable rather than take a customer's map down.
 *
 * It is also where "no element can be bigger than the card, and nothing
 * overflows" is actually enforced. The designer clamps as you drag because it is
 * pleasant; this clamps because it is the truth — a width of 400% arriving from
 * anywhere is 100% by the time anything draws it.
 */
export function resolveCardLayout(stored: unknown): CardLayout {
  const fallback = defaultCardLayout();
  if (!isRecord(stored)) return fallback;

  const zones: Record<CardZone, CardBlock[]> = { top: [], middle: [], bottom: [] };

  /*
   * Resolved up here rather than in the object below, because `readBlock` needs
   * them: a block's margin is stored only when it differs from the card's own
   * padding, and its leading space is clamped against the card's own height, so
   * knowing which values to drop means knowing those two numbers first.
   */
  const padding = clamp(stored.padding, CARD_LIMITS.padding, fallback.padding);
  const maxHeight = clamp(
    stored.maxHeight,
    CARD_LIMITS.maxHeight,
    fallback.maxHeight,
  );

  /*
   * The difference between "this is not a layout" and "this is an empty card".
   *
   * No readable zones at all — an empty column, a blob from before the designer
   * existed, something hand-edited into nonsense — has only one safe reading, and
   * that is the default. An owner who *cleared* their card is a different thing
   * entirely: they get the empty card they built, because putting the default
   * back would be the designer undoing their work in front of them.
   *
   * An array is what tells the two apart. Three empty arrays is a card someone
   * emptied; a string where an array should be is nobody's card.
   */
  const storedZones = isRecord(stored.zones) ? stored.zones : {};
  if (!CARD_ZONES.some((zone) => Array.isArray(storedZones[zone]))) {
    return fallback;
  }

  /*
   * Uniqueness is enforced across the whole card rather than per zone, and the
   * first one wins. Two names in two zones is the same mistake as two in one.
   */
  const claimed = new Set<CardBlockType>();
  const ids = new Set<string>();

  for (const zone of CARD_ZONES) {
    const list = storedZones[zone];
    if (!Array.isArray(list)) continue;

    for (const raw of list) {
      const block = readBlock(raw, zone, claimed, ids, padding, maxHeight);
      if (block) zones[zone].push(block);
    }
  }

  return {
    v: 1,
    width: clamp(stored.width, CARD_LIMITS.width, fallback.width),
    maxHeight,
    radius: clamp(stored.radius, CARD_LIMITS.radius, fallback.radius),
    padding,
    gap: clamp(stored.gap, CARD_LIMITS.gap, fallback.gap),
    ...(hex(stored.background) ? { background: hex(stored.background) } : {}),
    ...(hex(stored.border) ? { border: hex(stored.border) } : {}),
    borderWidth: clamp(
      stored.borderWidth,
      CARD_LIMITS.borderWidth,
      fallback.borderWidth,
    ),
    shadow: SHADOWS.includes(stored.shadow as CardShadow)
      ? (stored.shadow as CardShadow)
      : fallback.shadow,
    zones,
  };
}

function readBlock(
  raw: unknown,
  zone: CardZone,
  claimed: Set<CardBlockType>,
  ids: Set<string>,
  /** The card's own padding, which is what an unset margin resolves to. */
  cardPadding: number,
  /** The card's own height, which is as much leading space as there can be. */
  cardMaxHeight: number,
): CardBlock | null {
  if (!isRecord(raw)) return null;

  const type = raw.type as CardBlockType;
  const spec = CARD_BLOCKS[type] as CardBlockSpec | undefined;

  // An unknown type is a block from a newer version of the app, and a block in
  // a zone it may not occupy is a rule that changed under a stored layout.
  // Both are dropped rather than guessed at.
  if (!spec || !spec.zones.includes(zone)) return null;
  if (spec.unique && claimed.has(type)) return null;
  if (spec.unique) claimed.add(type);

  const id = typeof raw.id === "string" && raw.id && !ids.has(raw.id)
    ? raw.id
    : `${type}-${String(ids.size)}`;
  ids.add(id);

  const block: CardBlock = { id, type };

  /*
   * The width, and the boolean it replaced.
   *
   * `half: true` meant exactly one thing — half the line — so it reads as
   * `widthPct: 50` with nothing lost, and it wins over any `widthPct` arriving
   * beside it, because a blob claiming both is an older build's `half` plus a
   * stale number the old code would itself have ignored. Layouts saved under the
   * old field, and snapshots published under it and still being fetched by
   * customers' sites, therefore keep drawing what they drew, without a migration
   * touching a single row. Nothing writes `half` any more; `shareOf` is what
   * still reads it, for the renderers that never see a resolved layout at all.
   */
  if (spec.controls.includes("width")) {
    const width =
      raw.half === true
        ? 50
        : clamp(raw.widthPct, [spec.minWidthPct ?? 25, 100], 100);
    // Full width is the *absence* of a width, so there is one way to say it and
    // the renderers do not have to treat 100 and undefined as the same thing.
    if (width < 100) block.widthPct = width;
  }

  /*
   * `newLine` describes a *line*, and it is read for the two kinds of block that
   * can be asked to share one: a narrowed block, and a self-sized mark — which
   * has no width to be read under, but does have a line another block can be
   * pulled onto beside it. Without this a logo could not record that it starts
   * its own line, and `preserveRows` would silently let the block below it slide
   * up next to it after an unrelated edit.
   */
  if (block.widthPct !== undefined || SELF_SIZED.includes(type)) {
    if (raw.newLine === true) block.newLine = true;
  }

  /*
   * The other two are narrowed-only, and are read under the width rather than
   * beside it: a blob claiming `side: "end"` on a description simply does not
   * carry it, and a block whose owner has dragged the width back to full cannot
   * leave a stale line rule behind to surprise whatever narrows it next. A
   * self-sized mark is excluded on its own terms — where it sits across its line
   * is `align`, and it is exactly as tall as itself, so neither of these has
   * anything to move.
   */
  if (block.widthPct !== undefined) {
    // "start" is the absence of a side, for the same reason full width is the
    // absence of a width: one way to say it.
    if (raw.side === "end") block.side = "end";
    // And "start" is the absence of a vertical alignment too — a row stretches
    // its items, which is where an unaligned block has always drawn.
    if (VALIGNS.includes(raw.valign as CardBlockValign)) {
      block.valign = raw.valign as CardBlockValign;
    }
  }

  if (spec.controls.includes("height")) {
    block.heightPct = clamp(
      raw.heightPct,
      [1, spec.maxHeightPct ?? 100],
      spec.defaultHeightPct ?? 0,
    );
  }

  /*
   * The overlap, and the edge it is against.
   *
   * Clamped to the type's own starting value rather than to zero, so a logo
   * whose stored number is unreadable draws the layout a fresh one arrives with
   * instead of silently detaching itself from the photo. Zero is dropped, and
   * the edge is only read when there is an overlap to have one — a direction on
   * a block that overlaps nothing is a field with no pixel behind it.
   */
  if (spec.controls.includes("overlap")) {
    const overlap = clamp(
      raw.overlapPct,
      [0, 100],
      spec.defaultOverlapPct ?? 0,
    );

    if (overlap > 0) {
      block.overlapPct = overlap;
      if (raw.overlapEdge === "below") block.overlapEdge = "below";
    }
  }

  // "cover" is the absence of a fit, so there is one way to say it and neither
  // renderer has to treat the word and the missing field as the same thing.
  if (raw.fit === "contain" && spec.controls.includes("fit")) {
    block.fit = "contain";
  }

  // Read for any block: `padding` and `align` below are additive, so a value
  // stored on a type whose panel does not offer the control still draws
  // something coherent rather than nothing.
  if (isNumber(raw.padding)) {
    const padding = clamp(raw.padding, CARD_LIMITS.blockPadding, 0);
    // Zero is the absence of padding, for the same reason 100 is the absence of
    // a width.
    if (padding > 0) block.padding = padding;
  }

  if (ALIGNS.includes(raw.align as CardBlockAlign)) {
    block.align = raw.align as CardBlockAlign;
  }

  /*
   * The margin, and the boolean it replaced.
   *
   * `bleed: true` meant exactly one thing — reach the card's edges — so it reads
   * as `margin: 0` with nothing lost, and `bleed: false` as the card's own
   * padding. Layouts saved under the old field, and snapshots published under it
   * and still being fetched by customers' sites, therefore keep drawing what
   * they drew, without a migration touching a single row.
   *
   * An explicit value equal to the type's default is dropped, on the same
   * argument full width is the absence of a width: it leaves the card's Padding
   * slider still in charge of a block nobody has singled out.
   */
  if (spec.controls.includes("margin")) {
    const stored = isNumber(raw.margin)
      ? raw.margin
      : typeof raw.bleed === "boolean"
        ? raw.bleed
          ? 0
          : cardPadding
        : undefined;

    if (stored !== undefined) {
      const margin = clamp(stored, CARD_LIMITS.blockMargin, cardPadding);
      if (margin !== defaultMarginOf(type, cardPadding)) block.margin = margin;
    }
  }

  /*
   * Leading space, clamped against this card rather than against a constant.
   *
   * The card is what bounds it — an offset taller than the card is a block
   * pushed out through the bottom of it, which on the top or bottom zone the
   * card would simply clip. Read for every type, like `padding` and `align`,
   * because it is where the block *sits* rather than something the block's own
   * panel offers; it is set by dragging, and every block can be dragged.
   *
   * Zero is the absence of an offset, on the same argument full width is the
   * absence of a width — so a card nobody has moved anything on stores nothing
   * new, and `defaultCardLayout()` stays byte-identical (CLAUDE.md §7).
   */
  if (isNumber(raw.offset)) {
    const offset = clamp(raw.offset, [0, cardMaxHeight], 0);
    if (offset > 0) block.offset = offset;
  }

  /*
   * The type styling, read only where the block declares it.
   *
   * Every one of the four is dropped when it is absent rather than resolved to
   * the block's own default, and that is the whole reason this could be added
   * to a live model: a name nobody has styled stores nothing new, so
   * `defaultCardLayout()` is byte-identical and `isDefaultCardLayout` keeps
   * omitting the layout from a snapshot (CLAUDE.md §7).
   *
   * The font is checked against a closed list rather than a shape, because it
   * is written into a `font-family` on a stranger's page — see
   * packages/shared/card-fonts.ts.
   */
  if (spec.controls.includes("text")) {
    if (isCardFont(raw.font)) block.font = raw.font;

    if (isNumber(raw.fontSize)) {
      block.fontSize = clamp(
        raw.fontSize,
        CARD_LIMITS.fontSize,
        CARD_LIMITS.fontSize[0],
      );
    }

    const color = hex(raw.color);
    if (color) block.color = color;

    // Bold is the presence of the field, so there is one way to say it and
    // neither renderer has to treat `false` and missing as the same thing.
    if (raw.bold === true) block.bold = true;
  }

  /*
   * The chips' own two, on exactly the terms above: absent stays absent, and
   * zero padding is the absence of padding rather than a stored nought — so a
   * card whose owner has never opened the Chips group stores nothing new and
   * `defaultCardLayout()` stays byte-identical.
   */
  if (spec.controls.includes("chips")) {
    const chipBackground = hex(raw.chipBackground);
    if (chipBackground) block.chipBackground = chipBackground;

    if (isNumber(raw.chipPadding)) {
      const padding = clamp(raw.chipPadding, CARD_LIMITS.chipPadding, 0);
      if (padding > 0) block.chipPadding = padding;
    }

    /*
     * The outline is a pair, and the pair is read as a pair: a width with no
     * colour draws nothing in either renderer, so storing one is storing a fact
     * about a chip that is not true. A colour with no width takes the default
     * hairline instead of being dropped — that is the shape the control writes
     * them in, and a stored row that lost its width should still draw the
     * outline its owner asked for.
     */
    const chipBorder = hex(raw.chipBorder);
    if (chipBorder) {
      block.chipBorder = chipBorder;

      const width = isNumber(raw.chipBorderWidth)
        ? clamp(raw.chipBorderWidth, CARD_LIMITS.chipBorderWidth, 0)
        : DEFAULT_CHIP_BORDER_WIDTH;

      if (width > 0) block.chipBorderWidth = width;
      else delete block.chipBorder;
    }
  }

  /*
   * The mark's one non-measurement. `"image"` is the only value there is, so
   * anything else — including the word "pin" somebody might reasonably write —
   * leaves the field absent, which is the pin.
   */
  if (spec.controls.includes("logo") && raw.logoMode === "image") {
    block.logoMode = "image";
  }

  /*
   * The week's own three, on the same terms. `hoursOpen` absent is collapsed,
   * which is what the embed has always drawn — see the field's own note.
   */
  if (spec.controls.includes("hours")) {
    if (raw.hoursOpen === true) block.hoursOpen = true;
    if (raw.hoursLongDays === true) block.hoursLongDays = true;

    if (isNumber(raw.hoursRowGap)) {
      const gap = clamp(
        raw.hoursRowGap,
        CARD_LIMITS.hoursRowGap,
        DEFAULT_HOURS_ROW_GAP,
      );
      // The default is the absence, for the same reason full width is.
      if (gap !== DEFAULT_HOURS_ROW_GAP) block.hoursRowGap = gap;
    }
  }

  // Absent is the whole paragraph, so a card nobody has clipped keeps drawing
  // all of it — which is what both renderers did before this field existed.
  if (spec.controls.includes("clamp") && isNumber(raw.clampLines)) {
    block.clampLines = clamp(
      raw.clampLines,
      CARD_LIMITS.clampLines,
      DEFAULT_CLAMP_LINES,
    );
  }

  /*
   * What a button does, and what it says it with.
   *
   * `"link"` is the only value there is — anything else, including the word
   * "directions" somebody might reasonably write, leaves the field absent,
   * which *is* directions. Same shape as `logoMode` above.
   *
   * The source and the label are only read in link mode and only as far as they
   * mean anything: a `buttonSource` on a directions button names a field the
   * button will never read, and carrying it would leave a stale answer waiting
   * to surprise whoever switches the action back months later.
   */
  if (spec.controls.includes("button")) {
    if (raw.buttonAction === "link") {
      block.buttonAction = "link";

      const source = text(raw.buttonSource, MAX_BUTTON_SOURCE);
      if (source) block.buttonSource = source;
    }

    const label = text(raw.buttonLabel, MAX_BUTTON_LABEL);
    if (label) block.buttonLabel = label;
  }

  if (spec.controls.includes("buttonStyle")) {
    const buttonBackground = hex(raw.buttonBackground);
    if (buttonBackground) block.buttonBackground = buttonBackground;

    if (isNumber(raw.buttonPadding)) {
      const padding = clamp(raw.buttonPadding, CARD_LIMITS.buttonPadding, 0);
      if (padding > 0) block.buttonPadding = padding;
    }

    /*
     * **Zero is a value here, not an absence**, and it is the one field on this
     * block where that is true.
     *
     * Every other number is dropped at zero because zero is what the stylesheet
     * already draws. A radius of zero is not: absent draws the stylesheet's own
     * `0.5rem`, so a square button is a real choice that has nowhere else to be
     * written down. Dropping it made the Corners control unable to say the one
     * thing a corner control exists to say.
     *
     * A card published before this parse still carries no radius and still
     * draws that same `0.5rem`, so nothing live moves — see `buttonStyleOf`,
     * which asks the same question the same way.
     */
    if (isNumber(raw.buttonRadius)) {
      block.buttonRadius = clamp(raw.buttonRadius, CARD_LIMITS.buttonRadius, 0);
    }

    /*
     * The outline, whose two halves are read **separately** — and that is the
     * one place this deliberately parts company with `chipBorder` above.
     *
     * A width with no colour is a complete answer here, because the stylesheets
     * fall back to the button's own label colour rather than to nothing (see
     * `CardBlock.buttonBorder`). So a width stands on its own; a colour with no
     * width still takes the default hairline, because a colour alone genuinely
     * does draw nothing.
     *
     * A card published before this parse carries both halves or neither, so
     * nothing live moves — the only new shape is one this parse can now keep.
     */
    const buttonBorder = hex(raw.buttonBorder);
    const storedWidth = isNumber(raw.buttonBorderWidth)
      ? clamp(raw.buttonBorderWidth, CARD_LIMITS.buttonBorderWidth, 0)
      : undefined;
    const buttonBorderWidth =
      storedWidth ?? (buttonBorder ? DEFAULT_BUTTON_BORDER_WIDTH : 0);

    if (buttonBorderWidth > 0) {
      block.buttonBorderWidth = buttonBorderWidth;
      if (buttonBorder) block.buttonBorder = buttonBorder;
    }

    if (raw.buttonFull === true) block.buttonFull = true;

    /*
     * The treatment and the hover, each read only as one of its own words.
     *
     * `includes` on a frozen list rather than a cast: both reach a renderer as
     * a **class name**, and the embed draws a published snapshot without ever
     * running this parse (embed/src/map.ts). A string that survived to there
     * unchecked would be a class name chosen by whatever wrote the file, so the
     * narrowing has to happen against a list both sides can see rather than
     * against the type alone, which is gone by runtime.
     */
    if (isButtonVariant(raw.buttonVariant)) {
      block.buttonVariant = raw.buttonVariant;
    }

    if (isButtonHover(raw.buttonHover)) block.buttonHover = raw.buttonHover;
  }

  /*
   * Which ways to reach a place this row leaves out.
   *
   * `true` or absent, never `false`, for the reason the field itself gives: the
   * absence is the row every published card already draws, so a stored `false`
   * is a longer way of saying nothing and is not kept.
   */
  if (spec.controls.includes("links")) {
    if (raw.hidePhone === true) block.hidePhone = true;
    if (raw.hideEmail === true) block.hideEmail = true;
    if (raw.hideWebsite === true) block.hideWebsite = true;
    if (raw.hideDirections === true) block.hideDirections = true;
  }

  return block;
}

/**
 * The blocks whose margin starts at zero, so they reach the card's edges.
 *
 * A picture inset by the card's padding reads as an illustration in a document;
 * one that touches the edges reads as the card being *of* that place. Narrow it
 * and it stops reaching them, because a photo hanging over one edge is not a
 * design anyone asked for. Text starts inset, for the opposite reason — and now
 * only *starts* there, since every block carries a margin it can be moved with.
 */
const BLEEDS: readonly CardBlockType[] = ["gallery"];

/**
 * Where a block's edges sit when its owner has never said — the card's own
 * padding, or zero for the blocks in `BLEEDS`.
 *
 * Taking the padding as a number rather than a whole layout because
 * `resolveCardLayout` asks before it has built one.
 */
export function defaultMarginOf(
  type: CardBlockType,
  cardPadding: number,
): number {
  return BLEEDS.includes(type) ? 0 : cardPadding;
}

/** Whether this block type starts flush to the card's edges — see `BLEEDS`. */
export function bleedsByDefault(type: CardBlockType): boolean {
  return BLEEDS.includes(type);
}

/**
 * `align`'s three words as `align-self`'s three, for a self-sized block.
 *
 * `flex-start`/`flex-end` rather than `start`/`end`: the logical values are the
 * newer spelling and are still not what every browser a visitor's site is opened
 * in accepts on this property, and a card on a stranger's website is not a place
 * to find that out.
 */
const FLEX_ALIGN: Record<CardBlockAlign, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
};

/**
 * A block's alignment as a `justify-content`, for the blocks that are a flex
 * row and so cannot be moved by `text-align`.
 *
 * `chipStyleOf` already needed this and kept it to itself, because chips were
 * the only such row. The Links row is the second — `Actions` in
 * components/card/card-block.tsx and `buildActions` in embed/src/popup.ts are
 * both a wrapping flex list — so the mapping is exported rather than copied,
 * and a third one gets it for free.
 *
 * `undefined` for a block with no alignment of its own, so a renderer writes
 * nothing at all and the row sits where every published card has always drawn
 * it (CLAUDE.md §7).
 */
export function justifyOf(align: CardBlockAlign | undefined): string | undefined {
  return align ? FLEX_ALIGN[align] : undefined;
}

/** A block's box, in CSS values. */
export type CardBlockBox = {
  /**
   * Absent means the full width of the card — **or** that this block is a half
   * and its width is its row's to decide. See `half` below.
   */
  width?: string;
  /**
   * Where the block sits on its parent's cross axis. Absent stretches.
   *
   * One property, two meanings, decided by which parent this block has. Inside a
   * zone — a flex **column** — the cross axis is horizontal, so this is where a
   * self-sized block like the logo sits left to right. Inside a row — a flex
   * **row** — it is vertical, so this is `valign`. Nothing can carry both,
   * because a self-sized block has no share and therefore never gets a row.
   */
  alignSelf?: string;
  /**
   * This block paints over its neighbours rather than beside them. Absent is the
   * ordinary flow.
   *
   * A flag rather than a z-index, because the number is not this file's to pick:
   * each renderer has its own stacking context around the card, and both only
   * ever need "above the block it is sitting on".
   */
  raised?: true;
  /**
   * How far to pull this block over its neighbour, as a length. Absent means it
   * follows the neighbour rather than straddling it.
   *
   * Handed back raw, and **not** folded into `marginTop`, because whether it
   * applies at all depends on something this function cannot see: an overlap is
   * against a sibling *in the same zone*, and a block at the end of its zone has
   * none. Only the renderer walking the zone knows. See `blockEdges` in
   * components/card/card-frame.tsx, which is where the two are composed — along
   * with the bleed cancel, which lands on the same property.
   */
  overlap?: string;
  /** Which side `overlap` is pulled towards. Absent is upwards. */
  overlapEdge?: "below";
  /**
   * The `flex` shorthand this block needs. Absent means whatever its parent
   * gives it.
   *
   * Here rather than in each renderer because two rules want the same property
   * and one has to win. A block with a height has always needed `flex: none`, or
   * the zone's flex column shrinks it back to its content — and a block sharing
   * its line needs a basis of half the row instead, or it takes the whole of it.
   * A half gallery wants a height *and* a basis, so the two cannot both be
   * written blind; deciding it once here is what stops a half photo rendering
   * full width because `flex: none` happened to be assigned second.
   *
   * The basis is `calc(50% - ${gap / 2}px)` with the number written out, not a
   * CSS variable: the card's gap is `--card-gap` in the dashboard and
   * `--lm-card-gap` in the embed, and one string that mentions neither is one
   * fewer pair of names to keep in step.
   */
  flex?: string;
  /**
   * How much to shrink the block's own content, as a `zoom` factor. Absent means
   * not at all, which is every block that is not a half.
   *
   * It belongs on the *content* rather than on the block's own box: zooming the
   * flex item would resolve its basis inside a scaled coordinate space, and the
   * basis is the one thing about a half that has to be exact.
   */
  contentZoom?: number;
  /**
   * Absent means the card's own wrapping.
   *
   * This, not the zoom, is what actually stops a half overflowing: every block
   * made of words already wraps, so the only thing that can poke out of a
   * 140px column is a single unbroken token — a URL in an extra field, a street
   * name with no hyphen in it.
   */
  overflowWrap?: string;
  /** Absent means whatever the card inherits — the reading direction's start. */
  textAlign?: string;
  /**
   * What a picture inside this block does with the room it has. Absent is
   * `cover`, which is what the gallery has always drawn.
   *
   * Handed back as a value rather than applied, because the element it belongs
   * on is the `img` and this function is nowhere near it. Both renderers pass it
   * down as a custom property the image's own rule falls back through — see
   * `blockStyle` in components/card/card-frame.tsx and `.lm-popup__photo` in
   * embed/src/styles.css.
   */
  objectFit?: string;
  height?: string;
  /** Absent means none. */
  padding?: string;
  /**
   * How far to pull the block out of — or push it further into — the card's
   * padding, which the zone applies to every block alike. Absent means the
   * block sits exactly where that padding puts it.
   */
  marginInline?: string;
  /**
   * Whether this block reaches the card's edges, which is a margin of zero.
   *
   * Kept as its own flag rather than left for a caller to derive, because it is
   * what decides the *vertical* half of the same idea: only a block flush to
   * the card's edge at the very top or very bottom cancels the padding there
   * too. See `blockEdges` in components/card/card-frame.tsx.
   */
  bleed: boolean;
  /**
   * The block's own type styling, as CSS values. Absent for a block nobody has
   * styled, which is every block on every card published so far.
   *
   * Each renderer writes these as **custom properties** on the block's box —
   * `--card-*` in the dashboard, `--lm-card-*` in the embed — and every leaf
   * element names its own current value as the fallback. Two reasons, and both
   * are load-bearing. The fallback is what keeps an unstyled block drawing
   * exactly the pixels it drew before this field existed. And on the dashboard
   * side an inherited `font-size` could not work at all: the leaves size their
   * type with Tailwind's `rem` utilities, which an inherited value does not
   * move — the same trap `NARROW_CONTENT_SCALE` documents for `zoom`.
   */
  text?: CardBlockText;
  /**
   * How many lines of a paragraph to keep before clipping it, as a string.
   * Absent shows the whole thing.
   *
   * A count rather than a height, because the point is *lines* and a card's
   * type size is now its owner's to change — a height in pixels would mean a
   * different number of lines at every size they picked.
   */
  lines?: string;
  /**
   * How far apart the rows of a week sit, as a length. Absent is the default
   * every card has drawn.
   */
  rowGap?: string;
};

/** The four things that can be said about a block's words. All optional. */
export type CardBlockText = {
  /** A `font-family` value — the whole stack. See card-fonts.ts. */
  font?: string;
  /** A `font-size` length. */
  size?: string;
  /** A `color`. */
  color?: string;
  /** A `font-weight`. */
  weight?: string;
};

/**
 * How big a block actually is, in pixels and percentages.
 *
 * Here rather than in either renderer because there are three of them — the
 * embed's popup, the editor's card, and the designer canvas that is a preview of
 * both — and "70% of the card" has to mean the same thing in all three or the
 * studio is lying about what it is building.
 *
 * Heights resolve against the card's own `maxHeight` rather than against the
 * zone they sit in, and that is not a shortcut: a percentage of an auto-height
 * parent computes to `auto`, so the number has to be worked out where the card's
 * box is known.
 *
 * `align` moves the **words** — except on a self-sized block, where there are no
 * words to move and it moves the box instead (see `SELF_SIZED`). It used to move
 * every block,
 * through an `align-self` on a narrowed one — which centred it, and therefore
 * split the space left over into two useless strips either side. Now the room a
 * narrowed block leaves is a place another block can go, so it has to be in one
 * piece: the block sits at the start of its line, or at the end with `side`, and
 * `cardRowBox` is what says which. A narrowed block also never carries an
 * `align-self` for a second reason — its parent is a flex *row*, where that
 * property is the cross axis, so "align right" would silently become "align
 * bottom".
 *
 * `margin` is the same idea one level out: one stored number that resolves to a
 * negative or positive `margin-inline` against the padding the zone already
 * pays, plus the `bleed` flag the vertical edge cancel keys off.
 *
 * `offset` is the vertical counterpart and is handed back raw, not folded into a
 * margin, because the one place it lands is already spoken for by that edge
 * cancel. See `marginTop` on `CardBlockBox`.
 */
export function blockBox(
  block: CardBlock,
  layout: CardLayout,
  /**
   * Whether this block is a flex item of a **row** rather than of the zone's own
   * column — that is, `row.shared` for the line it was found on.
   *
   * It exists for one block, and for one property. A self-sized mark alone on
   * its line sits in the zone's flex *column*, where `align-self` is horizontal
   * and is therefore what `align` means. Give it a neighbour and its parent is a
   * flex *row*, where the same property is vertical — so `align` would silently
   * become "align bottom", and where the mark sits across the line is decided by
   * which side of it the neighbour is on instead.
   *
   * Defaulted, so every existing caller keeps the answer it was getting, and so
   * a card with no line-sharing mark on it is byte-identical to what it drew
   * before any of this existed.
   */
  onRow = false,
): CardBlockBox {
  const pxOf = (pct: number) => Math.round((layout.maxHeight * pct) / 100);
  const px = (pct: number) => `${String(pxOf(pct))}px`;
  const share = shareOf(block);
  const narrow = share < 100;
  /*
   * A block with a width of its own rather than a share of the line — the logo,
   * and nothing else. It is square, so its height is also its width, and its
   * `align` positions that box within the zone's column.
   */
  const selfSized = SELF_SIZED.includes(block.type);

  /*
   * How far it is pulled over its neighbour, in pixels — `overlapOf` rather
   * than the arithmetic inline, because the drop geometry has to draw its mark
   * at exactly this number. See `liftOf` in lib/card/drop-slots.ts.
   */
  const overlap = overlapOf(block, layout);

  /*
   * The zone pays the card's padding for every block, so a margin is expressed
   * as the difference from it: zero pulls the block out to the card's edges,
   * more than the padding pushes it further in, and exactly the padding is the
   * block staying where the zone put it and emitting no style at all.
   *
   * Narrow wins, as it always has, and now for two reasons at once. A block
   * under full width has already opted out of reaching the edges, and a negative
   * margin under a percentage width is a block hanging over one edge — which is
   * not a design anyone asked for.
   *
   * **And it would otherwise break the card.** A bleeding block carries a
   * negative inline margin of the card's padding, and two of them side by side
   * make their row `2 × padding` wider than the card it sits in. The embed's own
   * `.lm-popup__block--bleed` rule would do the same thing from the stylesheet.
   * So a block that can share its line sits exactly where the zone puts it,
   * which is also what keeps `bleed` false for it and the top and bottom edge
   * cancels in `blockEdges` dead.
   */
  const margin = narrow
    ? layout.padding
    : (block.margin ?? defaultMarginOf(block.type, layout.padding));
  const offset = margin - layout.padding;

  /** The block's own type styling, or nothing at all. See `textOf`. */
  const text = textOf(block);

  return {
    // Absent, not "start": an unset alignment has to inherit, or every card
    // drawn before this field existed would have its text re-anchored.
    ...(block.align && !selfSized ? { textAlign: block.align } : {}),
    /*
     * The same field as the line above, on the one kind of block where it means
     * the box rather than the words — and the vertical alignment of a block
     * sharing a line, which is the same CSS property with the other meaning
     * (see `alignSelf` on `CardBlockBox`). They cannot both be emitted: a
     * self-sized block has no share, so it never gets a row to be vertical in.
     */
    ...(selfSized && block.align && !onRow
      ? { alignSelf: FLEX_ALIGN[block.align] }
      : narrow && block.valign
        ? { alignSelf: block.valign === "center" ? "center" : "flex-end" }
        : {}),
    ...(block.fit ? { objectFit: block.fit } : {}),
    ...(block.heightPct ? { height: px(block.heightPct) } : {}),
    // Square, and drawn from the one number, so a logo cannot be told to be an
    // oval by a layout that set only one of two dimensions.
    ...(selfSized && block.heightPct ? { width: px(block.heightPct) } : {}),
    ...(overlap > 0
      ? {
          overlap: `${String(overlap)}px`,
          ...(block.overlapEdge ? { overlapEdge: block.overlapEdge } : {}),
          // A block pulled over its neighbour has to be drawn over it too. Later
          // in the flow is not enough on its own once either one is positioned.
          raised: true as const,
        }
      : {}),
    /*
     * The basis first, and a `width` never.
     *
     * A narrowed block is always a flex item of its own row (`cardRows` gives it
     * one even when nothing has joined it), so its share is a basis: two shares
     * summing to 100, plus the one `column-gap` between them, is exactly the
     * row. `calc(share% - gap/2)` is what makes that arithmetic come out — each
     * block gives up half the gap it pays for.
     *
     * It has to beat `flex: none`, which every full-width block takes: `none` is
     * `0 0 auto`, which throws the basis away and puts a narrowed photo back
     * across the whole card. So the two are decided here rather than written
     * blind by each renderer.
     *
     * **`none` for a block with no height of its own too, and that is a fix.**
     * A zone is a flex column with a bounded height, and a flex item's default
     * `flex-shrink: 1` lets it be compressed below its own content — which for a
     * block with `overflow: hidden` means the text is *cut off*, silently and
     * mid-word, rather than the zone scrolling. A card with a paragraph in it
     * and a week of opening hours under that lost the end of both: the middle
     * zone's `scrollHeight` matched its `clientHeight`, so it did not even think
     * it had anything to scroll. `0 0 auto` makes every block keep its content
     * height, the zone overflow, and the scroller do its job.
     */
    ...(narrow
      ? {
          flex: `0 0 calc(${String(share)}% - ${String(layout.gap / 2)}px)`,
          ...(UNZOOMED.includes(block.type)
            ? {}
            : { contentZoom: NARROW_CONTENT_SCALE }),
          overflowWrap: "anywhere",
        }
      : { flex: "none" }),
    ...(block.padding ? { padding: `${String(block.padding)}px` } : {}),
    ...(offset === 0 ? {} : { marginInline: `${String(offset)}px` }),
    /*
     * No leading space here at all, for any block. It is one number per *line*
     * — `rowOffsetHolder` says which member holds it — and every renderer draws
     * it as a box of its own above the line rather than as a margin on a block
     * inside it. See `leadBox`.
     */
    bleed: margin === 0,
    /*
     * The type styling, and the whole group is dropped when none of it is set —
     * so a renderer writes four custom properties for a block somebody styled
     * and nothing at all for the other eleven. `700` rather than `bold`, which
     * is the same weight said in a word a `font-weight` custom property cannot
     * be arithmetic on.
     */
    ...(text ? { text } : {}),
    ...(block.clampLines ? { lines: String(block.clampLines) } : {}),
    ...(block.hoursRowGap === undefined
      ? {}
      : { rowGap: `${String(block.hoursRowGap)}px` }),
  };
}

/**
 * A block's four type styles, or nothing at all.
 *
 * Its own function rather than four spreads inline, because "has this block
 * been styled" is one question three places ask — `blockBox` above, and each
 * renderer deciding whether to write anything.
 */
function textOf(block: CardBlock): CardBlockText | undefined {
  const text: CardBlockText = {
    ...(block.font ? { font: block.font } : {}),
    ...(block.fontSize ? { size: `${String(block.fontSize)}px` } : {}),
    ...(block.color ? { color: block.color } : {}),
    ...(block.bold ? { weight: "700" } : {}),
  };

  return Object.keys(text).length > 0 ? text : undefined;
}

/** What a block's chips look like. All optional, all absent by default. */
export type CardChipStyle = {
  /** A `background-color` for each chip. */
  background?: string;
  /** Extra `padding` on each chip, as a length. */
  padding?: string;
  /** A `justify-content` for the row they wrap in. */
  justify?: string;
  /** A `border-color` for each chip. Never set without `borderWidth`. */
  border?: string;
  /** That border's width, as a length. Never set without `border`. */
  borderWidth?: string;
};

/**
 * How a block draws its chips, or nothing at all.
 *
 * `textOf`'s sibling, and here for its reason: the studio, the editor's own
 * popup and the embed all draw these pills, and three copies of "what does a
 * chip look like" is how the preview panel ends up showing two different chips
 * beside each other on one screen.
 *
 * **`justify` is the fix for an alignment that silently did nothing.** `align`
 * reaches a block as `textAlign` (see `blockBox`), which is right for everything
 * made of words and is powerless over a row of chips — `text-align` does not
 * move flex items, so the three Alignment buttons on the Tags block moved
 * nothing at all. Its `flex-start`/`flex-end` spelling is `FLEX_ALIGN`'s, for
 * `FLEX_ALIGN`'s reason: a card is opened on a stranger's site, which is not the
 * place to find out which browsers take the logical values on this property.
 *
 * Padding is a **length to add**, not a box: it lands beside the chip's own
 * padding in each renderer rather than replacing it, so zero is the pill every
 * card already draws.
 */
export function chipStyleOf(block: CardBlock): CardChipStyle | undefined {
  const chip: CardChipStyle = {
    ...(block.chipBackground ? { background: block.chipBackground } : {}),
    ...(block.chipPadding
      ? { padding: `${String(block.chipPadding)}px` }
      : {}),
    ...(block.align ? { justify: FLEX_ALIGN[block.align] } : {}),
    /*
     * Both or neither. A colour with no width draws nothing and a width with no
     * colour draws a black line nobody picked, so the two travel together and
     * `readBlock` refuses to store either half on its own.
     */
    ...(block.chipBorder && block.chipBorderWidth
      ? {
          border: block.chipBorder,
          borderWidth: `${String(block.chipBorderWidth)}px`,
        }
      : {}),
  };

  return Object.keys(chip).length > 0 ? chip : undefined;
}

export type CardButtonStyle = {
  /** A `background-color` for the button. */
  background?: string;
  /** Extra `padding` on the button, as a length. */
  padding?: string;
  /** A `border-radius`, as a length. */
  radius?: string;
  /**
   * A `border-color`. Never set without `borderWidth`, and optional on it — a
   * width alone draws in the button's own label colour, which is what the
   * stylesheets fall back to. Unlike a chip's, where the pair is indivisible.
   */
  border?: string;
  /** That border's width, as a length. Carries the outline on its own. */
  borderWidth?: string;
  /** The button fills its block rather than hugging its label. */
  full?: true;
};

/**
 * How a block draws its button, or nothing at all.
 *
 * `chipStyleOf`'s twin, here for its reason: the studio, the editor's own popup
 * and the embed all draw this box, and three copies of "what does a button look
 * like" is how the preview panel ends up showing two different buttons side by
 * side on one screen.
 *
 * **No `justify`**, where `chipStyleOf` needs one. A row of chips is a flex row
 * and `text-align` cannot move a flex item; a button is one `inline-flex`
 * element sitting in the block's normal flow, which `text-align` moves like any
 * other inline-level box. That is a reason to keep it inline-level rather than
 * an accident — make it a flex child later and this function owes a `justify`.
 *
 * Padding is a **length to add**, as a chip's is, so zero is the button the
 * stylesheet already draws and a block nobody has styled writes nothing at all.
 */
export function buttonStyleOf(block: CardBlock): CardButtonStyle | undefined {
  const style: CardButtonStyle = {
    ...(block.buttonBackground ? { background: block.buttonBackground } : {}),
    ...(block.buttonPadding
      ? { padding: `${String(block.buttonPadding)}px` }
      : {}),
    /*
     * `!== undefined`, not truthiness: zero is a square button and absent is
     * the stylesheet's own corner, and those are two different cards. Every
     * other number here is still dropped at zero, because for every other one
     * zero *is* what the stylesheet draws. See the same test in `readBlock`.
     */
    ...(block.buttonRadius !== undefined
      ? { radius: `${String(block.buttonRadius)}px` }
      : {}),
    ...(block.buttonFull ? { full: true as const } : {}),
    /*
     * The width carries the outline and the colour is optional on it, which is
     * where this parts company with a chip's pair (`chipStyleOf` above). A
     * colour with no width still draws nothing, so it is dropped; a width with
     * no colour draws in the button's own label colour, which is the
     * stylesheets' own fallback and stays right in either theme.
     */
    ...(block.buttonBorderWidth
      ? { borderWidth: `${String(block.buttonBorderWidth)}px` }
      : {}),
    ...(block.buttonBorderWidth && block.buttonBorder
      ? { border: block.buttonBorder }
      : {}),
  };

  return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * What a Logo block actually draws: an uploaded image, or nothing — meaning the
 * pin.
 *
 * `chipStyleOf`'s sibling, and here for its reason: the studio, the editor's own
 * popup and the embed all draw this block, and three copies of "is this a logo
 * or a pin" is how the preview panel ends up showing a pin beside a logo on one
 * screen.
 *
 * **The fallback is the whole function.** A location whose pin carries a glyph
 * rather than an uploaded image has no logo to draw, and a Logo block that went
 * blank for it would be a design that works on the location it was made against
 * and silently empties on the other four hundred. So asking for the image is
 * asking for it *if there is one*, and the pin is what a card gets otherwise —
 * which is also what every card drew before this field existed (CLAUDE.md §7).
 *
 * Takes the already-resolved image string rather than the pin, so this file
 * stays free of a `pin-icons` import: the two renderers have both resolved the
 * pin by the time they ask.
 */
export function logoImageOf(
  block: CardBlock,
  /** `ResolvedPin.image` — a `data:` URI, or "" for a pin drawn from paths. */
  image: string,
): string | null {
  return block.logoMode === "image" && image ? image : null;
}

/**
 * One line of a card: a single block, or two narrowed ones sharing it.
 *
 * `index` and `end` are positions in **the list this row was built from**, which
 * is not always the zone's own array — `CardView` pairs what is left after it
 * has dropped the blocks this location has nothing to show for, and its indices
 * are into that. The drop geometry, which needs indices into the real array,
 * pairs the real array.
 */
export type CardRow = {
  /** The blocks on this line: one, or two that fit side by side. */
  blocks: readonly CardBlock[];
  /** Where `blocks[0]` sits — the insertion index immediately before this row. */
  index: number;
  /** One past the last: the insertion index immediately after this row. */
  end: number;
  /**
   * Whether this line is a flex row rather than a bare block.
   *
   * True for **any** line holding a narrowed block, including one that is alone
   * on it — that lone case is the whole reserved-space feature, and the row is
   * what makes the empty part of the line a real, measurable box.
   */
  shared: boolean;
};

/**
 * A zone's blocks, grouped into the lines they actually draw as.
 *
 * Greedy and by adjacency: a narrowed block takes the block after it if that one
 * is narrowed too, is not marked as starting its own line, *and their two shares
 * fit on one line together*. Everything else is a line of its own. Three blocks
 * at 40% are a pair and then a single, not a row of three — the row's width is
 * the card's, and 120% of it is not a line.
 *
 * **The width is what decides the line**, which is the point of the whole model:
 * narrowing a block to 40% is how you ask for 60% of somewhere to put something
 * else, and there is no second flag saying whether you meant it.
 *
 * `newLine` is the one thing adjacency cannot express, and it is an opt-*out*
 * precisely so that its absence keeps meaning what it has always meant. Without
 * it, "a narrowed block alone on its line with a pair under it" is unsayable —
 * three consecutive halves can only ever be `[1,2] [3]`, never `[1] [2,3]` —
 * which is what made dragging one out of a pair to join the line below look like
 * two blocks swapping places. See `preserveRows` in lib/card/card-edits.ts, the
 * only thing that writes it.
 *
 * **Pairing is not stored anywhere**, and that is the point. A partner id would
 * be a second way to describe the same card and therefore a way to describe an
 * impossible one: a reference to a deleted block, two blocks each claiming the
 * same partner, a pair whose members are no longer next to each other. Adjacency
 * cannot say any of those things, and reordering stays reordering.
 *
 * **A lone narrowed block still gets a row.** Not a special case to tidy away
 * later: left bare in the zone's flex *column*, its `flex-basis` would apply to
 * its height rather than to its width. The row is what makes a share mean width.
 *
 * **A lone self-sized mark does not**, and that asymmetry is the whole reason it
 * can be added without touching a card anybody has already published. A logo on
 * its own still comes out `shared: false` — a direct child of the zone's column,
 * with the `align-self` it has always had — so the DOM, the CSS and the bytes
 * are what they were. It joins a row only when something is actually beside it.
 *
 * **A mark does not count against the two-column cap.** Two shares plus a mark
 * is one line, which is what makes `[name] [logo] [address]` sayable: a logo
 * reserves pixels rather than a share of the design, so a card with a mark
 * between two columns is still two columns of content. Three columns of *text*
 * in a 320px card is not, and is still refused — the cap counts share-bearing
 * blocks, and one line may hold at most one mark.
 */
export function cardRows(
  blocks: readonly CardBlock[],
  layout: CardLayout,
): CardRow[] {
  const rows: CardRow[] = [];

  for (let i = 0; i < blocks.length; ) {
    const block = blocks[i];
    const mark = isSelfSized(block.type);
    const share = shareOfAny(block, layout);

    if (share >= 100) {
      rows.push({ blocks: [block], index: i, end: i + 1, shared: false });
      i += 1;
      continue;
    }

    const group: CardBlock[] = [block];

    for (;;) {
      const next = blocks[i + group.length] as CardBlock | undefined;
      if (!next || next.newLine || !lineTakes(group, next, layout)) break;

      group.push(next);
    }

    rows.push({
      blocks: group,
      index: i,
      end: i + group.length,
      // A row is a flex row for everything except a mark standing alone — see
      // the note above.
      shared: group.length > 1 || !mark,
    });
    i += group.length;
  }

  return rows;
}

/**
 * How many **share-bearing** blocks one line may hold.
 *
 * Two, which is what a card this width can carry and read: a 320px card less
 * its padding is 296px, and three columns of text in that is three ellipses.
 * A self-sized mark is not counted — see `cardRows`.
 */
const MAX_COLUMNS = 2;

/**
 * Whether a line already holding `held` has room for `next` as well.
 *
 * The whole capacity rule, in one place, because **two things ask it and they
 * must never disagree**: `cardRows`, which decides what a line is, and
 * `preserveRows` in lib/card/card-edits.ts, which writes the `newLine` flags
 * that make `cardRows` say what an edit intended. When those two drifted, an
 * edit wrote a flag for a line the renderer would not have drawn, and a block
 * silently changed rows for a reason nothing on screen could explain.
 *
 * Capacity only. `newLine` is deliberately not consulted, because it is the
 * *answer* for one of the two callers and merely an input for the other.
 */
export function lineTakes(
  held: readonly CardBlock[],
  next: CardBlock,
  layout: CardLayout,
): boolean {
  if (held.length === 0) return false;

  let total = 0;
  let marks = 0;
  let columns = 0;

  for (const block of held) {
    total += shareOfAny(block, layout);
    if (isSelfSized(block.type)) marks += 1;
    else columns += 1;
  }

  // A full-width block *is* its line, so there is nothing open to join.
  if (total >= 100) return false;

  // One mark to a line; two shares to a line. A mark reserves pixels rather
  // than a share of the design, so it does not spend a column — see `cardRows`.
  if (isSelfSized(next.type) ? marks >= 1 : columns >= MAX_COLUMNS) return false;

  const share = shareOfAny(next, layout);

  return share < 100 && total + share <= 100;
}

/** A row's own box, in CSS values. The twin of `blockBox`, one level out. */
export type CardRowBox = {
  /** Between the two blocks. The card's own gap, as a length. */
  columnGap: string;
  /**
   * Which end of its line the row's blocks sit at — and therefore which end the
   * room left over is on. Absent is the start, which is where a line's contents
   * have always sat.
   *
   * Two things ask for it, and both are the same leftover share. A **lone**
   * narrowed block moved to the end of its line, and a **mark leading a line it
   * shares**, which has to keep the room that was on its far side. See
   * `cardRowBox`.
   */
  justifyContent?: string;
};

/**
 * The member of a line whose `offset` the line actually uses — the greatest of
 * them, first winning a tie.
 *
 * A line's leading space is one number taken from several blocks (`cardRowBox`
 * below), so "the block that carries it" is a real question with one answer, and
 * **every writer has to ask it the same way**. Two of them did not: the edit that
 * charges a departure looked for the greatest offset, while the edit that charges
 * an arrival wrote to the next block *by index* — the same block only on a line
 * of one. On a shared line they wrote to two different members, both writes
 * survived, the `Math.max` below kept the larger, and a card grew a hole above
 * that line which no later move could close. See `settle` and `vacate` in
 * lib/card/card-edits.ts, and `vacatedSpace` in lib/card/drop-slots.ts.
 *
 * `undefined` only for a line with no blocks on it, which `cardRows` does not
 * build.
 */
export function rowOffsetHolder(
  blocks: readonly CardBlock[],
): CardBlock | undefined {
  let holder: CardBlock | undefined;

  for (const block of blocks) {
    if (!holder || (block.offset ?? 0) > (holder.offset ?? 0)) holder = block;
  }

  return holder;
}

/**
 * How a row of halves is laid out.
 *
 * The row's leading space is not here — it is a box of its own above the line
 * (`leadBox`), taken from `rowOffsetHolder`, which is what makes a pair move
 * together rather than one member sliding down inside the row.
 *
 * `justify-content` is the other half of `side`, and it is emitted for a row of
 * **one** only. A pair is two shares summing to the row plus its gap, so there it
 * has nothing to move, and a rule that appears to do something on one row and
 * nothing on the next is worse than no rule.
 */
export function cardRowBox(row: CardRow, layout: CardLayout): CardRowBox {
  const lone = row.blocks.length === 1 ? row.blocks[0] : undefined;

  return {
    columnGap: `${String(layout.gap)}px`,
    ...(lone?.side === "end" || leadsWithMark(row)
      ? { justifyContent: "flex-end" }
      : {}),
  };
}

/**
 * How much a lead box gives way, against the `flex: none` every block takes.
 *
 * Not `1`. Flex distributes shrinkage in proportion to each item's shrink factor
 * times its basis, so this only has to be large enough that the lead has taken
 * every pixel it has before anything else notices — and every block is `0 0 auto`
 * anyway (see `blockBox`), so in practice nothing else is asked at all. The
 * number is what makes "the empty space goes first" true with no ordering code
 * anywhere: it is a fact about the boxes rather than a pass over them.
 */
const LEAD_SHRINK = 1000;

/** The box that carries a line's leading space, in CSS values. */
export type CardLeadBox = {
  /** The space as a basis, and a shrink factor that dwarfs every block's. */
  flex: string;
  /** Always zero — there is no content in here to protect. */
  minHeight: string;
  /** Cancels the second zone gap this extra item brings with it. */
  marginBottom: string;
};

/**
 * The empty space above a line, as a box that **gives way**.
 *
 * It used to be a `margin-top` on the line itself, and that is the whole of a bug
 * worth writing down. A margin cannot shrink, so a block growing under a card's
 * fixed height — a week of opening hours opened, a paragraph resized — pushed
 * everything below it down and off the bottom, and the only thing that could give
 * the room back was a pass that measured the card and *rewrote the layout*
 * (`fitWithin`, deleted with this). That pass took the space away permanently: it
 * held the lower blocks still while the content grew, and then, when the content
 * shrank again, there was nothing left to put back and every block below rode up
 * and stayed there. Opening and closing one disclosure walked the card's own name
 * up its face.
 *
 * Leading space is *slack* — `roomForNew` in lib/card/card-space.ts already says
 * every other part of this system treats it that way — so here it is slack in the
 * layout too: it is absorbed as content grows and released as content shrinks, in
 * the same frame, with nothing measured, nothing saved and nothing to converge.
 * Past the point where the slack is gone, the middle zone scrolls, which is
 * exactly what a published card has always done.
 *
 * Three numbers, and each is load-bearing:
 *
 * - **`LEAD_SHRINK` against every block's `flex: none`** — see above, and see
 *   `flex` in `blockBox` for why a block may never shrink (one that does cuts its
 *   own text off mid-word instead of letting its zone scroll).
 * - **`min-height: 0`**, because a flex item's automatic minimum is its content
 *   and the browser will not take a box below it. There is no content here, but
 *   the default is `auto` and `auto` is not `0`.
 * - **`margin-bottom: -gap`**, because a zone is a flex column with a gap and
 *   this is one more item in it. At rest the line sits `gap + offset` below its
 *   neighbour, which is exactly where the margin left it; fully compressed it
 *   sits at `gap`, which is exactly where an absent offset leaves it. Without the
 *   cancel both ends would be one gap out.
 *
 * The gap is written out as a number rather than as `var(--card-gap)`, the same
 * call `blockBox` makes for a half's basis: the property is `--card-gap` in the
 * dashboard and `--lm-card-gap` in the embed, and a string mentioning neither is
 * one fewer pair of names to keep in step.
 */
export function leadBox(offset: number, layout: CardLayout): CardLeadBox {
  return {
    flex: `0 ${String(LEAD_SHRINK)} ${String(offset)}px`,
    minHeight: "0",
    marginBottom: `-${String(layout.gap)}px`,
  };
}

/**
 * Whether this line is led by a **mark** that has to keep the room on its far
 * side — and therefore whether the line's unspent share belongs at its head.
 *
 * A flex row leaves whatever a line has not spent at its *end*, and `blockBox`
 * drops a self-sized block's `align-self` the moment it has a neighbour: inside
 * a row that property is the cross axis, where "align right" would silently
 * become "align bottom". So a centred logo lost its leading space to the first
 * thing that landed beside it — the logo packed to the start of the line, and the
 * newcomer, sized from the run it was actually dropped into, ended up in the
 * middle of the card with the leftover trailing it.
 *
 * Putting that leftover at the head instead holds the mark exactly where it was,
 * and *exactly* rather than approximately: `selfTargets` in
 * lib/card/drop-slots.ts gives the newcomer the share it measures off the very
 * run it was released in, so `100 - markShare - newcomerShare` **is** the space
 * that was to the mark's left.
 *
 * Only a mark that **leads** its line. One that follows a column has its leading
 * space spent by that column already, and the leftover falls on its far side
 * with nothing needing to be said.
 *
 * And only for an alignment that actually asks to be away from that start. A
 * mark with no `align` at all draws at the line's start — which is where every
 * logo sat before the field existed — so reading absence as anything else would
 * move a card nobody has touched (CLAUDE.md §7).
 */
function leadsWithMark(row: CardRow): boolean {
  if (row.blocks.length < 2) return false;

  const head = row.blocks[0];

  return (
    isSelfSized(head.type) && (head.align === "center" || head.align === "end")
  );
}

/**
 * What the "More details" fold actually holds on this layout.
 *
 * Whatever has not been pulled out and placed on the card itself. Without this
 * a description dragged into the middle would render twice — once where the
 * owner put it and once inside the fold — which is the one way this model can
 * produce a card nobody designed.
 */
export function detailsContents(layout: CardLayout): CardBlockType[] {
  const placed = new Set<CardBlockType>();

  for (const zone of CARD_ZONES) {
    for (const block of layout.zones[zone]) placed.add(block.type);
  }

  return DETAILS_CONTENTS.filter((type) => !placed.has(type));
}

/** Whether a block of this type may be dropped into this zone. */
export function acceptsBlock(
  layout: CardLayout,
  type: CardBlockType,
  zone: CardZone,
  /** The block being moved, which is allowed to land back on itself. */
  movingId?: string,
): boolean {
  const spec = CARD_BLOCKS[type] as CardBlockSpec | undefined;
  if (!spec || !spec.zones.includes(zone)) return false;
  if (!spec.unique) return true;

  for (const other of CARD_ZONES) {
    for (const block of layout.zones[other]) {
      if (block.type === type && block.id !== movingId) return false;
    }
  }

  return true;
}

/** The block with this id, and where it sits. Null when it is not on the card. */
export function findBlock(
  layout: CardLayout,
  id: string,
): { zone: CardZone; index: number; block: CardBlock } | null {
  for (const zone of CARD_ZONES) {
    const index = layout.zones[zone].findIndex((block) => block.id === id);
    if (index !== -1) {
      return { zone, index, block: layout.zones[zone][index] };
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(
  value: unknown,
  [min, max]: readonly [number, number],
  fallback: number,
): number {
  if (!isNumber(value)) return fallback;

  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * A short line of the owner's own words, trimmed and capped. Empty is "not set".
 *
 * The cap is the point. This is the only place a stored layout carries free
 * text, it is written into the DOM of a stranger's page by both renderers, and
 * a blob hand-edited in the Appwrite console must not be able to make a card
 * arbitrarily large. Newlines go too: a button label is a line, and one carrying
 * a paragraph break would draw a two-storey control nobody designed.
 */
function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;

  const clean = value.replace(/\s+/g, " ").trim().slice(0, max);

  return clean || undefined;
}

/**
 * The words a button's treatment and its hover may be, as lists rather than as
 * types alone.
 *
 * A type is gone by runtime and these two are read out of a stored blob, so
 * `readBlock` needs something it can actually ask. `satisfies` keeps each list
 * and its union in step: drop a word from one and the other stops compiling.
 */
const BUTTON_VARIANTS = ["outline", "soft", "ghost"] as const satisfies
  readonly CardButtonVariant[];
const BUTTON_HOVERS = ["none", "lighten", "lift"] as const satisfies
  readonly CardButtonHover[];

function isButtonVariant(value: unknown): value is CardButtonVariant {
  return BUTTON_VARIANTS.includes(value as CardButtonVariant);
}

function isButtonHover(value: unknown): value is CardButtonHover {
  return BUTTON_HOVERS.includes(value as CardButtonHover);
}

/** A `#rgb` or `#rrggbb`, lowercased. Anything else is "not set". */
function hex(value: unknown): string | undefined {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}
