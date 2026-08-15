import type { Place } from "@/lib/repositories/types";
import { PIN_ICONS, resolvePin, type CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * The pins that earn their way onto page one of the add menu.
 *
 * The menu shows six pins at a time and a full map has fifteen, so the order is
 * the only thing deciding whether the pin you want is on screen or two presses
 * away. These go first (`allPinIcons` in lib/map/pin-pages.ts inserts them right
 * after the plain pin): whatever this map was last pinned with is what is under
 * the cursor next time, and everything else is behind More.
 *
 * That also closes the loop with the studio. Picking a pin there is the thing that
 * puts it at the front here, and the menu is the only place a pin can be *dragged*
 * from — a sheet with a backdrop over the map cannot be a drag source.
 *
 * Two, rather than some larger slice of the page, because they are meant to be the
 * pins you are working with right now. A count is all that stands behind that, and
 * nothing downstream assumes this one.
 *
 * Derived rather than stored. A "recently used" list on the map row would be a
 * third thing to keep in sync with the places and the pins, and it would be wrong
 * the moment a location was edited in another tab.
 */
export function recentPinIcons(
  places: Place[],
  pinIcons: readonly CustomPinIcon[],
  count = 2,
): string[] {
  const picked: string[] = [];

  /*
   * `updatedAt`, not `createdAt`. Assigning a pin from the location edit form is
   * using it just as much as dropping one is, and that only moves `updatedAt`.
   * The cost is that renaming a location also resurfaces its pin — which puts the
   * pin you were last working with under the cursor, so it is not much of a cost.
   */
  const recent = [...places].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  for (const place of recent) {
    if (picked.length >= count) break;
    if (picked.includes(place.icon)) continue;
    // Skips plain pins, unknown built-ins, and `custom:` ids whose pin has since
    // been deleted — all of which draw a plain pin, and slot one is already that.
    if (!resolvePin(place.icon, pinIcons)) continue;

    picked.push(place.icon);
  }

  // A new map has nothing to go on, and two empty slots would read as broken.
  for (const icon of PIN_ICONS) {
    if (picked.length >= count) break;
    if (picked.includes(icon.id)) continue;

    picked.push(icon.id);
  }

  return picked;
}
