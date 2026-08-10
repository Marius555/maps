"use client";

import { ScrollShadow } from "@heroui/react";

import { PlaceCountBadge } from "@/components/places/place-count-badge";
import { PlaceList } from "@/components/places/place-list";
import { ErrorMessage } from "@/components/ui/error-message";
import type { MapCategory, Place } from "@/lib/repositories/types";

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
 */
export function EditorSidebar({
  mapId,
  places,
  categoriesById,
  placeLimit,
  selectedPlaceId,
  pendingAddressIds,
  failedAddressIds,
  error,
  onSelect,
  onEdit,
  onRetryAddress,
}: {
  mapId: string;
  places: Place[];
  categoriesById: Map<string, MapCategory>;
  placeLimit: number;
  selectedPlaceId: string | null;
  /** Locations still waiting on a reverse geocode — see PlaceList. */
  pendingAddressIds?: ReadonlySet<string>;
  /** Locations whose reverse geocode came back with nothing — see PlaceList. */
  failedAddressIds?: ReadonlySet<string>;
  error: unknown;
  onSelect: (placeId: string) => void;
  onEdit: (placeId: string) => void;
  onRetryAddress?: (placeId: string) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:w-80 lg:shrink-0">
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Locations</h2>
        <PlaceCountBadge count={places.length} limit={placeLimit} />
      </header>

      {error ? (
        <div className="px-3 pt-3">
          <ErrorMessage error={error} />
        </div>
      ) : null}

      {/* Scrolls inside the panel rather than pushing the page taller, so the map
          keeps its height no matter how many locations there are. */}
      <ScrollShadow className="min-h-0 flex-1 p-2" hideScrollBar>
        <PlaceList
          mapId={mapId}
          places={places}
          categoriesById={categoriesById}
          selectedPlaceId={selectedPlaceId}
          pendingAddressIds={pendingAddressIds}
          failedAddressIds={failedAddressIds}
          onSelect={onSelect}
          onEdit={onEdit}
          onRetryAddress={onRetryAddress}
        />
      </ScrollShadow>
    </aside>
  );
}
