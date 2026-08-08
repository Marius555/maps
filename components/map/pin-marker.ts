/**
 * Marker DOM as a plain element, not a React portal.
 *
 * Week 3 puts 500+ markers on a map; 500 React trees for 500 pins is a cost with
 * no benefit, since a marker never renders anything but itself.
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

export function setPinSelected(element: HTMLElement, isSelected: boolean): void {
  element.classList.toggle("map-pin--selected", isSelected);
  element.setAttribute("aria-current", isSelected ? "true" : "false");
}
