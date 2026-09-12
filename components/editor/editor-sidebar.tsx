"use client";

import { ScrollShadow } from "@heroui/react";
import { useMemo } from "react";

import { RowDragProvider } from "@/components/groups/row-drag-context";
import type { DraggedObject } from "@/components/groups/use-row-drag";
import { PlaceCountBadge } from "@/components/places/place-count-badge";
import { PlaceListEmpty } from "@/components/places/place-list-empty";
import { ErrorMessage } from "@/components/ui/error-message";
import type {
  Group,
  MapTagGroup,
  Place,
  Shape,
} from "@/lib/repositories/types";
import type { RouteStop } from "@/packages/shared/shapes";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { LocationsList } from "./locations-panel/locations-list";
import { UngroupDropZone } from "./locations-panel/ungroup-drop-zone";

/**
 * The locations panel beside the map.
 *
 * A panel in its own right, matching the map's frame, so the editor reads as two
 * deliberate halves instead of a map with a column of text leaning against it.
 *
 * There is no "Import from CSV" button here any more. It was wedged between the
 * heading and the list, which is why it looked dropped in at random — importing
 * is a Locations-tab job and it lives in that page's header, where the rest of
 * the bulk actions are.
 *
 * The panel is now a frame around one list rather than a stack of four.
 * Everything in it — group headers, group members, loose locations, loose shapes
 * — is rendered by `LocationsList` from one array of rows, because a row that
 * lives in a different component depending on its `groupId` cannot be animated
 * from one to the other. See lib/map/sidebar-rows.ts.
 */

/**
 * Past this many rows, they stop travelling and only fade.
 *
 * Layout animations measure every sibling on every commit. §6 allows 3,000
 * locations on one map, and paying that on the largest lists is exactly where it
 * would hurt most — while the gesture the animation exists for, moving one thing
 * between groups, is something people do on maps they can still read.
 */
const ANIMATE_MOVES_UP_TO = 150;

export function EditorSidebar({
  mapId,
  places,
  shapes,
  groups,
  tagGroups,
  pinIcons,
  placeLimit,
  selectedPlaceId,
  selectedShapeId,
  selectedPlaceIds,
  selectedShapeIds,
  isGrouping,
  pendingAddressIds,
  failedAddressIds,
  error,
  onSelect,
  onEdit,
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
  places: Place[];
  shapes: Shape[];
  groups: Group[];
  /** The map's tag vocabulary — a location's first tag colours its pin. */
  tagGroups: MapTagGroup[];
  /** The map's own pins, so a row can draw a `custom:<id>` one. */
  pinIcons: CustomPinIcon[];
  placeLimit: number;
  selectedPlaceId: string | null;
  selectedShapeId: string | null;
  /** Locations picked by the marquee or a group — lit like a selected row. */
  selectedPlaceIds: ReadonlySet<string>;
  selectedShapeIds: ReadonlySet<string>;
  /** A group is being created and filled — see lib/map/sidebar-rows.ts. */
  isGrouping: boolean;
  /** Locations still waiting on a reverse geocode — see PlaceRowLabel. */
  pendingAddressIds?: ReadonlySet<string>;
  /** Locations whose reverse geocode came back with nothing. */
  failedAddressIds?: ReadonlySet<string>;
  error: unknown;
  onSelect: (placeId: string) => void;
  onEdit: (placeId: string) => void;
  onSelectShape: (shapeId: string) => void;
  onEditShape: (shapeId: string) => void;
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
  /** Reorder a route's stops and ask the engine again — see LocationsList. */
  onRouteThrough: (shapeId: string, stops: readonly RouteStop[]) => void;
}) {
  const animateMoves =
    places.length + shapes.length + groups.length <= ANIMATE_MOVES_UP_TO;

  /*
   * Whether a dragged object is in a group, which is what decides if the ungroup
   * strip is offered. The same rule the lists follow: a `groupId` naming a group
   * that is not in the list reads as ungrouped, so a member of a group that has
   * just been deleted is not offered a way out of it.
   */
  const groupIds = useMemo(
    () => new Set(groups.map((group) => group.id)),
    [groups],
  );

  const isGrouped = (dragged: DraggedObject) => {
    // A group is not in a group — they do not nest — so there is nothing for it
    // to be removed from, and the strip stays hidden for the whole drag.
    if (dragged.type === "group") return false;

    const object =
      dragged.type === "place"
        ? places.find((place) => place.id === dragged.id)
        : shapes.find((shape) => shape.id === dragged.id);

    return Boolean(object && groupIds.has(object.groupId));
  };

  return (
    <RowDragProvider>
      {/* `max-h-[60dvh]` only below `lg`. There the row stacks — map above,
          panel below — so there is no shared height to divide and the panel
          would grow the page one location at a time. Above `lg` the row's own
          height governs, and a cap here would fight it. */}
      <aside className="flex max-h-[60dvh] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:max-h-none lg:w-80 lg:shrink-0">
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold text-foreground">Locations</h2>
          {/* Counts every location on the map, grouped or not: this is the plan
              limit, not the length of the list under it. */}
          <PlaceCountBadge count={places.length} limit={placeLimit} />
        </header>

        {error ? (
          <div className="px-3 pt-3">
            <ErrorMessage error={error} />
          </div>
        ) : null}

        {/* Scrolls inside the panel rather than pushing the page taller, so the
            map keeps its height no matter how many locations there are. */}
        <ScrollShadow className="min-h-0 flex-1 p-2" hideScrollBar>
          {/* The invitation belongs to the panel rather than to the list, and it
              counts every location rather than the loose ones: a map whose every
              location is grouped has an empty flat run and is not an empty map.
              It sits above whatever else is there, which for a map with shapes
              and no locations is the shapes. */}
          {places.length === 0 ? <PlaceListEmpty /> : null}

          <LocationsList
            mapId={mapId}
            groups={groups}
            places={places}
            shapes={shapes}
            tagGroups={tagGroups}
            pinIcons={pinIcons}
            selectedPlaceId={selectedPlaceId}
            selectedShapeId={selectedShapeId}
            selectedPlaceIds={selectedPlaceIds}
            selectedShapeIds={selectedShapeIds}
            isGrouping={isGrouping}
            animateMoves={animateMoves}
            pendingAddressIds={pendingAddressIds}
            failedAddressIds={failedAddressIds}
            onSelectPlace={onSelect}
            onEditPlace={onEdit}
            onSelectShape={onSelectShape}
            onEditShape={onEditShape}
            onFocusGroup={onFocusGroup}
            onEditGroup={onEditGroup}
            onRetryAddress={onRetryAddress}
            onRemoveFromGroup={onRemoveFromGroup}
            onGroupObjects={onGroupObjects}
            onAddToGroup={onAddToGroup}
            onMergeGroups={onMergeGroups}
            onRouteThrough={onRouteThrough}
          />
        </ScrollShadow>

        {/* Outside the scroll area on purpose — a long list must not be able to
            push the one drop target a drag needs out of reach. */}
        <UngroupDropZone isGrouped={isGrouped} onUngroup={onRemoveFromGroup} />
      </aside>
    </RowDragProvider>
  );
}
