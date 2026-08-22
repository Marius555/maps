import {
  DAY_LABELS_SHORT,
  dayIndex,
  formatDay,
  isEmptyHours,
  isOpenNow,
} from "@/packages/shared/hours";
import { formatDistance, pathLengthM } from "@/packages/shared/geo";
import type {
  SnapshotCategory,
  SnapshotField,
  SnapshotPlace,
  SnapshotShape,
} from "@/packages/shared/snapshot";

import { el, link } from "./dom";

/**
 * The card shown when a visitor clicks a pin.
 *
 * Built as DOM nodes rather than an HTML string. Every field here is customer
 * text landing on a third party's page, and `textContent` makes injection
 * impossible rather than merely unlikely.
 */
export function buildPopup(
  place: SnapshotPlace,
  category: SnapshotCategory | undefined,
  fields: SnapshotField[] = [],
): HTMLElement {
  const root = el("div", "lm-popup");

  if (place.photoUrl) {
    const image = el("img", "lm-popup__photo");
    image.src = place.photoUrl;
    // The name is the caption; repeating it as alt text makes a screen reader
    // read it twice.
    image.alt = "";
    image.loading = "lazy";
    root.append(image);
  }

  const body = el("div", "lm-popup__body");
  body.append(el("h3", "lm-popup__name", place.name));

  if (category) {
    const chip = el("span", "lm-popup__category", category.label);
    chip.style.setProperty("--lm-category-color", category.color);
    body.append(chip);
  }

  if (place.address) body.append(el("p", "lm-popup__address", place.address));
  if (place.description) {
    body.append(el("p", "lm-popup__description", place.description));
  }

  const hours = buildHours(place);
  if (hours) body.append(hours);

  // Between the hours and the actions: an extra field is a detail about the
  // place, and the row-shaped ones read as part of the description. The
  // button-shaped ones are pulled out and land with the other actions instead.
  const extras = buildFieldRows(place, fields);
  if (extras) body.append(extras);

  const actions = buildActions(place, fields);
  if (actions) body.append(actions);

  root.append(body);

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
 * one republish away from disagreeing, and the sum costs microseconds.
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
    body.append(
      el(
        "p",
        "lm-popup__distance",
        formatDistance(pathLengthM(shape.points) / 1000),
      ),
    );
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
