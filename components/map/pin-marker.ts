import {
  pinSvg,
  resolvePin,
  type CustomPinIcon,
  type ResolvedPin,
} from "@/packages/shared/pin-icons";

/**
 * Marker DOM as a plain element, not a React portal.
 *
 * Week 3 puts 500+ markers on a map; 500 React trees for 500 pins is a cost with
 * no benefit, since a marker never renders anything but itself.
 *
 * One shape at two sizes, and the split is the data's, not a style choice. A
 * location with no icon is a small ball, which is all a position needs to be. A
 * location with one is the bigger ball it was dragged out of the menu as, glyph
 * and all — because the icon is the thing the owner chose, and a marker that
 * quietly discards it is the bug this replaced.
 */
export function createPinElement(label: string): HTMLElement {
  const element = document.createElement("button");

  element.type = "button";
  element.className = "map-pin";
  element.setAttribute("aria-label", label);
  element.innerHTML =
    '<span class="map-pin__dot" aria-hidden="true"></span>' +
    '<span class="map-pin__pulse" aria-hidden="true"></span>';

  return element;
}

/**
 * Swap a marker's icon in place, and report back what it turned out to be.
 *
 * Separate from creation, and called on every diff pass, for the same reason
 * `setPinColor` next door is: the marker layer syncs by diffing, and rebuilding
 * an element to change its look would restart the drop animation on a pin that
 * merely had its category renamed.
 *
 * The dot and the pulse stay in the DOM either way. Which of them is visible is
 * the stylesheet's business (`.map-pin--icon`), so this writes one class and one
 * SVG and nothing else has to agree with it.
 *
 * Returns the resolved pin so the caller can read its colour without looking the
 * id up a second time — a custom pin brings its own, and that is the one place in
 * the editor where it beats the category's.
 */
export function setPinIcon(
  element: HTMLElement,
  icon: string,
  custom?: readonly CustomPinIcon[],
): ResolvedPin | null {
  const resolved = resolvePin(icon, custom);
  const existing = element.querySelector(".map-pin__shape");

  element.classList.toggle("map-pin--icon", Boolean(resolved));

  if (!resolved) {
    existing?.remove();
    return null;
  }

  // Keyed by the drawing rather than by the id, so a marker whose pin has not
  // changed keeps the SVG it has — while one whose custom pin was recoloured in
  // the studio does get a new one.
  if (existing?.getAttribute("data-pin") === resolved.key) return resolved;

  const shape = document.createElement("span");
  shape.className = "map-pin__shape";
  shape.setAttribute("aria-hidden", "true");
  shape.setAttribute("data-pin", resolved.key);
  shape.innerHTML = pinSvg(resolved);

  if (existing) existing.replaceWith(shape);
  else element.prepend(shape);

  return resolved;
}

export function setPinSelected(element: HTMLElement, isSelected: boolean): void {
  element.classList.toggle("map-pin--selected", isSelected);
  element.setAttribute("aria-current", isSelected ? "true" : "false");
}
