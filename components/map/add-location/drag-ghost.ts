/**
 * The pin that follows the pointer while one is dragged out of the toolbar.
 *
 * Plain DOM rather than a React portal, for the same reason the markers next
 * door are (pin-marker.ts): it renders nothing but itself, it is moved sixty
 * times a second, and every one of those moves would otherwise be a render.
 * On `document.body` because the toolbar and the map frame both clip, and a pin
 * dragged towards the edge of either would be cut in half by an ancestor's
 * `overflow: hidden` — `position: fixed` does not escape that on its own.
 *
 * What is carried is the icon on the button it came out of, so the drag reads as
 * one object moving rather than as a button here and a dot appearing there. The
 * shape, the size, the tip offset and the lift all live in `.map-pin-ghost`
 * (app/globals.css) — including the transition, which is what puts it under the
 * blanket `prefers-reduced-motion` rule instead of needing its own opt-out.
 */

/**
 * lucide-react's `map-pin`, copied from
 * node_modules/lucide-react/dist/esm/icons/map-pin.mjs.
 *
 * Inlined rather than imported: this file is deliberately outside React, and the
 * icon is two paths that have not changed in years. It is the same drawing the
 * button renders — if lucide ever redraws it, this is the line to update.
 */
const PIN_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>' +
  '<circle cx="12" cy="10" r="3"/>' +
  "</svg>";

/**
 * Build the pin, put it under the pointer, and start it growing.
 *
 * Creation and mounting are one call because the order matters and is easy to
 * get wrong in three: positioned *before* it is appended, so it never paints for
 * a frame at the viewport's corner and snaps; and lifted only after a forced
 * reflow, so the browser has computed the small state and has something to
 * animate away from. Adding the class in the same tick as the append gives the
 * transition no start value and the pin simply appears at full size.
 */
export function mountDragGhost(x: number, y: number): HTMLElement {
  const element = document.createElement("div");

  element.className = "map-pin-ghost";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<span class="map-pin-ghost__pin">${PIN_SVG}</span>`;

  moveDragGhost(element, x, y);
  document.body.append(element);

  // Reading a layout property is what forces the pending style to be computed.
  void element.offsetWidth;
  element.classList.add("map-pin-ghost--lifted");

  return element;
}

/**
 * Position only — one compositor property, no layout, no transition. The tip is
 * put on the pointer by the negative margins in `.map-pin-ghost`, so this stays
 * a straight translate.
 */
export function moveDragGhost(element: HTMLElement, x: number, y: number): void {
  element.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}
