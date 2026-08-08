import type { SnapshotCategory, SnapshotPlace } from "@/packages/shared/snapshot";

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

  const actions = buildActions(place);
  if (actions) body.append(actions);

  root.append(body);

  return root;
}

function buildActions(place: SnapshotPlace): HTMLElement | null {
  const actions = el("div", "lm-popup__actions");

  if (place.url) actions.append(link("lm-popup__link", "Website", place.url));
  if (place.phone) {
    actions.append(link("lm-popup__link", place.phone, `tel:${place.phone}`));
  }
  if (place.email) {
    actions.append(link("lm-popup__link", "Email", `mailto:${place.email}`));
  }

  // Directions link out rather than being drawn — routing is out of scope for
  // v1 (CLAUDE.md §11), and this costs us nothing.
  actions.append(
    link(
      "lm-popup__link",
      "Directions",
      `https://www.openstreetmap.org/directions?to=${place.lat},${place.lng}`,
    ),
  );

  return actions.childElementCount > 0 ? actions : null;
}
