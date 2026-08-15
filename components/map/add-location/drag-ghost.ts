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
 * What is carried is the pin that is about to land — the chosen icon inside the
 * ball, or the bare ball when none was chosen — so the drag reads as one object
 * moving rather than as a tile here and a marker appearing there. The shape, the
 * size, the centring and the lift all live in `.map-pin-ghost`
 * (app/globals.css) — including the transition, which is what puts it under the
 * blanket `prefers-reduced-motion` rule instead of needing its own opt-out.
 *
 * The drawing itself comes from packages/shared/pin-icons.ts, which is also what
 * the marker and the embed draw from. It used to be a string literal here, and a
 * copy in a third place is how the thing in the hand and the thing on the map
 * quietly stop matching.
 */

import { pinSvg, resolvePin, type CustomPinIcon } from "@/packages/shared/pin-icons";

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
export function mountDragGhost(
  x: number,
  y: number,
  icon = "",
  custom?: readonly CustomPinIcon[],
): HTMLElement {
  const element = document.createElement("div");
  const pin = resolvePin(icon, custom);

  element.className = "map-pin-ghost";
  element.setAttribute("aria-hidden", "true");
  // A custom pin carries its own colour, so the thing in the hand is the thing
  // that lands. Without this the ghost would be accent-coloured all the way down
  // and change colour the instant it became a marker.
  if (pin?.color) element.style.setProperty("--pin-color", pin.color);
  element.innerHTML = `<span class="map-pin-ghost__pin">${pinSvg(pin)}</span>`;

  moveDragGhost(element, x, y);
  document.body.append(element);

  // Reading a layout property is what forces the pending style to be computed.
  void element.offsetWidth;
  element.classList.add("map-pin-ghost--lifted");

  return element;
}

/**
 * Position only — one compositor property, no layout, no transition. The pin is
 * centred on the pointer by the negative margins in `.map-pin-ghost`, so this
 * stays a straight translate.
 */
export function moveDragGhost(element: HTMLElement, x: number, y: number): void {
  element.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}
