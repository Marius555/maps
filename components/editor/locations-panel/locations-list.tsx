"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { GroupListItem } from "@/components/groups/group-list-item";
import { UngroupDialog } from "@/components/groups/ungroup-dialog";
import type { DraggedObject } from "@/components/groups/use-row-drag";
import { DeletePlaceDialog } from "@/components/places/delete-place-dialog";
import { PlaceListItem } from "@/components/places/place-list-item";
import { DeleteShapeDialog } from "@/components/shapes/delete-shape-dialog";
import { ShapeListItem } from "@/components/shapes/shape-list-item";
import { sidebarRows } from "@/lib/map/sidebar-rows";
import { isOptimisticGroupId, useDeleteGroup } from "@/lib/query/groups";
import { isOptimisticPlaceId, useDeletePlace } from "@/lib/query/places";
import { isOptimisticShapeId, useDeleteShape } from "@/lib/query/shapes";
import { toastError } from "@/lib/query/toast-error";
import type { Group, MapCategory, Place, Shape } from "@/lib/repositories/types";

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
  categoriesById,
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
}: {
  mapId: string;
  groups: Group[];
  places: Place[];
  shapes: Shape[];
  categoriesById: Map<string, MapCategory>;
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
}) {
  /*
   * Open by default, and remembered per group only while the editor is on
   * screen. A collapsed group is a way to get a long sidebar back under control,
   * not a preference worth a column in the database.
   */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const ungroup = useDeleteGroup(mapId);
  const deletePlace = useDeletePlace(mapId);
  const deleteShape = useDeleteShape(mapId);

  const [pendingUngroupId, setPendingUngroupId] = useState<string | null>(null);
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
   * What a drop on a row means, decided by whether that row is in a group.
   *
   * On a member: join the group it is in. On a loose row: make a new group
   * holding the two of them. One rule in one place, where it used to be split
   * between a group's own lists and the loose ones purely because they happened
   * to be different components.
   */
  const drop = (
    target: DraggedObject,
    groupId: string,
    dragged: DraggedObject,
  ) => {
    if (groupId) {
      onAddToGroup(groupId, dragged);
      return;
    }

    onGroupObjects(target, dragged);
  };

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

              return (
                <GroupListItem
                  key={row.key}
                  group={group}
                  count={count}
                  isOpen={row.isOpen}
                  isSelected={isSelected}
                  animateMoves={animateMoves}
                  onToggle={() => toggle(group.id)}
                  onFocus={() => onFocusGroup(group.id)}
                  onEdit={() => onEditGroup(group.id)}
                  onUngroup={() => {
                    // A row that exists only in the cache has no id the server
                    // would recognise.
                    if (isOptimisticGroupId(group.id)) return;
                    setPendingUngroupId(group.id);
                  }}
                  onDropObject={(dragged) => onAddToGroup(group.id, dragged)}
                />
              );
            }

            if (row.kind === "place") {
              const { place } = row;

              return (
                <PlaceListItem
                  key={row.key}
                  place={place}
                  category={categoriesById.get(place.category)}
                  groupColor={row.groupColor}
                  isSelected={
                    place.id === selectedPlaceId || selectedPlaceIds.has(place.id)
                  }
                  indent={row.indent}
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
                  onDropObject={(dragged) =>
                    drop({ type: "place", id: place.id }, row.groupId, dragged)
                  }
                />
              );
            }

            const { shape } = row;

            return (
              <ShapeListItem
                key={row.key}
                shape={shape}
                groupColor={row.groupColor}
                isSelected={
                  shape.id === selectedShapeId || selectedShapeIds.has(shape.id)
                }
                indent={row.indent}
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
                onDropObject={(dragged) =>
                  drop({ type: "shape", id: shape.id }, row.groupId, dragged)
                }
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
