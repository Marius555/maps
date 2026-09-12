"use client";

import { toast } from "@heroui/react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { GroupListItem } from "@/components/groups/group-list-item";
import { DeleteGroupDialog } from "@/components/groups/delete-group-dialog";
import { GroupPinDialog } from "@/components/groups/group-pin-dialog";
import { UngroupDialog } from "@/components/groups/ungroup-dialog";
import type { DraggedObject } from "@/components/groups/use-row-drag";
import { DeletePlaceDialog } from "@/components/places/delete-place-dialog";
import { PlaceListItem } from "@/components/places/place-list-item";
import { DeleteShapeDialog } from "@/components/shapes/delete-shape-dialog";
import { ShapeListItem } from "@/components/shapes/shape-list-item";
import { RouteStopListItem } from "@/components/map/routes/route-stop-list-item";
import { dropAction, type DropTargetRow } from "@/lib/map/drop-action";
import { placeIndex } from "@/lib/map/line-endpoints";
import { makeEnd, makeStart, moveStop } from "@/lib/map/route-order";
import { resolvedStops } from "@/lib/map/route-staleness";
import { removeStopAt } from "@/lib/map/route-stops";
import { routeOf } from "@/packages/shared/shapes";
import { sidebarRows, type SidebarRow } from "@/lib/map/sidebar-rows";
import {
  isOptimisticGroupId,
  useDeleteGroup,
  useDeleteGroupContents,
  useSetGroupPin,
} from "@/lib/query/groups";
import { isOptimisticPlaceId, useDeletePlace } from "@/lib/query/places";
import { isOptimisticShapeId, useDeleteShape } from "@/lib/query/shapes";
import { toastError } from "@/lib/query/toast-error";
import { formatCount } from "@/lib/format/number";
import type { Group, MapTagGroup, Place, Shape } from "@/lib/repositories/types";
import { pinColorOfTags } from "@/packages/shared/tags";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { RouteStop } from "@/packages/shared/shapes";

/** The stop row last pressed, and the location it named. */
type PressedStop = { key: string; placeId: string };

/**
 * Whether a selected location lights *this* row of *this* route.
 *
 * A route's stop has no id, so selection is keyed on the location it names — and
 * a round trip names one location twice. Both rows matched, so pressing Start
 * lit End as well, on a panel where lighting a row is how you say "this one".
 *
 * The row the user pressed wins. With nothing pressed — a marquee, a click on
 * the pin itself, a selection made anywhere but here — the location's first
 * visit is the row that stands for it, so exactly one row lights either way.
 *
 * The press is matched on the route as well as the location, because one
 * location can be a stop on two routes and a press on one of them says nothing
 * about the other.
 */
function lightsThisStop(
  row: Extract<SidebarRow, { kind: "route-stop" }>,
  isSelectedPlace: boolean,
  pressed: PressedStop | null,
): boolean {
  if (!row.place || !isSelectedPlace) return false;

  const pressedHere =
    pressed !== null &&
    pressed.placeId === row.place.id &&
    pressed.key.startsWith(`route:${row.shape.id}:`);

  return pressedHere ? pressed.key === row.key : row.isFirstVisit;
}

/**
 * Everything in the Locations panel, as one list.
 *
 * One `<ul>` and one `AnimatePresence` for group headers, group members and
 * loose rows alike. That is the whole point of this component: it used to be a
 * Groups section whose every group rendered its own `PlaceList` and `ShapeList`,
 * with two more lists beside it for the loose rows, so a location's row lived in
 * a different component tree depending on whether it was in a group. Changing
 * `groupId` was therefore an unmount over here and a mount over there — the row
 * flashed out of the group and reappeared below it, and deleting a group drew
 * every member twice for the length of the exit.
 *
 * Flat, a row keeps its key and simply changes place, which is a thing Motion
 * can animate. `lib/map/sidebar-rows.ts` decides the order and the indentation;
 * this file only renders it and owns the dialogs the rows open.
 *
 * The row components are the same ones the Locations *tab* uses, unchanged —
 * a location has to look and behave identically whether it is in a group or not,
 * down to its delete dialog and its pending-address skeleton.
 */
export function LocationsList({
  mapId,
  groups,
  places,
  shapes,
  tagGroups,
  pinIcons,
  selectedPlaceId,
  selectedShapeId,
  selectedPlaceIds,
  selectedShapeIds,
  isGrouping,
  animateMoves,
  pendingAddressIds,
  failedAddressIds,
  onSelectPlace,
  onEditPlace,
  onSelectShape,
  onEditShape,
  onFocusGroup,
  onEditGroup,
  onRetryAddress,
  onRemoveFromGroup,
  onGroupObjects,
  onAddToGroup,
  onMergeGroups,
  onRouteThrough,
}: {
  mapId: string;
  groups: Group[];
  places: Place[];
  shapes: Shape[];
  /** The map's tag vocabulary — a location's first tag colours its pin. */
  tagGroups: MapTagGroup[];
  /** The map's own pins, so a row can draw a `custom:<id>` one. */
  pinIcons: CustomPinIcon[];
  selectedPlaceId: string | null;
  selectedShapeId: string | null;
  /** Locations picked by the marquee or a group — lit like a selected row. */
  selectedPlaceIds: ReadonlySet<string>;
  selectedShapeIds: ReadonlySet<string>;
  /** A group is being created and filled — see sidebarRows. */
  isGrouping: boolean;
  /** Under the size cap, so rows travel rather than blink — see listRowMotion. */
  animateMoves: boolean;
  /** Locations still waiting on a reverse geocode. */
  pendingAddressIds?: ReadonlySet<string>;
  /** Locations whose reverse geocode came back with nothing. */
  failedAddressIds?: ReadonlySet<string>;
  onSelectPlace: (placeId: string) => void;
  onEditPlace: (placeId: string) => void;
  onSelectShape: (shapeId: string) => void;
  onEditShape: (shapeId: string) => void;
  /** Select the whole group and frame it on the map. */
  onFocusGroup: (groupId: string) => void;
  onEditGroup: (groupId: string) => void;
  onRetryAddress?: (placeId: string) => void;
  /** Take one object out of whatever group it is in. */
  onRemoveFromGroup: (object: DraggedObject) => void;
  /** Two loose rows met: make a group holding both. */
  onGroupObjects: (target: DraggedObject, dragged: DraggedObject) => void;
  /** A row was dropped on something already in a group: join that group. */
  onAddToGroup: (groupId: string, dragged: DraggedObject) => void;
  /** A group was dropped on another: everything in the source moves to the target. */
  onMergeGroups: (targetGroupId: string, sourceGroupId: string) => void;
  /**
   * Ask the routing engine for a route through these stops and save it.
   *
   * The one path every reordering gesture in this panel goes through, and the
   * same one the route's card uses for Recalculate and its × — lifted to
   * `map-editor.tsx` so the sidebar and the canvas cannot drift on the profile.
   */
  onRouteThrough: (shapeId: string, stops: readonly RouteStop[]) => void;
}) {
  /*
   * Open by default, and remembered per group only while the editor is on
   * screen. A collapsed group is a way to get a long sidebar back under control,
   * not a preference worth a column in the database.
   */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  /*
   * Shut by default, which is the opposite of a group — see `sidebarRows`.
   * Remembered for as long as the editor is on screen, on the same terms.
   */
  const [expandedRoutes, setExpandedRoutes] = useState<ReadonlySet<string>>(
    new Set(),
  );
  /*
   * The stop row the user last pressed, or null.
   *
   * Selection is keyed on the location, and a round trip names one location
   * twice — so the id alone cannot say which of the two rows was pressed. This
   * is the tie-break, and only that: it never selects anything on its own, and
   * with nothing pressed the row standing for the location is its first visit.
   *
   * The location comes with the key so a stale press needs no clearing. Select
   * anything else and the id stops matching, which is already "ignore this".
   */
  const [pressedStop, setPressedStop] = useState<PressedStop | null>(null);

  /*
   * Routes already on the map when this panel mounted.
   *
   * Seeded on the first run so they keep the shut-by-default above; a route that
   * appears *after* it is one that was just drawn, and opens itself.
   */
  const knownShapeIds = useRef<Set<string> | null>(null);

  /**
   * A route opens the moment it is drawn.
   *
   * Drawing one takes its stops out of the loose run and out of any group they
   * were in — one row per location, see `sidebarRows` — so connecting five pins
   * with the route shut removes five rows from the panel and puts "· 5 stops" on
   * a row that is folded. Reported as the pins having been deleted, which is
   * exactly what it looks like. Opening it makes the same change read as a move:
   * the rows go under the route, where they now live.
   *
   * Only on the way in. Reasserting it would fight the chevron, and a route the
   * owner folded is one they folded.
   */
  useEffect(() => {
    const ids = new Set(shapes.map((shape) => shape.id));

    if (knownShapeIds.current === null) {
      knownShapeIds.current = ids;
      return;
    }

    const known = knownShapeIds.current;
    const opened = shapes.filter(
      (shape) => !known.has(shape.id) && routeOf(shape.geometry),
    );

    // Replaced rather than added to: an optimistic shape id is swapped for the
    // server's on success, and a set that only grows would hold every temporary
    // id the session ever minted.
    knownShapeIds.current = ids;

    setExpandedRoutes((current) => {
      // Narrowed to what still exists as well as widened by what just arrived,
      // for the same reason: a drawn route is in here twice for a moment, under
      // its temporary id and then its real one, and a deleted one forever.
      const next = new Set<string>();
      for (const id of current) if (ids.has(id)) next.add(id);
      for (const shape of opened) next.add(shape.id);

      // The array identity changes on every refetch, so an unconditional write
      // here would be a render per poll.
      const isSame =
        next.size === current.size && [...next].every((id) => current.has(id));

      return isSame ? current : next;
    });
  }, [shapes]);

  const ungroup = useDeleteGroup(mapId);
  const deleteGroupContents = useDeleteGroupContents(mapId);
  const setGroupPin = useSetGroupPin(mapId);
  const deletePlace = useDeletePlace(mapId);
  const deleteShape = useDeleteShape(mapId);

  const [pendingUngroupId, setPendingUngroupId] = useState<string | null>(null);
  const [pinGroupId, setPinGroupId] = useState<string | null>(null);
  const [pendingDeleteGroupId, setPendingDeleteGroupId] = useState<string | null>(
    null,
  );
  const [pendingDeletePlaceId, setPendingDeletePlaceId] = useState<string | null>(
    null,
  );
  const [pendingDeleteShapeId, setPendingDeleteShapeId] = useState<string | null>(
    null,
  );

  const rows = sidebarRows({
    groups,
    places,
    shapes,
    collapsed,
    expandedRoutes,
    hideEmptyGroups: isGrouping,
  });

  // Looked up rather than stored, so a dialog can't hold a stale copy of a row
  // that has since been renamed elsewhere.
  const pendingUngroup = groups.find((g) => g.id === pendingUngroupId) ?? null;
  const pinGroup = groups.find((g) => g.id === pinGroupId) ?? null;
  // Counted from the live array rather than carried in state, so a location
  // dragged into the group while the dialog is open is included in what it says.
  const pinGroupPlaces = places.filter(
    (place) => place.groupId === pinGroupId,
  ).length;
  const pendingDeleteGroup =
    groups.find((g) => g.id === pendingDeleteGroupId) ?? null;
  // Counted live for the same reason the pin dialog's count is: what the
  // sentence promises and what the request deletes have to be the same set, even
  // if something is dragged in while the dialog is open.
  const pendingDeleteGroupPlaces = places.filter(
    (place) => place.groupId === pendingDeleteGroupId,
  ).length;
  const pendingDeleteGroupShapes = shapes.filter(
    (shape) => shape.groupId === pendingDeleteGroupId,
  ).length;
  const pendingDeletePlace =
    places.find((place) => place.id === pendingDeletePlaceId) ?? null;
  const pendingDeleteShape =
    shapes.find((shape) => shape.id === pendingDeleteShapeId) ?? null;

  const toggle = (groupId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(groupId)) next.add(groupId);
      return next;
    });

  const toggleRoute = (shapeId: string) =>
    setExpandedRoutes((current) => {
      const next = new Set(current);
      if (!next.delete(shapeId)) next.add(shapeId);
      return next;
    });

  /**
   * Ask the engine again, through whichever reordering rule was pressed.
   *
   * **Resolved first.** The stops go back at the positions their pins are at
   * *now* rather than where the engine last drew them, exactly as dropping a
   * stop from the route's card does — reordering a route that had also gone
   * stale must not quietly re-commit the stale coordinates.
   *
   * `null` from the rule means the move changes nothing, and nothing is what
   * happens: every one of these would otherwise be a metered request for the
   * geometry already on screen (CLAUDE.md §12). See lib/map/route-order.ts.
   */
  const reroute = (
    shape: Shape,
    rule: (stops: readonly RouteStop[]) => RouteStop[] | null,
  ) => {
    if (shape.geometry.kind !== "line") return;

    const next = rule(resolvedStops(shape.geometry, placeIndex(places)));
    if (next) onRouteThrough(shape.id, next);
  };

  /**
   * The group a dragged object is currently in, or "".
   *
   * The decision needs it and the payload does not carry it — a `DraggedObject`
   * is a kind and an id, because anything more would be a copy of a row that can
   * be renamed or regrouped while the pointer is still down. Same
   * missing-group-reads-as-ungrouped rule the rest of the panel follows.
   */
  const groupOf = (dragged: DraggedObject): string => {
    if (dragged.type === "group") return "";

    const object =
      dragged.type === "place"
        ? places.find((place) => place.id === dragged.id)
        : shapes.find((shape) => shape.id === dragged.id);

    const groupId = object?.groupId ?? "";

    return groups.some((group) => group.id === groupId) ? groupId : "";
  };

  /**
   * What a drop on a row means — see lib/map/drop-action.ts for the table.
   *
   * This component asks the question and performs the answer; it does not decide
   * it. Seven cases with two kinds of thing in the hand is not something to read
   * inside a `map` callback, and none of it needs a map or a query cache to be
   * tested.
   */
  const drop = (target: DropTargetRow, dragged: DraggedObject) => {
    const action = dropAction(dragged, target, groupOf(dragged));
    if (!action) return;

    if (action.kind === "join") {
      onAddToGroup(action.groupId, action.object);
      return;
    }

    if (action.kind === "merge") {
      onMergeGroups(action.targetGroupId, action.sourceGroupId);
      return;
    }

    onGroupObjects(action.objects[0], action.objects[1]);
  };

  /** Whether a row would do anything at all with what is in the air. */
  const accepts = (target: DropTargetRow) => (dragged: DraggedObject) =>
    dropAction(dragged, target, groupOf(dragged)) !== null;

  return (
    <>
      {/*
       * `initial={false}` so opening a map with 300 locations doesn't animate all
       * 300 in — only rows that appear *after* the list is on screen, which is
       * exactly the set the user did something to.
       */}
      <ul>
        <AnimatePresence initial={false}>
          {rows.map((row) => {
            if (row.kind === "heading") {
              return (
                <li key={row.key} className="px-2 py-1.5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Groups
                  </h3>
                </li>
              );
            }

            if (row.kind === "group") {
              const { group } = row;
              const count = row.places.length + row.shapes.length;

              /*
               * Lit when every one of its members is in the current selection —
               * which is what clicking its header does. A group that merely
               * overlaps a marquee is not "the selected group", and saying it
               * was would make the highlight meaningless.
               */
              const isSelected =
                count > 0 &&
                row.places.every((place) => selectedPlaceIds.has(place.id)) &&
                row.shapes.every((shape) => selectedShapeIds.has(shape.id));

              const target: DropTargetRow = { kind: "group", groupId: group.id };

              return (
                <GroupListItem
                  key={row.key}
                  group={group}
                  count={count}
                  isOpen={row.isOpen}
                  isSelected={isSelected}
                  animateMoves={animateMoves}
                  /* A group that exists only in the cache has no id the server
                     would recognise, so it cannot be merged into anything yet.
                     It is real a moment later. */
                  canDrag={!isOptimisticGroupId(group.id)}
                  onToggle={() => toggle(group.id)}
                  onFocus={() => onFocusGroup(group.id)}
                  onEdit={() => onEditGroup(group.id)}
                  hasPlaces={row.places.length > 0}
                  onChangePins={() => {
                    // Same guard as Ungroup: a group still in flight has no id
                    // the server would recognise.
                    if (isOptimisticGroupId(group.id)) return;
                    setPinGroupId(group.id);
                  }}
                  onUngroup={() => {
                    if (isOptimisticGroupId(group.id)) return;
                    setPendingUngroupId(group.id);
                  }}
                  onDelete={() => {
                    if (isOptimisticGroupId(group.id)) return;
                    setPendingDeleteGroupId(group.id);
                  }}
                  onDropObject={(dragged) => drop(target, dragged)}
                  acceptsDrop={accepts(target)}
                />
              );
            }

            if (row.kind === "place") {
              const { place } = row;
              const target: DropTargetRow = {
                kind: "object",
                object: { type: "place", id: place.id },
                groupId: row.groupId,
              };

              return (
                <PlaceListItem
                  key={row.key}
                  place={place}
                  pinColor={pinColorOfTags(tagGroups, place.tags)}
                  pinIcons={pinIcons}
                  groupColor={row.groupColor}
                  isSelected={
                    place.id === selectedPlaceId || selectedPlaceIds.has(place.id)
                  }
                  indent={row.indent}
                  isLastInGroup={row.isLastInGroup}
                  startsLooseSection={row.startsLooseSection}
                  animateMoves={animateMoves}
                  canDrag
                  /*
                   * Two windows, one skeleton. The temporary id covers the row
                   * that exists only in the cache while its create is in flight;
                   * the set covers the reverse geocode that runs once it is real.
                   */
                  isAddressPending={
                    isOptimisticPlaceId(place.id) ||
                    (pendingAddressIds?.has(place.id) ?? false)
                  }
                  hasAddressFailed={failedAddressIds?.has(place.id) ?? false}
                  onSelect={() => onSelectPlace(place.id)}
                  onEdit={() => onEditPlace(place.id)}
                  onDelete={() => setPendingDeletePlaceId(place.id)}
                  onRetryAddress={
                    onRetryAddress ? () => onRetryAddress(place.id) : undefined
                  }
                  // Only offered where there is a group to leave.
                  onRemoveFromGroup={
                    row.groupId
                      ? () => onRemoveFromGroup({ type: "place", id: place.id })
                      : undefined
                  }
                  onDropObject={(dragged) => drop(target, dragged)}
                  acceptsDrop={accepts(target)}
                />
              );
            }

            if (row.kind === "route-stop") {
              const { shape, stopIndex } = row;

              return (
                <RouteStopListItem
                  key={row.key}
                  routeId={shape.id}
                  routeName={shape.name}
                  stops={row.stops}
                  stopIndex={stopIndex}
                  place={row.place}
                  role={row.role}
                  railColor={row.railColor}
                  outerRail={row.outerRail}
                  isLast={row.isLast}
                  isSelected={lightsThisStop(
                    row,
                    row.place !== undefined &&
                      (row.place.id === selectedPlaceId ||
                        selectedPlaceIds.has(row.place.id)),
                    pressedStop,
                  )}
                  pinIcons={pinIcons}
                  groupColor={row.groupColor}
                  pinColor={
                    row.place
                      ? pinColorOfTags(tagGroups, row.place.tags)
                      : undefined
                  }
                  // Same two windows a loose row uses, so a stop whose lookup is
                  // still out waits as a skeleton rather than flashing the
                  // placeholder name it is about to lose.
                  isAddressPending={
                    row.place
                      ? isOptimisticPlaceId(row.place.id) ||
                        (pendingAddressIds?.has(row.place.id) ?? false)
                      : false
                  }
                  hasAddressFailed={
                    row.place
                      ? (failedAddressIds?.has(row.place.id) ?? false)
                      : false
                  }
                  animateMoves={animateMoves}
                  onSelect={() => {
                    if (!row.place) return;
                    setPressedStop({ key: row.key, placeId: row.place.id });
                    onSelectPlace(row.place.id);
                  }}
                  onMove={(insertBefore) =>
                    reroute(shape, (stops) =>
                      moveStop(stops, stopIndex, insertBefore),
                    )
                  }
                  onMakeStart={() =>
                    reroute(shape, (stops) => makeStart(stops, stopIndex))
                  }
                  onMakeEnd={() =>
                    reroute(shape, (stops) => makeEnd(stops, stopIndex))
                  }
                  onRemove={() =>
                    reroute(shape, (stops) => removeStopAt(stops, stopIndex))
                  }
                />
              );
            }
            const { shape } = row;
            const target: DropTargetRow = {
              kind: "object",
              object: { type: "shape", id: shape.id },
              groupId: row.groupId,
            };

            return (
              <ShapeListItem
                key={row.key}
                shape={shape}
                groupColor={row.groupColor}
                isSelected={
                  shape.id === selectedShapeId || selectedShapeIds.has(shape.id)
                }
                stopCount={row.stops?.length}
                isOpen={row.isOpen}
                onToggle={row.stops ? () => toggleRoute(shape.id) : undefined}
                indent={row.indent}
                isLastInGroup={row.isLastInGroup}
                startsLooseSection={row.startsLooseSection}
                animateMoves={animateMoves}
                canDrag
                onSelect={() => onSelectShape(shape.id)}
                onEdit={() => onEditShape(shape.id)}
                onDelete={() => {
                  // A row that exists only in the cache has no id the server
                  // would recognise. It is gone in a moment either way.
                  if (isOptimisticShapeId(shape.id)) return;
                  setPendingDeleteShapeId(shape.id);
                }}
                onRemoveFromGroup={
                  row.groupId
                    ? () => onRemoveFromGroup({ type: "shape", id: shape.id })
                    : undefined
                }
                onDropObject={(dragged) => drop(target, dragged)}
                acceptsDrop={accepts(target)}
              />
            );
          })}
        </AnimatePresence>
      </ul>

      <UngroupDialog
        group={pendingUngroup}
        onClose={() => setPendingUngroupId(null)}
        onConfirm={() => {
          if (!pendingUngroupId) return;

          /*
           * Closed first, and fired rather than awaited.
           *
           * The mutation removes the group from the cache in `onMutate`, so the
           * members are already back in the loose run by the time the request
           * leaves. Waiting for the reply meant the dialog sat there spinning
           * over a panel that had finished changing — the user saw a pause and
           * then an empty space, never the rows travelling out of the group,
           * which is the one thing the confirmation was about.
           */
          setPendingUngroupId(null);
          ungroup.mutate(pendingUngroupId, {
            onError: (error) => toastError(error, "Couldn't ungroup"),
          });
        }}
      />

      <DeleteGroupDialog
        group={pendingDeleteGroup}
        places={pendingDeleteGroupPlaces}
        shapes={pendingDeleteGroupShapes}
        isDeleting={deleteGroupContents.isPending}
        error={deleteGroupContents.error}
        onClose={() => setPendingDeleteGroupId(null)}
        onConfirm={() => {
          if (!pendingDeleteGroupId) return;

          /*
           * Awaited, unlike Ungroup beside it — the asymmetry is deliberate.
           *
           * Ungroup closes first because its whole story is the rows travelling
           * back out into the loose run, and a spinner would cover the only
           * thing worth watching. This destroys them. If the request fails the
           * user has to be told *here*, over the button they pressed, rather
           * than by a toast arriving after a dialog has already closed on what
           * looked like a successful delete — which is why this one has an
           * inline error and a pending state at all.
           */
          deleteGroupContents.mutate(pendingDeleteGroupId, {
            onSuccess: () => setPendingDeleteGroupId(null),
          });
        }}
      />

      <GroupPinDialog
        group={pinGroup}
        places={pinGroupPlaces}
        pinIcons={pinIcons}
        onClose={() => setPinGroupId(null)}
        onConfirm={(icon) => {
          if (!pinGroupId) return;

          /*
           * Closed first and fired rather than awaited, for the same reason as
           * Ungroup above: the mutation repaints every marker in `onMutate`, so
           * holding the dialog open over a canvas that has finished changing
           * would hide the one thing the user pressed the button to see.
           */
          setPinGroupId(null);

          setGroupPin.mutate(
            { groupId: pinGroupId, icon },
            {
              // The action keeps its name from the menu item through to here,
              // and the count is the server's rather than the one this page had
              // cached — the endpoint answers with the rows it actually wrote.
              onSuccess: (changed) =>
                toast.success("Pins changed", {
                  description: `${formatCount(changed)} ${
                    changed === 1 ? "location" : "locations"
                  } updated.`,
                }),
              onError: (error) => toastError(error, "Couldn't change the pins"),
            },
          );
        }}
      />

      <DeletePlaceDialog
        place={pendingDeletePlace}
        isDeleting={deletePlace.isPending}
        error={deletePlace.error}
        onClose={() => setPendingDeletePlaceId(null)}
        onConfirm={async () => {
          if (!pendingDeletePlaceId) return;

          await deletePlace.mutateAsync(pendingDeletePlaceId);
          setPendingDeletePlaceId(null);
        }}
      />

      <DeleteShapeDialog
        shape={pendingDeleteShape}
        isDeleting={deleteShape.isPending}
        error={deleteShape.error}
        onClose={() => setPendingDeleteShapeId(null)}
        onConfirm={async () => {
          if (!pendingDeleteShapeId) return;

          await deleteShape.mutateAsync(pendingDeleteShapeId);
          setPendingDeleteShapeId(null);
        }}
      />
    </>
  );
}
