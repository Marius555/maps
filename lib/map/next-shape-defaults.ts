import type { Shape } from "@/lib/repositories/types";
import { PALETTE_COLORS } from "@/lib/validation/palette";
import type { ShapeKind } from "@/packages/shared/shapes";

/** Matches the placeholder names this module hands out, and only those. */
const PLACEHOLDER_NAME = /^(Circle|Area|Line|Route) (\d+)$/;

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
 *
 * "Line" is both, so it stays as it is: the gesture and the object have the same
 * name, and inventing a second word for one of them would only be a word to learn.
 *
 * "Route" is not a `ShapeKind` and never will be — a route is stored as a line
 * (packages/shared/shapes.ts). It is a name in this list all the same, because
 * this list is the vocabulary the *owner* reads, and a thing whose card says
 * "Route · 12 km · 19 min" cannot be called "Line 3". Routes number themselves
 * separately from lines for the same reason circles do from areas: the numbering
 * is a way of telling two of the same thing apart.
 */
const NOUNS: Record<ShapeNoun, string> = {
  circle: "Circle",
  polygon: "Area",
  line: "Line",
  route: "Route",
};

/** What a shape is called to its owner — see NOUNS. */
export type ShapeNoun = ShapeKind | "route";

export function nextShapeDefaults(
  shapes: readonly Pick<Shape, "name" | "sortOrder">[],
  kind: ShapeNoun,
  /**
   * A colour the gesture itself supplied — the first pin a line or route was
   * drawn through. See lib/map/shape-seed-color.ts. Absent for a circle or a
   * polygon, which are dragged out over ground with no pin in them.
   */
  preferredColor?: string,
): ShapeDefaults {
  const noun = NOUNS[kind];

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
    /*
     * A line or a route takes the colour of the pin it was drawn from, because
     * that is a colour the owner has already chosen for something on this map.
     *
     * Everything else cycles through the same palette the categories offer, so
     * two areas drawn in a row are not the same colour and neither has to be
     * recoloured by hand to tell them apart. Two routes out of one depot *are*
     * the same colour, and that is the point of the rule rather than a cost of
     * it: they are both that depot's.
     */
    color: preferredColor ?? PALETTE_COLORS[shapes.length % PALETTE_COLORS.length],
    sortOrder: highestSortOrder + 1,
  };
}
