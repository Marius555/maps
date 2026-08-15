import {
  CUSTOM_PIN_PREFIX,
  PIN_ICONS,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * Every pin a location can wear, four across and two deep, with a way to the rest.
 *
 * There used to be two menus on the toolbar — a four-slot row for "which pin,
 * quickly" and a paged grid for "which pin, out of all of them" — sitting a pixel
 * apart and answering nearly the same question. They are one menu now
 * (components/map/add-location/pin-grid.tsx), which means one grid has to do both
 * jobs: the pins this map actually uses have to be the ones already on screen, and
 * the rest have to be a press away rather than in another control.
 *
 * That is the split between the two functions here. `allPinIcons` decides the
 * order, so recently used pins land on page one. `pinPages` decides where the page
 * breaks fall.
 *
 * Eight cells is the whole constraint. It is what fits over a map without the
 * popover becoming the view, and with up to fifteen pins to show, something has to
 * decide what goes on which page.
 */

/** Says the same 4 as `grid-cols-4` in pin-grid.tsx, which cannot read it. */
export const PIN_MENU_COLUMNS = 4;
export const PIN_MENU_ROWS = 2;
export const PIN_MENU_CELLS = PIN_MENU_COLUMNS * PIN_MENU_ROWS;

/**
 * What is left for pins once "New" has had the last cell.
 *
 * It takes that cell on *every* page, not just the first: the studio is how a pin
 * gets made, and a menu that hid the way in whenever you paged would make "make a
 * new pin" a thing you had to page back to find.
 */
export const PIN_MENU_PIN_CELLS = PIN_MENU_CELLS - 1;

/**
 * Every pin a location can wear, in the order they should be offered.
 *
 * Recently used first, because with fifteen pins and six visible slots the order is
 * the only thing deciding whether the pin you want is on screen or two presses
 * away. Then the map's own pins, because those are the ones somebody made on
 * purpose, then the built-ins. Plain leads regardless: it is the absence of a
 * choice, and the absence of a choice still has to be reachable.
 *
 * Deduplicated by first appearance, so a recent pin appears where it was earned
 * rather than twice. `recentPinIcons` has already dropped anything that does not
 * resolve, so a `custom:` id whose pin was deleted cannot come back in through here.
 */
export function allPinIcons(
  pinIcons: readonly CustomPinIcon[],
  recent: readonly string[] = [],
): string[] {
  return [
    ...new Set([
      "",
      ...recent,
      ...pinIcons.map((pin) => `${CUSTOM_PIN_PREFIX}${pin.id}`),
      ...PIN_ICONS.map((icon) => icon.id),
    ]),
  ];
}

/**
 * Split the pins into pages that fit the grid, leaving room for the navigation.
 *
 * `cells` is the count *after* New has taken its cell, which is why the default is
 * `PIN_MENU_PIN_CELLS` and not `PIN_MENU_CELLS`. Two more slots are not always
 * available and not always spent, which is the only subtlety here. Every page after
 * the first gives its first cell to Back. Every page except the last gives its last
 * pin cell to More. A middle page therefore holds two fewer pins than it has cells,
 * and the first and last hold one fewer — or, if everything fits at once, none
 * fewer and no navigation at all.
 *
 * Whether a page is the last one is not known until you have tried to fill it,
 * hence the fill-then-check rather than an arithmetic `Math.ceil`: take the whole
 * remainder if it fits in what is free, otherwise take one less than free and
 * leave the cell for More.
 *
 * It looks like it only ever needs two pages, and today it nearly does — but the
 * ceiling is one plain pin, eight custom (`MAX_PIN_ICONS`) and six built-in, which
 * is fifteen, and fifteen across seven pin cells is three pages of 6, 5 and 4. A
 * two-page special case would silently drop the last four pins.
 */
export function pinPages(
  icons: readonly string[],
  cells: number = PIN_MENU_PIN_CELLS,
): string[][] {
  const pages: string[][] = [];
  let rest = icons;

  do {
    // Slot one goes to Back on every page but the first.
    const free = cells - (pages.length === 0 ? 0 : 1);

    if (rest.length <= free) {
      pages.push([...rest]);
      break;
    }

    pages.push(rest.slice(0, free - 1));
    rest = rest.slice(free - 1);
  } while (rest.length > 0);

  return pages;
}
