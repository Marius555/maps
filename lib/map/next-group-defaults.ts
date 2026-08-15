import type { Group } from "@/lib/repositories/types";
import { CATEGORY_COLORS } from "@/lib/validation/category.schema";

/** Matches the placeholder names this module hands out, and only those. */
const PLACEHOLDER_NAME = /^Group (\d+)$/;

export type GroupDefaults = {
  name: string;
  color: string;
  sortOrder: number;
};

/**
 * The name, colour and position a group gets the moment it is made.
 *
 * Same reasoning as `nextShapeDefaults`, which this mirrors: a group is created
 * by a gesture — a marquee, or one row dropped on another — and stopping to ask
 * for a name mid-gesture would interrupt the thing the user was actually doing.
 * Renaming it afterwards is one click on a row that is already in front of them.
 *
 * Numbered from the highest already in use rather than from the count, so
 * deleting "Group 2" of three does not make the next one a second "Group 3".
 */
export function nextGroupDefaults(
  /** `color` is optional so a caller with only names and orders still works. */
  groups: readonly (Pick<Group, "name" | "sortOrder"> & { color?: string })[],
): GroupDefaults {
  let highestNumber = 0;
  let highestSortOrder = -1;
  let placeholders = 0;

  for (const group of groups) {
    const match = PLACEHOLDER_NAME.exec(group.name);

    if (match) {
      placeholders += 1;

      // Guarded for the same reason nextShapeDefaults guards: the pattern
      // accepts digits, not sane numbers.
      const parsed = Number(match[1]);
      if (Number.isSafeInteger(parsed)) {
        highestNumber = Math.max(highestNumber, parsed);
      }
    }

    highestSortOrder = Math.max(highestSortOrder, group.sortOrder);
  }

  return {
    name: `Group ${Math.max(highestNumber, placeholders) + 1}`,
    color: unusedColor(groups),
    sortOrder: highestSortOrder + 1,
  };
}

/**
 * The first colour in the palette no other group is already wearing.
 *
 * It used to be `CATEGORY_COLORS[groups.length % 8]`, which is enough when the
 * colour is decoration — two groups made in a row get different ones. It is not
 * enough now that a group's colour is painted onto its members (see
 * map-editor.tsx): the whole point is that one colour means one group, and two
 * groups sharing a colour says the opposite on the map.
 *
 * Counting by length collides as soon as a group is deleted, which is no longer
 * rare — an emptied group deletes itself, so lengths repeat constantly. Make one
 * group, empty it, make another: both land on index 1.
 *
 * Past eight groups the palette is exhausted and something has to repeat; the
 * count is as good a tie-break as any at that point.
 */
function unusedColor(
  groups: readonly { color?: string }[],
): (typeof CATEGORY_COLORS)[number] {
  const taken = new Set(groups.map((group) => group.color));
  const free = CATEGORY_COLORS.find((color) => !taken.has(color));

  return free ?? CATEGORY_COLORS[groups.length % CATEGORY_COLORS.length];
}
