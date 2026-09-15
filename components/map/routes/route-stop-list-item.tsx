"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  NO_DRAG_PROPS,
  useDropTarget,
  useRowDragSource,
  type DraggedObject,
} from "@/components/groups/use-row-drag";
import { PinPreview } from "@/components/map/pin-preview";
import { PlaceRowLabel } from "@/components/places/place-row-label";
import {
  insertLineMotion,
  LIST_ROW_CLASS,
  LIST_ROW_SURFACE_CLASS,
  listRowMotion,
} from "@/components/ui/list-row-motion";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { TreeBranch, TreeRail } from "@/components/ui/tree-branch";
import { moveStop } from "@/lib/map/route-order";
import { canRemoveStop } from "@/lib/map/route-stops";
import type { Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { RouteStop } from "@/packages/shared/shapes";

/**
 * One stop of a route, as a row under the route in the Locations panel.
 *
 * **A route is the parent of the pins it connects, and its stop list is the
 * membership** — see `lib/map/sidebar-rows.ts`. So this row is not a location
 * row that happens to be indented: the same location can appear on it twice (a
 * round trip visits one place at both ends), it cannot be removed "from a
 * group", and its position in the list is the thing being edited rather than a
 * consequence of one.
 *
 * That is why it is a row kind of its own rather than a `PlaceListItem` with
 * different props. `place-list-item.tsx` is keyed on the location and offers
 * Edit and Delete; two rows for one location would collide on the key, and
 * "Delete" under a stop would mean the location itself, not the stop.
 *
 * **Edit is the exception, and it took a bug report to notice.** That argument
 * is about Delete and always was — but a stop row is this location's *only*
 * row in the panel (`one row per location`, lib/map/sidebar-rows.ts), so
 * leaving Edit out of it meant a pin on a route could not be edited from the
 * list at all, by any route. It is here now, spelled "Edit location" so it
 * cannot be read as editing the route, and only for a stop that resolves to
 * one.
 *
 * **Order is the route.** The stops are the only part of a route anybody
 * decided — the hundreds of points between them came from an engine — so moving
 * one is a different question to ask, and every gesture here goes back through
 * the engine. `lib/map/route-order.ts` holds the rules and returns null for a
 * move that changes nothing, which is what stops a drop back where it started
 * spending a metered request.
 *
 * **Four move items, not two, and the drag as well.** The menu used to offer
 * only the two ends, on the reasoning that a relative move is what the drag
 * between rows is for. That reasoning assumed the drag was reachable; on touch
 * it is a learned gesture behind a still hold (components/groups/use-row-drag.ts),
 * so a phone had the two absolute moves and nothing in between. Every one of
 * the four now asks `moveStop` whether it would change anything, rather than
 * asking the index — see the comment over `canMove`.
 *
 * **The row itself takes a drop too, and it means "group with this route".**
 * It did not for a long time, and the gap was invisible: the bands below accept
 * nothing but a stop of this same route, so dragging a *route* onto one of
 * another route's stop rows silently did nothing and the drop had to land on
 * the route's own 48px header row. On a phone, where the panel shows a handful
 * of rows and an open route fills most of them, that is the row you are most
 * likely to be over. It follows `dropAction`'s own sentence — dropping onto
 * something means joining whatever that something belongs to — and a stop
 * belongs to its route, so this target is the one the route's header already
 * publishes. The bands still win for a stop, because a target that refuses the
 * payload is skipped rather than allowed to swallow the drop.
 *
 * **Two drop bands, not one drop target.** The shared gesture
 * (`components/groups/use-row-drag.ts`) hit-tests with `elementFromPoint` and
 * hands a target only the payload — there is no "which half of the row" in that
 * contract, and adding one would change a file the card designer shares. Two
 * absolutely-positioned halves, each its own registered target, answer the same
 * question with no change to it at all. They are `pointer-events: none` until a
 * stop of *this* route is in the air, so they never sit between the pointer and
 * the row's own button.
 */
export function RouteStopListItem({
  routeId,
  routeName,
  stops,
  stopIndex,
  place,
  role,
  railColor,
  outerRail,
  isLast,
  isSelected,
  pinIcons,
  groupColor,
  pinColor,
  isAddressPending,
  hasAddressFailed,
  animateMoves = false,
  onDropObject,
  acceptsDrop,
  onSelect,
  onEdit,
  onMove,
  onMakeStart,
  onMakeEnd,
  onRemove,
}: {
  routeId: string;
  /** For the menu's accessible name — "Actions for Warehouse on Northern run". */
  routeName: string;
  /** The whole list, so a move can be tested before it is offered. */
  stops: readonly RouteStop[];
  stopIndex: number;
  /** Undefined for a free waypoint, or a location that has been deleted. */
  place?: Place;
  role: "start" | "via" | "end";
  /** The route's own colour as painted on the map — the rail is a tint of it. */
  railColor: string;
  /** The group's rail passing over this row, when the route is in a group. */
  outerRail?: { color: string; continues: boolean };
  isLast: boolean;
  isSelected: boolean;
  pinIcons: CustomPinIcon[];
  /**
   * The colour a group decided for this pin, when one did.
   *
   * The sub-group rule: a route in a group lends its colour to the pins it
   * stops at, and this row has to draw the same answer the canvas paints. It
   * beats the pin's own colour, exactly as it does on a grouped location's
   * row.
   */
  groupColor?: string;
  /** Its own first-tag colour, used only when no group decided. */
  pinColor?: string;
  /** Its reverse geocode is still out — see PlaceRowLabel. */
  isAddressPending?: boolean;
  /** That lookup came back with nothing, and the row has to say so. */
  hasAddressFailed?: boolean;
  animateMoves?: boolean;
  /**
   * Another row was dropped on this one — which means its route, not this stop.
   * Omit and the row is not a target; the bands below are unaffected either way.
   */
  onDropObject?: (dragged: DraggedObject) => void;
  /** Whether the route would do anything with what is in the air. */
  acceptsDrop?: (dragged: DraggedObject) => boolean;
  onSelect: () => void;
  /**
   * Edit the location this stop resolves to.
   *
   * Omitted for a free waypoint and for a stop whose location has been deleted
   * — there is no row behind either to open a form on. The menu item follows
   * it, which is why this is the prop rather than a flag: a caller that cannot
   * answer the question does not pass one.
   */
  onEdit?: () => void;
  /** Put this stop before the one currently at `insertBefore`. */
  onMove: (insertBefore: number) => void;
  onMakeStart: () => void;
  onMakeEnd: () => void;
  onRemove: () => void;
}) {
  const { isDraggable, rowProps } = useRowDragSource({
    self: { type: "route-stop", id: `${routeId}:${String(stopIndex)}` },
    // A two-stop route can still be reversed, so every stop of every route is
    // draggable. `accepts` below is what refuses the drops that mean nothing.
    canDrag: true,
  });

  /** A drop that would actually reorder this route, and not any other. */
  const accepts = (dragged: DraggedObject, insertBefore: number) => {
    if (dragged.type !== "route-stop") return false;

    const [draggedRouteId, index] = splitStopId(dragged.id);
    if (draggedRouteId !== routeId) return false;

    return moveStop(stops, index, insertBefore) !== null;
  };

  const before = useDropTarget({
    id: `route-stop:${routeId}:${String(stopIndex)}:before`,
    accepts: (dragged) => accepts(dragged, stopIndex),
    onDrop: () => onMove(stopIndex),
  });

  const after = useDropTarget({
    id: `route-stop:${routeId}:${String(stopIndex)}:after`,
    accepts: (dragged) => accepts(dragged, stopIndex + 1),
    onDrop: () => onMove(stopIndex + 1),
  });

  /*
   * The whole row, standing in for its route — see the docblock.
   *
   * A third id rather than reusing the route's own, because `useDropTarget`
   * keys a registry: two elements registering `shape:<id>` would be one
   * overwriting the other, and an open route has up to 25 rows that would all
   * try.
   */
  const row = useDropTarget({
    id: `route-stop-row:${routeId}:${String(stopIndex)}`,
    accepts: acceptsDrop ?? (() => false),
    onDrop: onDropObject,
  });

  /*
   * What the menu calls this row, and the whole of what the row says when the
   * bond is dangling.
   *
   * A resolved stop draws `PlaceRowLabel` below, the same two lines every other
   * location row in this panel draws. It used to draw `place.name` on its own,
   * and for a pin dropped on the map that name is "Location 9" — the
   * placeholder `lib/places/place-labels.ts` exists to keep off a row, showing
   * up on the one row that had not been taught about it. The same location read
   * as its address in the loose list and as "Location 9" under a route.
   */
  const label = place
    ? place.address || place.name
    : stops[stopIndex]?.placeId
      ? "Deleted location"
      : "Waypoint";

  const items: RowMenuItem[] = [];

  /*
   * The location, not the stop — which is why the label says so.
   *
   * This row is the *only* row that location has in the panel (`one row per
   * location`, lib/map/sidebar-rows.ts), so without this item a pin on a route
   * had no way to be edited from the list at all. The docblock above argues
   * Delete away, and rightly: "Delete" under a stop would ambiguously mean the
   * location itself. It never argued Edit away — that was collateral.
   *
   * Plain "Edit" belongs to the *route*, on `ShapeListItem` one row up, so this
   * one is spelled out to say which of the two it opens.
   */
  if (onEdit) {
    items.push({
      id: "edit",
      label: "Edit location",
      icon: Pencil,
      onAction: onEdit,
    });
  }

  /*
   * The four moves, each offered only where it would change the route.
   *
   * **Asked of `moveStop`, never of the index**, and that is the part worth
   * keeping. The two absolute items used to be gated on `stopIndex !== 0` and
   * `stopIndex !== stops.length - 1`, which is the same answer as `moveStop`
   * for a plain out-and-back and the wrong one for a round trip: on A→B→A,
   * "Make this the start" at the last stop builds [A,A,B], `collapseRepeats`
   * folds it to [A,B], and the item silently turned somebody's loop into a
   * one-way trip. `moveStop` has always returned null for that (see `settle`
   * in lib/map/route-order.ts); nothing was asking it.
   *
   * Relative before absolute, because that is the order they read in: one step
   * is the common edit and the two ends are the decisions.
   */
  const canMove = (insertBefore: number) =>
    moveStop(stops, stopIndex, insertBefore) !== null;

  // `stopIndex - 1` and `stopIndex + 2`: `insertBefore` indexes the list as it
  // is now, so "one further down" is past the stop's own row *and* the one
  // below it. `moveStop` compensates for the hole the removal leaves.
  if (canMove(stopIndex - 1)) {
    items.push({
      id: "up",
      label: "Move up",
      icon: ChevronUp,
      onAction: () => onMove(stopIndex - 1),
    });
  }

  if (canMove(stopIndex + 2)) {
    items.push({
      id: "down",
      label: "Move down",
      icon: ChevronDown,
      onAction: () => onMove(stopIndex + 2),
    });
  }

  if (canMove(0)) {
    items.push({
      id: "start",
      label: "Make this the start",
      icon: ArrowUpToLine,
      onAction: onMakeStart,
    });
  }

  if (canMove(stops.length)) {
    items.push({
      id: "end",
      label: "Make this the end",
      icon: ArrowDownToLine,
      onAction: onMakeEnd,
    });
  }

  // Asked per row, because the answer differs between rows of one route: two
  // stops is the floor, and on a round trip A→B→A the middle stop cannot come
  // out either, since what it would leave is a journey from a place to itself.
  if (canRemoveStop(stops, stopIndex)) {
    items.push({
      id: "remove",
      label: "Remove from route",
      icon: X,
      isDanger: true,
      onAction: onRemove,
    });
  }

  return (
    <motion.li
      {...listRowMotion(animateMoves)}
      className={`${LIST_ROW_CLASS} ms-4 flex`}
    >
      {outerRail ? (
        <TreeRail color={outerRail.color} continues={outerRail.continues} />
      ) : null}

      <TreeBranch color={railColor} isLast={isLast} />

      {/* `relative` so the two drop bands below can cover it. The row proper is
          this div and not the `li`, for `PlaceListItem`'s reason. */}
      <div
        data-selected={isSelected || undefined}
        {...row.targetProps}
        {...rowProps}
        className={`${LIST_ROW_SURFACE_CLASS} relative min-w-0 flex-1${
          isDraggable ? " is-draggable" : ""
        }`}
      >
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
          aria-current={isSelected ? "true" : undefined}
          // The skeleton below is decorative, so the row would otherwise be a
          // button with no name at all for the second the lookup takes.
          aria-label={isAddressPending ? "Finding this address" : undefined}
          onClick={onSelect}
        >
          <PinPreview
            icon={place?.icon ?? ""}
            pinIcons={pinIcons}
            color={groupColor}
            fallbackColor={pinColor}
            size="sm"
            className="shrink-0"
          />

          {/* Not `flex-1`: the Start/End chip belongs beside the name rather
              than out at the row's right edge, where it would read as a control.
              A dangling stop keeps its one muted line — there is no location to
              ask for a second one. */}
          {place ? (
            <span className="flex min-w-0 flex-col justify-center">
              <PlaceRowLabel
                place={place}
                isPending={Boolean(isAddressPending)}
                hasFailed={Boolean(hasAddressFailed)}
              />
            </span>
          ) : (
            <span className="truncate text-sm text-muted italic">{label}</span>
          )}

          {/* The two ends say so in words. "Stop 3 of 7" for the middle would be
              a number nobody acts on, and the order of the rows already says it. */}
          {role === "via" ? null : (
            <span className="shrink-0 rounded-md bg-default px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide text-muted uppercase">
              {role === "start" ? "Start" : "End"}
            </span>
          )}
        </button>

        {/* `NO_DRAG_PROPS` stops a press on the menu from also picking the row
            up — see useRowDragSource. */}
        <div className="shrink-0" {...NO_DRAG_PROPS}>
          <RowMenu label={`Actions for ${label} on ${routeName}`} items={items} />
        </div>

        {/* Declared last so they sit over the button, and inert until a stop of
            this route is in the air — `elementFromPoint` looks straight through
            a `pointer-events: none` element to the row underneath. */}
        <DropBand
          edge="top"
          isActive={before.isCandidate}
          isTarget={before.isTarget}
          targetProps={before.targetProps}
        />
        <DropBand
          edge="bottom"
          isActive={after.isCandidate}
          isTarget={after.isTarget}
          targetProps={after.targetProps}
        />
      </div>
    </motion.li>
  );
}

/**
 * Half of a row, as somewhere to drop a stop.
 *
 * The line is drawn on the band's own outer edge rather than in the middle of
 * it, because what it means is "the stop goes here" — between two rows — and a
 * mark floating in the middle of a row reads as "onto this row", which is the
 * gesture this panel already uses for joining a group.
 */
function DropBand({
  edge,
  isActive,
  isTarget,
  targetProps,
}: {
  edge: "top" | "bottom";
  /** A stop of this route is in the air: the band becomes hit-testable. */
  isActive: boolean;
  isTarget: boolean;
  targetProps: Record<string, string | boolean | undefined>;
}) {
  return (
    <span
      {...targetProps}
      className={`absolute inset-x-0 h-1/2 ${edge === "top" ? "top-0" : "bottom-0"} ${
        isActive ? "" : "pointer-events-none"
      }`}
    >
      {/* The line grows out of its own centre rather than appearing — see
          `insertLineMotion`. `AnimatePresence` is what gives it an exit at all:
          the band stops being the target the instant the pointer leaves it, and
          a bare conditional would take the mark with it in the same frame. */}
      <AnimatePresence>
        {isTarget ? (
          <motion.span
            {...insertLineMotion()}
            aria-hidden="true"
            className={`absolute inset-x-1 h-0.5 rounded-full bg-accent ${
              edge === "top" ? "top-0" : "bottom-0"
            }`}
          />
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** `<routeId>:<index>` back into its two halves. */
function splitStopId(id: string): [string, number] {
  const at = id.lastIndexOf(":");
  return [id.slice(0, at), Number(id.slice(at + 1))];
}
