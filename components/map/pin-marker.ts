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

/**
 * Ripple a marker once, because the location under it was just dropped.
 *
 * A class rather than the animation living on `.map-pin__pulse` itself. The rule
 * used to, and CSS starts an animation when the element it matches enters the
 * document — so the ripple was really saying "a marker element was created",
 * which is a different fact and a wrong one: it fired for every pin on page
 * load, twice per drop, and never for a marker the diff pass recycled.
 *
 * Cleared on `animationend` so the same marker can ripple again later, and
 * because a class that outlives its animation would replay it the next time the
 * element re-entered the document. Reduced motion still fires the event — the
 * blanket rule sets a 0.01ms duration rather than `none` for exactly this — so
 * this does not strand the class on anyone.
 */
export function playDrop(element: HTMLElement): void {
  element.classList.add("map-pin--dropped");
  element.addEventListener(
    "animationend",
    () => element.classList.remove("map-pin--dropped"),
    { once: true },
  );
}

export function setPinSelected(element: HTMLElement, isSelected: boolean): void {
  element.classList.toggle("map-pin--selected", isSelected);
  element.setAttribute("aria-current", isSelected ? "true" : "false");
}

/**
 * Whether the routing engine can reach this location.
 *
 * Only ever *looks* different while the route tool is armed — the CSS is scoped
 * under `.picking-pins`, because outside that gesture a pin with no road near it
 * is an ordinary location that opens an ordinary card, and greying it there
 * would be inventing a second meaning for the word. `aria-disabled` follows the
 * same rule and used not to: it was written whenever the answer was known, so a
 * pin that opens an ordinary card was announced disabled to a screen reader for
 * the rest of the session. The caller decides by passing `false` while nothing
 * is armed.
 *
 * Written by the diff pass, and written on *every* pin rather than only the bad
 * ones — markers are recycled, so a class left behind is a location wearing the
 * verdict passed on a different one.
 */
export function setPinUnroutable(
  element: HTMLElement,
  isUnroutable: boolean,
): void {
  element.classList.toggle("map-pin--unroutable", isUnroutable);

  if (isUnroutable) element.setAttribute("aria-disabled", "true");
  else element.removeAttribute("aria-disabled");
}

/**
 * Whether this pin's verdict is being fetched right now.
 *
 * A click on a pin nobody has asked the engine about waits for the answer
 * before it becomes a stop — about a second on the public server, none at all
 * on a warm one. Without a mark on the pin that second is a click that appeared
 * to do nothing, which is the failure this whole feature exists to stop.
 *
 * One pin at a time, and no `aria-disabled`: the pin is not refused, it is
 * being asked about, and the answer usually lets it through.
 */
export function setPinChecking(element: HTMLElement, isChecking: boolean): void {
  element.classList.toggle("map-pin--checking", isChecking);
}

/**
 * Whether this location is already a stop on the route being drawn.
 *
 * A route is clicked out pin by pin, and until this existed nothing on the map
 * said which pins had been taken. On a dense map that is a real question: the
 * straight draft runs between the stops, but a pin sitting under the middle of a
 * long leg looks exactly like one that was clicked, and the only way to find out
 * was to finish the route and read the card.
 *
 * So a taken pin breathes — see `.picking-pins .map-pin--stop` in
 * app/globals.css — for as long as the gesture lasts, and every taken pin does,
 * not just the last one. The cost is bounded by `MAX_ROUTE_STOPS`, which is why
 * an endless animation is affordable here and is not on the ambient
 * `.picking-pins` ripple that plays on every marker of a 3,000-pin map.
 *
 * The same recycled-marker rule as `setPinUnroutable`: written on every pin, so
 * a marker reused for a different location cannot keep a mark it earned as
 * something else. No ARIA — `aria-current` already belongs to `setPinSelected`,
 * and two writers on one attribute is a fight neither wins.
 */
export function setPinStop(element: HTMLElement, isStop: boolean): void {
  element.classList.toggle("map-pin--stop", isStop);
}
