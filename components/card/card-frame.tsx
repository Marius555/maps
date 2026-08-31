"use client";

import { ScrollShadow } from "@heroui/react";
import type { CSSProperties, ReactNode, Ref } from "react";

import {
  CARD_ZONES,
  blockBox,
  cardRowBox,
  upwardLiftOf,
  type CardBlock,
  type CardLayout,
  type CardRow,
  type CardShadow,
  type CardZone,
} from "@/packages/shared/card-layout";

/**
 * The same three values `embed/src/map.ts`'s own `CARD_SHADOWS` sets as a CSS
 * variable — kept equal by hand, the way `tile-style.test.ts` holds its own
 * constants equal, because neither renderer imports the other. "None" is a
 * real choice here too: absent would fall back to whatever ambient shadow the
 * dashboard chrome happens to have, the opposite of what picking "none" asked
 * for.
 */
const CARD_SHADOWS: Record<CardShadow, string> = {
  none: "none",
  soft: "0 1px 2px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.12)",
  strong: "0 2px 6px rgba(0, 0, 0, 0.16), 0 12px 32px rgba(0, 0, 0, 0.22)",
};

/**
 * The card's own box, and the three zones inside it.
 *
 * Shared by the editor's place card and the designer canvas, so what the owner
 * arranges is literally what the editor draws — the designer is not a picture of
 * the card, it is the card with handles on it. The embed builds the same
 * structure by hand (embed/src/popup.ts) because it must not ship React; the
 * class names there are its own, the *shape* is this one.
 *
 * Zones rather than a flat list because that is the whole safety model: a block
 * belongs to top, middle or bottom, only the middle scrolls, and the padding
 * lives on the zone so a photo can bleed out through it to the card's edges.
 *
 * The sizes are inline styles rather than Tailwind classes deliberately. They
 * come from numbers the owner chose at runtime, and a utility class cannot be
 * generated for a value that does not exist until someone drags a handle.
 */

/** The card's design as CSS custom properties, for the parts CSS reads. */
export function cardVars(layout: CardLayout): CSSProperties {
  return {
    "--card-pad": `${String(layout.padding)}px`,
    "--card-gap": `${String(layout.gap)}px`,
  } as CSSProperties;
}

/** The card's own box. */
export function cardStyle(layout: CardLayout): CSSProperties {
  return {
    ...cardVars(layout),
    width: `${String(layout.width)}px`,
    borderRadius: `${String(layout.radius)}px`,
    /*
     * A colour the owner never chose is left to the stylesheet, never resolved
     * to a literal here. Absent means "whatever surface this theme uses", which
     * is what keeps a card readable in dark mode — a stored `#ffffff` could not
     * be, and would look deliberate while being wrong.
     */
    ...(layout.background ? { background: layout.background } : {}),
    ...(layout.border && layout.borderWidth > 0
      ? { border: `${String(layout.borderWidth)}px solid ${layout.border}` }
      : {}),
    boxShadow: CARD_SHADOWS[layout.shadow],
  };
}

/**
 * A block's own box — the same arithmetic the embed runs.
 *
 * `onRow` is `row.shared` for the line this block was found on, and it is only
 * read by the one block whose box is a size of its own: a mark alone in the
 * zone's flex *column* is positioned by `align-self`, and a mark in a flex
 * *row* by which side of it its neighbours are on. See `blockBox`.
 */
export function blockStyle(
  block: CardBlock,
  layout: CardLayout,
  onRow = false,
): CSSProperties {
  const box = blockBox(block, layout, onRow);

  return {
    ...(box.width ? { width: box.width } : {}),
    /*
     * Its own property, not something a width drags along with it. Two different
     * blocks want it for two different reasons — a logo positioning its box
     * across the zone's column, and a block sharing a line positioning itself up
     * and down that line — and only one of them has a width. See `alignSelf` on
     * `CardBlockBox`.
     */
    ...(box.alignSelf ? { alignSelf: box.alignSelf } : {}),
    // A block pulled over its neighbour has to be painted over it too. Tree
    // order alone would do for a block that overlaps the one *above* it, and not
    // for one that overlaps the block below.
    ...(box.raised ? { position: "relative" as const, zIndex: 1 } : {}),
    ...(box.textAlign ? { textAlign: box.textAlign as "start" } : {}),
    /*
     * A custom property rather than a prop threaded down to the image. The
     * `img` is several components below this — `CardBlockContent` takes a type
     * and a place, not a block — and a variable the image's own rule falls back
     * through reaches it without any of them learning about a field only the
     * gallery has. The embed does the same thing under its own name; see
     * `.lm-popup__photo`.
     */
    ...(box.objectFit
      ? ({ "--card-fit": box.objectFit } as CSSProperties)
      : {}),
    ...(box.height ? { height: box.height } : {}),
    // `flex` is `blockBox`'s to decide, because two rules want it: a sized block
    // needs `none` or the flex column shrinks it back to its content, and a
    // block sharing its line needs half the row instead. See `flex` on
    // `CardBlockBox` — a half gallery wants a height *and* a basis.
    ...(box.flex ? { flex: box.flex } : {}),
    ...(box.overflowWrap
      ? { overflowWrap: box.overflowWrap as "anywhere" }
      : {}),
    ...(box.padding ? { padding: box.padding } : {}),
    // Against the card's padding, which the zone pays for every block alike —
    // negative to reach the card's edges, positive to sit further in. Only the
    // outermost block cancels the *vertical* padding too; a band across the
    // middle of a card should not eat the gap below it. Which one that is, is
    // the zone's business — see `blockEdges`, which also owns `margin-top`
    // outright, because the block's own leading space lands on the same
    // property as that cancel and the two have to add up rather than replace
    // each other.
    ...(box.marginInline ? { marginInline: box.marginInline } : {}),
  };
}

/**
 * A block's *content* box: the element between the block and what it draws.
 *
 * It is a second style object rather than another key on `blockStyle` because it
 * lands on a different element — zooming the flex item itself would resolve that
 * item's basis inside a scaled coordinate space, and the basis is the one thing
 * about a half that has to be exact.
 *
 * **`height: 100%` when there is no zoom, and that is not decoration.** Both
 * dashboard renderers put this div in for every block, zoomed or not, on the
 * argument that an empty style object costs nothing anyone can see. It cost the
 * photo: the div is auto-height, so the gallery's `h-full` image resolved
 * `height: 100%` against `auto` and fell back to the picture's own size, cropped
 * by the block's `overflow-hidden` — which is not the same as filling the height
 * its owner dragged the handle to, and not what the embed drew either, because
 * `applyBox` there only builds this element when there is a zoom to put on it
 * (embed/src/popup.ts). A percentage height against an auto-height parent still
 * resolves to `auto`, so this changes nothing for the blocks that grow to their
 * content; it only stops the div swallowing a height that was really set.
 */
export function blockContentStyle(
  block: CardBlock,
  layout: CardLayout,
): CSSProperties {
  const { contentZoom } = blockBox(block, layout);

  return contentZoom === undefined ? { height: "100%" } : { zoom: contentZoom };
}

/**
 * The box of a line holding a pair of halves.
 *
 * `align-items` is left at its default `stretch`, which is what makes a pair
 * look like a pair: a photo with a height sets the line's height and the name
 * beside it fills it, rather than the two ending up different sizes with a step
 * between them.
 *
 * A full-width block never goes through here — it stays a direct child of the
 * zone, drawing exactly the box it always drew.
 *
 * `justify-content` is `cardRowBox`'s to decide, and what it says is which end
 * the line's unspent share sits at: a lone half moved to the end of its line, or
 * a mark leading a line it shares, which has to keep the room that was on its far
 * side. Absent leaves the row at its start, which is where a line's contents have
 * always sat.
 */
export function cardRowStyle(row: CardRow, layout: CardLayout): CSSProperties {
  const box = cardRowBox(row, layout);

  return {
    display: "flex",
    minWidth: 0,
    columnGap: box.columnGap,
    ...(box.marginTop ? { marginTop: box.marginTop } : {}),
    ...(box.justifyContent ? { justifyContent: box.justifyContent } : {}),
  };
}

/**
 * A block's vertical margins: the empty space above it, how far it is pulled
 * over its neighbour, and — for the first line of the top zone and the last of
 * the bottom zone — the cancel that lets a bleeding block reach the card's edge.
 *
 * One function because all three write `margin-top` and a card can want more
 * than one at once: a photo flush to the top of a card that its owner has then
 * pushed down, a logo pulled up over that photo *and* nudged down from it. Three
 * spreads in the caller would silently drop whichever came first.
 *
 * **The overlap is decided here rather than in `blockBox` because only this
 * knows whether there is anything to overlap**, and what there has to be is a
 * *line* above — see `upwardLiftOf` in packages/shared/card-layout.ts, which is
 * the one place that rule is written down now that the embed and the drop
 * geometry ask it too.
 */
export function blockEdges(
  block: CardBlock,
  layout: CardLayout,
  zone: CardZone,
  /**
   * Whether this block's **line** is the first of its zone — `row.index === 0`,
   * for every member of that line alike, never the block's own index. A block is
   * pulled over the line above it, and every member of the top line has the same
   * nothing above it.
   */
  isFirstLine: boolean,
  /** The same at the other end — `row.end === blocks.length`. */
  isLastLine: boolean,
  /** `row.shared` for this block's line — see `blockStyle`. */
  onRow = false,
): CSSProperties {
  const box = blockBox(block, layout, onRow);
  const cancelTop = box.bleed && zone === "top" && isFirstLine;
  const cancelBottom = box.bleed && zone === "bottom" && isLastLine;

  // Only against a line in this zone — see `upwardLiftOf`, which the drop
  // geometry reads so the mark it draws and the margin written here agree.
  const above =
    box.overlap && upwardLiftOf(block, layout, !isFirstLine) > 0
      ? box.overlap
      : undefined;
  const below =
    box.overlap && box.overlapEdge === "below" && !isLastLine
      ? box.overlap
      : undefined;

  const cancel = "calc(var(--card-pad) * -1)";

  let marginTop = box.marginTop;
  if (above) {
    marginTop = marginTop
      ? `calc(${marginTop} - ${above})`
      : `calc(${above} * -1)`;
  }
  if (cancelTop) {
    marginTop = marginTop
      ? `calc(var(--card-pad) * -1 + ${marginTop})`
      : cancel;
  }

  // The two cannot both apply: a bleeding block cancels the padding only at the
  // zone's own end, and an overlap only applies away from it.
  const marginBottom = cancelBottom
    ? cancel
    : below
      ? `calc(${below} * -1)`
      : undefined;

  return {
    ...(marginTop ? { marginTop } : {}),
    ...(marginBottom ? { marginBottom } : {}),
  };
}

/**
 * A zone's own class, and the two things about it that depend on its neighbours.
 *
 * **The card's vertical padding belongs to whichever zones are on the ends**,
 * and it used to belong to the zones *named* top and bottom, which is not the
 * same thing and was a real bug. A zone with nothing in it is not rendered at
 * all — `CardView` returns null and the embed appends nothing (see the filter
 * in card-view.tsx and `section.childElementCount` in embed/src/popup.ts) —
 * because its padding would otherwise be a band of nothing at the top or bottom
 * of the card. But then a location with no photo and no contact details lost
 * *both* end zones, and with them every pixel of vertical padding the card had:
 * its name sat flush against the top edge and the Edit footer sat flush against
 * the bottom, in a card seventy pixels tall. Measured, on a location that had
 * only a name.
 *
 * So the caller says which of the rendered zones is first and which is last,
 * and the padding goes there. With all three present that is the top and the
 * bottom exactly as before, which is why no populated card moves.
 *
 * The bleed rules are safe against this by construction, and it is worth saying
 * why rather than rediscovering it: zones run top → middle → bottom, so a
 * rendered top zone is always the first and a rendered bottom zone always the
 * last. `blockEdges`' `cancelTop` / `cancelBottom` therefore still name the zone
 * that actually carries the padding they cancel.
 *
 * The designer cannot drop the element — it has to stay a drop target and a
 * thing to measure — so it passes `padTop` / `padBottom` false for an empty
 * zone instead, which leaves it exactly the zero-height box a missing zone
 * leaves.
 *
 * The middle zone's scrollbar is hidden without the scrolling going with it —
 * `hideScrollBar` on the `ScrollShadow` in `CardZoneBox`, which is what the
 * `card-scroll` class used to do by hand. A bar drawn inside a card whose every
 * other pixel its owner chose is chrome they did not design, and it moves the
 * card's content sideways the moment it appears.
 */
function zoneClass(zone: CardZone, padTop: boolean, padBottom: boolean): string {
  /*
   * The bottom zone pads its own top whether or not it is the zone carrying the
   * card's top padding, and that is a second rule rather than a special case of
   * the first.
   *
   * Nothing separates one zone from the next — the card is a plain flex column,
   * and the `--card-gap` between blocks is a gap *inside* a zone. That is right
   * for the photo the top zone bleeds to the card's edges, and wrong for the
   * bottom one: the contact row sits directly under the last line of the opening
   * hours, close enough to read as one more row of them. So the actions strip
   * takes the card's own padding above it, which is the same measurement it
   * already carries below and at both sides.
   */
  const padsTop = padTop || zone === "bottom";

  const pad = `${padsTop ? "pt-[var(--card-pad)]" : ""} ${
    padBottom ? "pb-[var(--card-pad)]" : ""
  }`;

  // The only scroller. The name and the actions are what the card is *for*, so
  // they stay put while the description and the week move under them.
  const own =
    zone === "middle" ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : "";

  return `${own} ${pad}`;
}

export function CardZoneBox({
  zone,
  children,
  className,
  padTop = zone === "top",
  padBottom = zone === "bottom",
}: {
  zone: CardZone;
  children: ReactNode;
  className?: string;
  /**
   * Whether this zone is the first one drawn, and so carries the card's top
   * padding — and the same at the other end. See `zoneClass`.
   *
   * They default to the zone's own name, which is what all three rendered zones
   * work out to anyway; every caller that can drop a zone passes them.
   */
  padTop?: boolean;
  padBottom?: boolean;
}) {
  const boxClass = `flex min-w-0 flex-col gap-[var(--card-gap)] px-[var(--card-pad)] ${zoneClass(zone, padTop, padBottom)}${className ? ` ${className}` : ""}`;

  /*
   * The middle zone is the only one that scrolls, so it is the only one that has
   * to say so. A 320px card can hold a photo, a name, an address, a description
   * and a week of opening hours, and with the scrollbar hidden — which it must
   * be, see above — there was nothing at all telling a visitor the card went on
   * below the fold. A fade at the edge is the smallest thing that does.
   *
   * `ScrollShadow` renders one `<div>` and spreads the rest of its props onto
   * it, so `data-zone` still lands where the designer's drop targets look for
   * it and the flex arithmetic is unchanged. `hideScrollBar` is exactly what the
   * hand-written `card-scroll` class did.
   */
  if (zone === "middle") {
    return (
      <ScrollShadow data-zone={zone} className={boxClass} hideScrollBar size={24}>
        {children}
      </ScrollShadow>
    );
  }

  return (
    <div data-zone={zone} className={boxClass}>
      {children}
    </div>
  );
}

/**
 * The card, laid out.
 *
 * `renderZone` rather than a fixed body, because the designer needs drop targets
 * between the blocks and the editor's card must have none — the difference
 * between the two surfaces is entirely what goes *inside* a zone.
 */
export function CardFrame({
  layout,
  className,
  style,
  renderZone,
  children,
  rootProps,
  ref,
}: {
  layout: CardLayout;
  className?: string;
  style?: CSSProperties;
  renderZone: (zone: CardZone) => ReactNode;
  /** Chrome that is not part of the layout — a close button, an Edit footer. */
  children?: ReactNode;
  /**
   * Extra props spread onto the root — the designer's own catch-all drop
   * target, so a block dropped anywhere over the card but not on a specific
   * gap still resolves to *something* rather than to nothing at all. `CardView`
   * never passes this.
   */
  rootProps?: Record<string, unknown>;
  /**
   * The card's own box, for the designer's drop geometry — every zone and block
   * rect is measured relative to this one, so a target's position is in the
   * card's own coordinates rather than the viewport's. `CardView` never passes
   * it.
   */
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      {...rootProps}
      ref={ref}
      style={{ ...cardStyle(layout), ...style }}
      className={`flex max-w-full flex-col overflow-hidden bg-surface ${className ?? ""}`}
    >
      {CARD_ZONES.map((zone) => renderZone(zone))}
      {children}
    </div>
  );
}
