import type { Group, Place, Shape } from "@/lib/repositories/types";
import { routeOf, type RouteStop } from "@/packages/shared/shapes";
import { groupColorIndex } from "./group-colors";
import { groupMembers } from "./group-members";

/**
 * The Locations panel as one flat run of rows.
 *
 * It used to be three nested lists — a Groups section whose every group rendered
 * its own `PlaceList` and `ShapeList`, then a loose `PlaceList` and a loose
 * `ShapeList` beside it. Which meant a location's row lived in a *different
 * component tree* depending on whether it was in a group, so changing its
 * `groupId` was an unmount over here and a mount over there. On screen that read
 * as the row flashing out of the group and reappearing somewhere else, because
 * that is literally what happened: two elements, no relationship between them.
 *
 * Flattening is what makes the move animatable. One `<ul>`, one
 * `AnimatePresence`, and a row keyed by its object id — so joining or leaving a
 * group is a *reorder* of a list the row never left, which Motion's `layout`
 * prop animates as a slide. It also ends the duplicate: deleting a group used to
 * render its members twice for the length of the exit, once inside the block on
 * its way out and once in the loose list they had already fallen into.
 *
 * Pure, so the ordering can be tested without a map or a query cache.
 *
 * ## Routes are the second kind of parent, and they own no membership
 *
 * A route is the thing that connects the pins it stops at, so it reads as their
 * parent — but nothing is written to a location to make that true. **The
 * membership is `LineGeometry.route.stops`**, which is already ordered, already
 * what the engine is re-sent, and already what `routeThrough` rewrites. So a
 * route group needs no column, no cleanup when a stop is dropped, and no answer
 * to "what happens when a pin is on two routes" — it is simply on both.
 *
 * That also gives the order for free. The first stop is where the route starts
 * and the last is where it ends, so "which pin do we start from" is a question
 * about the array rather than a field beside it.
 *
 * **A location that is a stop is drawn under its route and nowhere else**, which
 * is what makes the route a group rather than a decoration. A collapsed route
 * hides its stops exactly as a collapsed group hides its members — the count on
 * the row is what says they are there.
 *
 * **One row per location, and that is a rule rather than a tidiness.** The first
 * version left a stop in a group it had also been put in by hand, on the
 * argument that an explicit membership should stay visible. What that produced
 * was two rows for one location — and selection is keyed on the location, so
 * clicking either lit *both*, one of them inside a group the click had nothing
 * to do with. Reported as exactly that: picking a stop also selects the row up
 * in the parent. A location is one thing and gets one row; the group still
 * contains it, one level further in, under the route that put it there.
 *
 * The group's own count follows the same narrowing, so a header never promises
 * more rows than it opens onto.
 */

/** Group ids and object ids come from different tables, so keys are prefixed. */
export type SidebarRow =
  | { kind: "heading"; key: "heading:groups" }
  | {
      kind: "group";
      key: string;
      group: Group;
      /**
       * What it holds, in list order — carried on the row because the header
       * needs both the count and the answer to "is every member selected?", and
       * the partition that knows has already been done by the time this is built.
       */
      places: Place[];
      shapes: Shape[];
      isOpen: boolean;
    }
  | {
      kind: "place";
      key: string;
      place: Place;
      /** The group it resolves to, or "" — which is what a drop on it means. */
      groupId: string;
      /** Set only inside a group: what its pin is actually painted on the map. */
      groupColor?: string;
      indent: boolean;
      /**
       * The last row of its group, so the tree draws an elbow rather than a tee
       * and the rail stops here — see components/ui/tree-branch.tsx. False for
       * every loose row, which has no rail at all.
       */
      isLastInGroup: boolean;
      startsLooseSection: boolean;
    }
  | {
      kind: "shape";
      key: string;
      shape: Shape;
      groupId: string;
      groupColor?: string;
      indent: boolean;
      isLastInGroup: boolean;
      startsLooseSection: boolean;
      /**
       * Its stops, when it is a route. The row draws a disclosure and a count
       * from this; absent is every shape that is not one.
       */
      stops?: RouteStop[];
      /** Whether those stops are currently drawn below it. */
      isOpen?: boolean;
    }
  | {
      kind: "route-stop";
      /**
       * `route:<shapeId>:<index>`, and the index is load-bearing: a stop has no
       * id of its own, and a round trip genuinely visits the same location
       * twice, so two rows on one route can name one place.
       */
      key: string;
      /** The route this is a stop of. */
      shape: Shape;
      /** The whole list, so the row can ask whether this stop may be removed. */
      stops: RouteStop[];
      stopIndex: number;
      /** Undefined for a free waypoint, or a location that has been deleted. */
      place?: Place;
      /**
       * The first row on this route naming this location.
       *
       * The other half of the key above. Selection is keyed on the *location* —
       * a stop has no id to key it on — so on a round trip A→B→C→A the one
       * selected id matches two rows, and pressing Start lit End as well.
       * Reported as exactly that. The row the user pressed wins; with nothing
       * pressed, this is the row that stands for the location, so a marquee or a
       * click on the pin itself lights one row rather than both.
       */
      isFirstVisit: boolean;
      role: "start" | "via" | "end";
      /**
       * The group's rail, passing *over* this row on its way down to the rest of
       * the group's members.
       *
       * Only set for a stop of a route that is itself in a group — the one place
       * in this panel that is two levels deep. `continues` is false when the
       * route was the group's last member: the rail has nothing below to reach,
       * so the level draws a gap of the same width rather than a line to nowhere.
       */
      outerRail?: { color: string; continues: boolean };
      /** The route's own colour as painted on the map, for this row's branch. */
      railColor: string;
      /**
       * What this stop's pin is actually painted, when a group decided it.
       *
       * The sub-group rule seen from the row: a route in a group lends its
       * colour to the pins it stops at, so the swatch here has to be the same
       * answer the canvas paints — `groupColorIndex` is what both ask.
       * Undefined is a stop no group decided, which draws its own pin.
       */
      groupColor?: string;
      isLast: boolean;
    };

export function sidebarRows({
  groups,
  places,
  shapes,
  collapsed,
  expandedRoutes,
  hideEmptyGroups,
}: {
  groups: readonly Group[];
  places: readonly Place[];
  shapes: readonly Shape[];
  /** Group ids the user has folded shut. Their members are left out entirely. */
  collapsed: ReadonlySet<string>;
  /**
   * Shape ids of routes the user has opened.
   *
   * The opposite way round from `collapsed`, because the defaults are opposite.
   * A group opens because the owner made it and its members are what it is for;
   * a route is made by drawing a line, holds up to 25 stops, and lists them on
   * its own card already — so twenty routes open by default is the whole panel
   * buried under stops nobody asked to see.
   */
  expandedRoutes: ReadonlySet<string>;
  /**
   * Leave out groups with nothing in them.
   *
   * True only while one is being created and filled. Making a group is a create
   * followed by a `groupId` PATCH per member, so it legitimately exists empty for
   * about a third of a second — rendered, that is a "Group 1 — 0" that appears
   * and is replaced twice in the space of one gesture. Outside that window
   * nothing is hidden, because an empty group deletes itself
   * (`use-prune-empty-groups.ts`).
   */
  hideEmptyGroups: boolean;
}): SidebarRow[] {
  const groupIds = new Set(groups.map((group) => group.id));

  // The one rule the whole panel rests on lives in here: a `groupId` naming a
  // group that is not in the list reads as ungrouped, which is what puts a
  // deleted group's members back in the loose run with no second round of writes.
  const groupedShapes = groupMembers(shapes, groupIds);

  // The same resolver the canvas paints from, so a stop's rail is a tint of the
  // line it belongs to rather than a second opinion about its colour.
  const colors = groupColorIndex({ groups, shapes });
  const placeById = new Map(places.map((place) => [place.id, place]));

  /*
   * Every location some route stops at.
   *
   * Built once over all the shapes rather than asked per loose place, because
   * the question comes up for every row and the answer is the same each time.
   */
  const onSomeRoute = new Set<string>();
  for (const shape of shapes) {
    for (const stop of routeOf(shape.geometry)?.stops ?? []) {
      if (stop.placeId) onSomeRoute.add(stop.placeId);
    }
  }

  /*
   * Partitioned *after* the stops are taken out, so a group's members and its
   * count are the same list. Narrowing only the loose run would leave a group
   * header counting a row it no longer draws.
   */
  const groupedPlaces = groupMembers(
    places.filter((place) => !onSomeRoute.has(place.id)),
    groupIds,
  );

  const rows: SidebarRow[] = [];

  /** A route's stops, as the rows that sit under it. */
  const stopRows = (
    shape: Shape,
    stops: RouteStop[],
    outerRail?: { color: string; continues: boolean },
  ): SidebarRow[] => {
    /*
     * Locations this route has already been drawn stopping at.
     *
     * Per route rather than across the panel: one location on two routes is two
     * separate parents, and each of them stands for it once.
     */
    const visited = new Set<string>();

    return stops.map((stop, index) => {
      // Asked before this stop joins the set, so the first of two rows naming
      // one location answers true and the second answers false.
      const isFirstVisit = stop.placeId ? !visited.has(stop.placeId) : true;
      if (stop.placeId) visited.add(stop.placeId);

      return {
        kind: "route-stop" as const,
        key: `route:${shape.id}:${String(index)}`,
        shape,
        stops,
        stopIndex: index,
        // Undefined covers both a free waypoint and a bond to a location since
        // deleted. The row renders the gap honestly rather than dropping it —
        // the same dangling-id contract a line's own endpoints have.
        place: stop.placeId ? placeById.get(stop.placeId) : undefined,
        isFirstVisit,
        groupColor: stop.placeId
          ? colors.overrideForPlace(placeById.get(stop.placeId) ?? UNKNOWN_PLACE)
          : undefined,
        role: roleOf(index, stops.length),
        outerRail,
        railColor: colors.forShape(shape),
        isLast: index === stops.length - 1,
      };
    });
  };

  /** The shape's own row, plus its stops when it is an opened route. */
  const shapeBlock = (
    shape: Shape,
    common: {
      groupId: string;
      groupColor?: string;
      indent: boolean;
      isLastInGroup: boolean;
      startsLooseSection: boolean;
    },
    outerRail?: { color: string; continues: boolean },
  ): SidebarRow[] => {
    const stops = routeOf(shape.geometry)?.stops;
    const isOpen = Boolean(stops) && expandedRoutes.has(shape.id);

    return [
      {
        kind: "shape",
        key: `shape:${shape.id}`,
        shape,
        ...common,
        ...(stops ? { stops, isOpen } : {}),
      },
      ...(stops && isOpen ? stopRows(shape, stops, outerRail) : []),
    ];
  };

  const visibleGroups = groups.filter((group) => {
    if (!hideEmptyGroups) return true;

    const count =
      (groupedPlaces.byGroup.get(group.id)?.length ?? 0) +
      (groupedShapes.byGroup.get(group.id)?.length ?? 0);

    return count > 0;
  });

  // Groups first, because a group is a heading for the things below it and a
  // heading underneath its contents is not a heading.
  if (visibleGroups.length > 0) rows.push({ kind: "heading", key: "heading:groups" });

  for (const group of visibleGroups) {
    const groupPlaces = groupedPlaces.byGroup.get(group.id) ?? [];
    const groupShapes = groupedShapes.byGroup.get(group.id) ?? [];
    const isOpen = !collapsed.has(group.id);

    rows.push({
      kind: "group",
      key: `group:${group.id}`,
      group,
      places: groupPlaces,
      shapes: groupShapes,
      isOpen,
    });

    if (!isOpen) continue;

    /*
     * The members are one run, locations then shapes, and only its final row
     * closes the tree. Computed from the two lengths rather than from each loop's
     * index, because a group whose shapes are all that is left of it has its last
     * *place* somewhere in the middle of nothing.
     */
    const lastPlace = groupShapes.length === 0 ? groupPlaces.length - 1 : -1;

    groupPlaces.forEach((place, index) => {
      rows.push({
        kind: "place",
        key: `place:${place.id}`,
        place,
        groupId: group.id,
        groupColor: group.color,
        indent: true,
        isLastInGroup: index === lastPlace,
        startsLooseSection: false,
      });
    });

    groupShapes.forEach((shape, index) => {
      const isLastInGroup = index === groupShapes.length - 1;

      rows.push(
        ...shapeBlock(
          shape,
          {
            groupId: group.id,
            groupColor: group.color,
            indent: true,
            isLastInGroup,
            startsLooseSection: false,
          },
          // The group's rail runs past this route's stops only if the group has
          // more members below them. Shapes come last in a group, so that is
          // exactly "this was not the last shape".
          { color: group.color, continues: !isLastInGroup },
        ),
      );
    });
  }

  /*
   * Everything loose, locations and shapes in one run.
   *
   * Shapes have no heading of their own: a shape's swatch is a circle where a
   * location's is a dot, and its second line reads "Circle · 2.4 km radius", so
   * the heading was labelling something that already had a label — on the panel
   * where vertical space is scarcest.
   *
   * The first of them carries the rule that used to be the Groups section's
   * bottom border. As a flag on a row rather than a wrapper, because a wrapper is
   * exactly the nesting this file exists to remove.
   */
  let isFirstLoose = rows.length > 0;

  for (const place of groupedPlaces.ungrouped) {
    rows.push({
      kind: "place",
      key: `place:${place.id}`,
      place,
      // Not `place.groupId`: a member of a group that has been deleted still
      // names it, and everything here reads that as no group at all.
      groupId: "",
      indent: false,
      isLastInGroup: false,
      startsLooseSection: isFirstLoose,
    });
    isFirstLoose = false;
  }

  for (const shape of groupedShapes.ungrouped) {
    rows.push(
      ...shapeBlock(shape, {
        groupId: "",
        indent: false,
        isLastInGroup: false,
        startsLooseSection: isFirstLoose,
      }),
    );
    isFirstLoose = false;
  }

  return rows;
}

/**
 * A stand-in for a stop whose location has been deleted.
 *
 * `overrideForPlace` reads two fields, and a dangling id resolves through
 * neither — so this asks the question with an id nothing matches rather than
 * branching around it. The answer is undefined, which is a pin drawing its own
 * colour, which is what a row saying "Deleted location" should draw.
 */
const UNKNOWN_PLACE = { id: "", groupId: "" } as Place;

/**
 * Which end of the route this stop is.
 *
 * A two-stop route has a start and an end and no middle, which falls out of the
 * order of these two checks rather than needing a case of its own.
 */
function roleOf(index: number, length: number): "start" | "via" | "end" {
  if (index === 0) return "start";
  return index === length - 1 ? "end" : "via";
}
