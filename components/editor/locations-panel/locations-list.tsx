"use client";

import { toast } from "@heroui/react";
import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { GroupListItem } from "@/components/groups/group-list-item";
import { DeleteGroupDialog } from "@/components/groups/delete-group-dialog";
import { GroupPinDialog } from "@/components/groups/group-pin-dialog";
import { UngroupDialog } from "@/components/groups/ungroup-dialog";
import type { DraggedObject } from "@/components/groups/use-row-drag";
import { DeletePlaceDialog } from "@/components/places/delete-place-dialog";
import { PlaceListItem } from "@/components/places/place-list-item";
import { DeleteShapeDialog } from "@/components/shapes/delete-shape-dialog";
import { ShapeListItem } from "@/components/shapes/shape-list-item";
import { dropAction, type DropTargetRow } from "@/lib/map/drop-action";
import { sidebarRows } from "@/lib/map/sidebar-rows";
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
}) {
  /*
   * Open by default, and remembered per group only while the editor is on
   * screen. A collapsed group is a way to get a long sidebar back under control,
   * not a preference worth a column in the database.
   */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

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
