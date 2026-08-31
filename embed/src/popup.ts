import {
  DAY_LABELS_SHORT,
  dayIndex,
  formatDay,
  isEmptyHours,
  isOpenNow,
} from "@/packages/shared/hours";
import { formatDistance, formatDuration, pathLengthM } from "@/packages/shared/geo";
import {
  CARD_ZONES,
  blockBox,
  cardRowBox,
  cardRows,
  defaultCardLayout,
  detailsContents,
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
): HTMLElement {
  // `--place`, because the floor that class carries belongs to a location card
  // alone: a shape holds a name and a sentence and is meant to be smaller
  // (see `buildShapePopup`).
  const root = el("div", "lm-popup lm-popup--place");
  root.style.maxWidth = `${String(layout.width)}px`;

  const context: BlockContext = {
    place,
    category,
    fields,
    pins,
    folded: detailsContents(layout),
  };

  for (const zone of CARD_ZONES) {
    const section = el("div", `lm-popup__zone lm-popup__zone--${zone}`);

    /*
     * Built first, paired second.
     *
     * A builder returning null is this renderer's version of `CardView`'s
     * content filter, and pairing has to happen *after* it for the same reason:
     * on a location with no category, the Name and the Address either side of it
     * should share a line rather than leave a hole where the category would have
     * been. So the blocks that drew something are collected, and `cardRows`
     * pairs those.
     */
    const built: { block: CardBlock; node: HTMLElement }[] = [];

    for (const block of layout.zones[zone]) {
      const node = BUILDERS[block.type](context);
      if (node) built.push({ block, node });
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

      section.append(row.shared ? wrapRow(row, layout, wrapped) : wrapped[0]);
    }

    // An empty zone is not an empty box — it would still pay its own padding,
    // which on a location with no photo is a gap above the name.
    if (section.childElementCount > 0) root.append(section);
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
   * The `--top` / `--bottom` classes stay exactly as they were: the bleed rules
   * key off them, and a rendered top zone is always the first one anyway.
   */
  const zones = root.children;
  if (zones.length > 0) {
    zones[0].classList.add("lm-popup__zone--pad-top");
    zones[zones.length - 1].classList.add("lm-popup__zone--pad-bottom");
  }

  return root;
}

/** Everything a block builder is allowed to know about. */
type BlockContext = {
  place: SnapshotPlace;
  category: SnapshotCategory | undefined;
  fields: SnapshotField[];
  /** The map's pins — what a Logo block draws. */
  pins: readonly CustomPinIcon[];
  /** What "More details" holds — whatever was not pulled onto the card itself. */
  folded: CardBlockType[];
};

/**
 * One builder per block type, each returning null when this location has nothing
 * to put in it.
 *
 * A table rather than a switch because `buildMore` indexes into it too: the fold
 * holds the same blocks the card does, so both are built by the same code and
 * cannot drift into two versions of a description.
 */
const BUILDERS: Record<
  CardBlockType,
  (context: BlockContext) => HTMLElement | null
> = {
  gallery: (context) => buildGallery(photosOf(context.place)),
  logo: (context) => buildLogo(context.place, context.category, context.pins),
  name: (context) => el("h3", "lm-popup__name", context.place.name),
  category: (context) => {
    if (!context.category) return null;

    const chip = el("span", "lm-popup__category", context.category.label);
    chip.style.setProperty("--lm-category-color", context.category.color);

    return chip;
  },
  address: (context) =>
    context.place.address
      ? el("p", "lm-popup__address", context.place.address)
      : null,
  description: (context) =>
    context.place.description
      ? el("p", "lm-popup__description", context.place.description)
      : null,
  hours: (context) => buildHours(context.place),
  fields: (context) => buildFieldRows(context.place, context.fields),
  details: (context) => buildMore(context),
  actions: (context) => buildActions(context.place, context.fields),
  divider: () => el("div", "lm-popup__divider"),
  spacer: () => el("div", "lm-popup__spacer"),
};

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
  const wrap = el("div", `lm-popup__block lm-popup__block--${block.type}`);
  const box = blockBox(block, layout, onRow);

  // Neither is emitted any more — a narrowed block is a flex item of its own
  // row, so its share is the `flex` basis below and where it sits on the line is
  // the row's `justify-content`. Kept as a pass-through because `CardBlockBox`
  // still declares them and this file's job is to apply whatever it hands back,
  // not to know which of its fields are currently in use.
  if (box.width) wrap.style.width = box.width;
  if (box.alignSelf) wrap.style.alignSelf = box.alignSelf;

  if (box.textAlign) wrap.style.textAlign = box.textAlign;

  // The class is what cancels the card's vertical padding at the very top and
  // bottom (see `--bleed` in styles.css); the inline margin is the horizontal
  // half, which is a number rather than the two states that class can express.
  if (box.bleed) wrap.classList.add("lm-popup__block--bleed");
  if (box.marginInline) wrap.style.marginInline = box.marginInline;

  // The empty space above the block, as a custom property rather than as
  // `margin-top` — the stylesheet adds it to the bleed cancel, which an inline
  // margin would simply overwrite. See `--lm-block-offset` in styles.css.
  if (box.marginTop) wrap.style.setProperty("--lm-block-offset", box.marginTop);

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

  if (box.height) wrap.style.height = box.height;

  // `flex` is `blockBox`'s to decide, because two rules want it: a block with a
  // height needs `none`, or the zone's flex column shrinks it back to its
  // content, and a narrowed block needs its share of the line instead. A
  // narrowed photo wants both a height and a basis, so neither can be written
  // blind.
  if (box.flex) wrap.style.flex = box.flex;
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
 * The colour falls back to the category's, never to a theme's: a snapshot is
 * looked at by strangers, and `resolvePin` already answers the fixed grey for a
 * location with neither.
 */
function buildLogo(
  place: SnapshotPlace,
  category: SnapshotCategory | undefined,
  pins: readonly CustomPinIcon[],
): HTMLElement {
  const node = el("div", "lm-popup__logo");
  const pin = resolvePin(place.icon ?? "", pins);

  // Ring, thickness, glyph colour and size, through the one helper the markers
  // and the dashboard's own preview also use.
  for (const [name, value] of Object.entries(
    pinCssVars(pin, undefined, category?.color),
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
  // The row's leading space, as the custom property the stylesheet reads — the
  // same idiom `.lm-popup__block` uses one level down. It is the greater of the
  // pair's two offsets; see `cardRowBox`.
  if (box.marginTop) wrap.style.setProperty("--lm-block-offset", box.marginTop);

  wrap.append(...children);

  return wrap;
}

/**
 * The gallery, as one image the visitor steps through.
 *
 * A strip of thumbnails would say how many there are at a glance and cost
 * another forty pixels of a card this rework exists to shorten, so the count is
 * a line of text over the picture instead.
 *
 * Only the current `src` is ever assigned. A place with eight photos would
 * otherwise start eight downloads the moment its pin is clicked, on a visitor's
 * phone, for seven pictures they may never look at — `loading="lazy"` does not
 * help, because by then the image is on screen.
 */
function buildGallery(photos: string[]): HTMLElement | null {
  if (photos.length === 0) return null;

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
  const count = el("span", "lm-popup__count");

  const show = (next: number) => {
    // Wraps, so back from the first photo reaches the last rather than
    // dead-ending on a control that looks live.
    at = (next + photos.length) % photos.length;
    image.src = photos[at];
    count.textContent = String(at + 1) + " / " + String(photos.length);
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
  root.append(
    step(-1, "back", "M15 18 9 12l6-6"),
    step(1, "on", "m9 18 6-6-6-6"),
    count,
  );

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
 * The week, as a `<details>` that opens on today.
 *
 * Collapsed by default because the answer a visitor actually wants is "can I go
 * now" — that is the summary line. Seven rows of times unprompted would push the
 * address and the directions link out of a 280px popup.
 *
 * Inside "More details" now, so this is a fold within a fold. Still worth
 * keeping: someone who opens the details wants the description and the extra
 * fields, and would meet a week of times on the way to them.
 */
function buildHours(place: SnapshotPlace): HTMLElement | null {
  const hours = place.hours ?? null;
  if (isEmptyHours(hours) || !hours) return null;

  const root = el("details", "lm-popup__hours");
  const summary = el("summary", "lm-popup__hours-summary");

  const open = isOpenNow(hours);
  const state = el(
    "span",
    open ? "lm-popup__hours-state lm-popup__hours-state--open" : "lm-popup__hours-state",
    open ? "Open now" : "Closed now",
  );

  const today = dayIndex();
  summary.append(state, el("span", "lm-popup__hours-today", formatDay(hours[today])));
  root.append(summary);

  const list = el("dl", "lm-popup__hours-list");

  for (let day = 0; day < hours.length; day += 1) {
    const term = el("dt", "lm-popup__hours-day", DAY_LABELS_SHORT[day]);
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
 * The map's own extra fields, rendered in the order the owner defined them.
 *
 * Only the `row` ones. Definition order rather than the order the values happen
 * to sit in the JSON, because the owner arranged these and the same card should
 * read the same way at every location.
 */
function buildFieldRows(
  place: SnapshotPlace,
  fields: SnapshotField[],
): HTMLElement | null {
  const values = place.fields;
  if (!values) return null;

  const root = el("div", "lm-popup__fields");

  for (const field of fields) {
    if (field.showAs !== "row") continue;

    const value = values[field.id];
    if (!value) continue;

    const row = el("div", "lm-popup__field");
    row.append(el("span", "lm-popup__field-label", field.label));
    row.append(fieldValue(field, value, "lm-popup__field-value"));
    root.append(row);
  }

  return root.childElementCount > 0 ? root : null;
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

function buildActions(
  place: SnapshotPlace,
  fields: SnapshotField[],
): HTMLElement | null {
  const actions = el("div", "lm-popup__actions");

  if (place.url) actions.append(link("lm-popup__link", "Website", place.url));
  if (place.phone) {
    actions.append(link("lm-popup__link", place.phone, `tel:${place.phone}`));
  }
  if (place.email) {
    actions.append(link("lm-popup__link", "Email", `mailto:${place.email}`));
  }

  actions.append(link("lm-popup__link", "Directions", directionsUrl(place)));

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

      const element = fieldValue(field, value, "lm-popup__link lm-popup__link--cta");
      // The label, not the value: see above.
      element.textContent = field.label;
      actions.append(element);
    }
  }

  return actions.childElementCount > 0 ? actions : null;
}

/**
 * Where "Directions" goes.
 *
 * Linked out rather than drawn — routing is out of scope for v1 (CLAUDE.md §11),
 * and a link costs us nothing per visitor, which a routing API would not.
 *
 * §12 bans the Google Maps *SDK* and the terms that come with it: storing their
 * business data, caching their coordinates, showing their Places results on our
 * map. An outbound link does none of those, and §11 names it as the intended
 * answer. This was OpenStreetMap's directions page, which is a worse destination
 * for a real customer's visitor than the app already on their phone.
 *
 * Coordinates, never the name. A name is resolved by whoever receives it, and a
 * stockist inside a department store resolves to the department store — the one
 * place a visitor standing outside does not need directions to. Apple takes both
 * and treats `q` as the label only, so there it can have the name as well.
 */
export function directionsUrl(place: SnapshotPlace): string {
  const to = `${place.lat},${place.lng}`;

  if (isApplePlatform()) {
    return `https://maps.apple.com/?daddr=${to}&q=${encodeURIComponent(place.name)}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${to}&travelmode=driving`;
}

/**
 * iOS and iPadOS only, deliberately — not macOS.
 *
 * On an iPhone, Apple Maps is the app that exists; Google Maps may not be
 * installed at all, and its web page then asks the visitor to install it instead
 * of giving them a route. On a Mac the browser is as likely to be Chrome as
 * Safari and Google Maps opens in the tab they are already in, so the default
 * stays there.
 *
 * iPadOS 13+ reports itself as a Macintosh, which is why the touch count is part
 * of the test: no real Mac reports more than one touch point.
 */
function isApplePlatform(): boolean {
  const ua = navigator.userAgent;

  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}
