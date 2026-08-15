"use client";

import { useEffect, useRef } from "react";

import { isOptimisticGroupId, useDeleteGroup } from "@/lib/query/groups";
import type { Group, Place, Shape } from "@/lib/repositories/types";

/**
 * A group with nothing in it deletes itself.
 *
 * An empty group is not a state anyone asked for. It is what is left over after
 * a merge, after the last member is dragged out, and after the last member is
 * deleted — three different paths that used to end the same way, with a row in
 * the sidebar that says "0" and does nothing. They accumulate.
 *
 * One sweep here rather than a cleanup at each of those call sites: membership
 * lives on the members, so every path that empties a group looks identical from
 * this side — the group's id stops appearing in the places and shapes arrays.
 * Watching for that catches all three, plus the ones nobody has written yet, plus
 * the backlog already in the database, which goes on the first render of the
 * editor.
 *
 * Three things are never swept:
 *
 * - **Optimistic rows.** A `temp-` id names a group the server has never heard
 *   of; the DELETE would 404 and the real row would arrive seconds later anyway.
 * - **Groups mid-creation.** Making a group is a create followed by a PATCH per
 *   member (see `groupTogether`), so it legitimately exists empty for about a
 *   third of a second. `isPaused` covers that window — without it, this hook
 *   would delete every group at the instant it was made.
 * - **Groups whose DELETE failed.** The mutation puts the row back on error, and
 *   a row that is back is a row this effect would try again, forever. One attempt
 *   per group per session.
 */
export function usePruneEmptyGroups({
  mapId,
  groups,
  places,
  shapes,
  isPaused,
}: {
  mapId: string;
  groups: readonly Group[];
  places: readonly Pick<Place, "groupId">[];
  shapes: readonly Pick<Shape, "groupId">[];
  /** A group is being created and filled right now. Nothing is empty yet. */
  isPaused: boolean;
}) {
  const deleteGroup = useDeleteGroup(mapId);
  const deleteGroupAsync = deleteGroup.mutateAsync;

  const inFlight = useRef(new Set<string>());
  const failed = useRef(new Set<string>());

  useEffect(() => {
    if (isPaused) return;

    const occupied = new Set<string>();
    for (const place of places) if (place.groupId) occupied.add(place.groupId);
    for (const shape of shapes) if (shape.groupId) occupied.add(shape.groupId);

    for (const group of groups) {
      const { id } = group;

      if (occupied.has(id)) continue;
      if (isOptimisticGroupId(id)) continue;
      if (inFlight.current.has(id) || failed.current.has(id)) continue;

      inFlight.current.add(id);

      void deleteGroupAsync(id)
        .catch(() => {
          // The mutation's own onError restores the row. Remembering the failure
          // is what stops the restored row from being retried on the very next
          // render, and the one after that.
          failed.current.add(id);
        })
        .finally(() => {
          inFlight.current.delete(id);
        });
    }
  }, [groups, places, shapes, isPaused, deleteGroupAsync]);
}
