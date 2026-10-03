"use client";

import { useMemo } from "react";

import { useGroups } from "@/lib/query/groups";
import { isOptimisticPlaceId } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import { readEmbedSettings } from "@/lib/validation/embed-settings.schema";
import { pinThemeColor } from "./theme-color";
import type { PinColorMenu } from "./place-row-menu";

/**
 * Pin colour for every row on the Locations page.
 *
 * The editor works this out from the rows it already has, which carry their
 * group's colour (`locations-list.tsx`). This page lists locations without
 * groups, so it reads the groups itself — one request, and the cache the editor
 * fills — or a grouped location's first swatch would offer its tag's colour
 * while the map painted it its group's.
 *
 * A grouped *route* lending its stops a colour is not followed here: that needs
 * every shape on the map, for a swatch that is wrong only until it is pressed.
 */
export function usePinColorMenus(
  map: AppMap,
): (place: Place) => PinColorMenu | undefined {
  const { data: groups = [] } = useGroups(map.id);

  const groupColors = useMemo(
    () => new Map(groups.map((group) => [group.id, group.color])),
    [groups],
  );
  const defaultPinColor = readEmbedSettings(map.settings).pinColor;

  return (place) => {
    // A row that exists only in the cache has no id the server could PATCH.
    if (isOptimisticPlaceId(place.id)) return undefined;

    const groupColor = groupColors.get(place.groupId);

    return {
      mapId: map.id,
      themeColor: pinThemeColor({
        groupColor,
        tagGroups: map.tagGroups,
        tags: place.tags,
        defaultPinColor,
      }),
      isGrouped: Boolean(groupColor),
    };
  };
}
