import type { Shape } from "@/lib/repositories/types";
import { CATEGORY_COLORS } from "@/lib/validation/category.schema";
import type { ShapeKind } from "@/packages/shared/shapes";

/** Matches the placeholder names this module hands out, and only those. */
const PLACEHOLDER_NAME = /^(Circle|Area) (\d+)$/;

export type ShapeDefaults = {
  name: string;
  color: string;
  sortOrder: number;
};

/**
 * The name, colour and position a shape gets the moment it is drawn.
 *
 * Same reasoning as `nextPlaceDefaults`, which this mirrors: a shape has to be
 * saved and named before a form could be shown for it, because the alternative is
 * a modal opening over the outline you just traced, on top of the map, before you
 * have seen what you drew.
 *
 * Numbered from the highest already in use rather than from the count, so
 * deleting "Circle 2" of three does not make the next one a second "Circle 3".
 *
 * "Area" rather than "Polygon" for the polygon case. The tool is called Polygon
 * because that names the gesture — click the corners — but the thing on the map
 * is an area, and that is what it should be called once it exists.
 */
export function nextShapeDefaults(
  shapes: readonly Pick<Shape, "name" | "sortOrder">[],
  kind: ShapeKind,
): ShapeDefaults {
  const noun = kind === "circle" ? "Circle" : "Area";

  let highestNumber = 0;
  let highestSortOrder = -1;
  let sameKind = 0;

  for (const shape of shapes) {
    const match = PLACEHOLDER_NAME.exec(shape.name);

    if (match && match[1] === noun) {
      sameKind += 1;

      // Guarded for the same reason nextPlaceDefaults guards: the pattern accepts
      // digits, not sane numbers.
      const parsed = Number(match[2]);
      if (Number.isSafeInteger(parsed)) {
        highestNumber = Math.max(highestNumber, parsed);
      }
    }

    highestSortOrder = Math.max(highestSortOrder, shape.sortOrder);
  }

  return {
    name: `${noun} ${Math.max(highestNumber, sameKind) + 1}`,
    // Cycled through the same palette the categories offer, so two shapes drawn
    // in a row are not the same colour and neither has to be recoloured by hand
    // to tell them apart.
    color: CATEGORY_COLORS[shapes.length % CATEGORY_COLORS.length],
    sortOrder: highestSortOrder + 1,
  };
}
