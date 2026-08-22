"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { Group, Place, Shape } from "@/lib/repositories/types";
import {
  DEFAULT_GROUP_COLOR,
  type CreateGroupInput,
  type UpdateGroupInput,
} from "@/lib/validation/group.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";
import { useUpdatePlace } from "./places";
import { useUpdateShape } from "./shapes";

type GroupsPage = {
  groups: Group[];
  nextCursor: string | null;
  total: number;
};

/** Guard against an unbounded loop if the server ever returns a stuck cursor. */
const MAX_PAGES = 20;

/**
 * Marks a group that exists only in the cache, waiting on its create round trip.
 *
 * Exported for the same reason the place and shape versions are: a group
 * mid-flight has no real id, so nothing may be assigned to it yet.
 */
const TEMP_GROUP_ID_PREFIX = "temp-";

export function isOptimisticGroupId(groupId: string): boolean {
  return groupId.startsWith(TEMP_GROUP_ID_PREFIX);
}

async function fetchAllGroups(mapId: string): Promise<Group[]> {
  const all: Group[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const result: GroupsPage = await apiFetch<GroupsPage>(
      `/api/maps/${mapId}/groups${query}`,
    );

    all.push(...result.groups);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }

  return all;
}

export function useGroups(mapId: string, initialData?: Group[]) {
  return useQuery({
    queryKey: queryKeys.groups.list(mapId),
    queryFn: () => fetchAllGroups(mapId),
    initialData,
  });
}

/**
 * The groups array as the cache holds it *now*, not as of the last render.
 *
 * Same reasoning as `useShapesSnapshot`: the caller is deciding what to call the
 * group it is about to create, and a value closed over at render time is one
 * gesture out of date — two groups made in quick succession would both read the
 * same array and both land as "Group 1".
 */
export function useGroupsSnapshot(mapId: string): () => Group[] {
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.getQueryData<Group[]>(queryKeys.groups.list(mapId)) ?? [],
    [queryClient, mapId],
  );
}

export function useCreateGroup(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.groups.list(mapId);

  return useMutation({
    mutationFn: async (input: CreateGroupInput) =>
      (
        await apiFetch<{ group: Group }>(`/api/maps/${mapId}/groups`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).group,

    // The section has to appear when the button is pressed, not a round trip
    // later — the members are being assigned to it in the same breath.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Group[]>(listKey);

      const now = new Date().toISOString();
      const optimistic: Group = {
        id: `${TEMP_GROUP_ID_PREFIX}${crypto.randomUUID()}`,
        mapId,
        name: input.name,
        color: input.color ?? DEFAULT_GROUP_COLOR,
        sortOrder: input.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<Group[]>(listKey, (groups = []) => [
        ...groups,
        optimistic,
      ]);

      return { previous, tempId: optimistic.id };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },

    // Swap the temp row for the real one rather than appending, or the sidebar
    // would show the same group twice.
    onSuccess: (group, _input, context) => {
      queryClient.setQueryData<Group[]>(listKey, (groups = []) =>
        groups.map((existing) =>
          existing.id === context?.tempId ? group : existing,
        ),
      );
    },

    // Marked stale, not refetched — same reasoning as useCreateShape.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.all(mapId),
        refetchType: "none",
      });
    },
  });
}

export function useUpdateGroup(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.groups.list(mapId);

  return useMutation({
    mutationFn: async ({
      groupId,
      input,
    }: {
      groupId: string;
      input: UpdateGroupInput;
    }) =>
      (
        await apiFetch<{ group: Group }>(`/api/maps/${mapId}/groups/${groupId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).group,

    onMutate: async ({ groupId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey });

      // This row's prior values, not the whole list — a failed PATCH must not
      // roll back edits to other groups that landed beside it.
      const previous = queryClient
        .getQueryData<Group[]>(listKey)
        ?.find((group) => group.id === groupId);

      queryClient.setQueryData<Group[]>(listKey, (groups = []) =>
        groups.map((existing) =>
          existing.id === groupId ? { ...existing, ...input } : existing,
        ),
      );

      return { previous };
    },

    onError: (_error, { groupId }, context) => {
      const previous = context?.previous;
      if (!previous) return;

      queryClient.setQueryData<Group[]>(listKey, (groups = []) =>
        groups.map((existing) => (existing.id === groupId ? previous : existing)),
      );
    },

    onSuccess: (group) => {
      queryClient.setQueryData<Group[]>(listKey, (groups = []) =>
        groups.map((existing) => (existing.id === group.id ? group : existing)),
      );
    },
  });
}

/** What a group is being asked to hold, or release when `groupId` is "". */
export type GroupMembers = {
  placeIds: readonly string[];
  shapeIds: readonly string[];
};

/**
 * Put a set of locations and shapes into a group, or take them out of one.
 *
 * Membership lives on the members, so this is one PATCH each rather than a
 * single write — which is fine at the sizes involved. A marquee selection is
 * bounded by what fits in a drag box, and drag-to-group moves exactly one
 * object, so the batch endpoint this used to say it was waiting for would have
 * had no caller. `useSetGroupPin` below is the case that finally needed one, and
 * it is a different case: it writes *every* member of a group, which is up to
 * 3,000 rows, and it goes through a single endpoint for exactly that reason.
 *
 * Each PATCH carries `groupId` alone, so `mergePlaceFields`/`mergeShapeFields`
 * let it commute with a rename or a drag landing at the same time.
 */
export function useAssignToGroup(mapId: string) {
  const updatePlace = useUpdatePlace(mapId);
  const updateShape = useUpdateShape(mapId);

  const updatePlaceAsync = updatePlace.mutateAsync;
  const updateShapeAsync = updateShape.mutateAsync;

  return useCallback(
    async ({ placeIds, shapeIds }: GroupMembers, groupId: string) => {
      await Promise.all([
        ...placeIds.map((placeId) =>
          updatePlaceAsync({ placeId, input: { groupId } }),
        ),
        ...shapeIds.map((shapeId) =>
          updateShapeAsync({ shapeId, input: { groupId } }),
        ),
      ]);
    },
    [updatePlaceAsync, updateShapeAsync],
  );
}

/**
 * Gives every location in a group the same pin.
 *
 * One request rather than one per member — see `setGroupPin` in
 * groups.repository.ts, and the note above about why membership is the other way
 * round. Nothing is written to the group itself: a group has no pin, and what
 * this changes is each of its locations' own `icon`.
 *
 * The optimistic write is what makes this feel like an edit rather than a form
 * submission — forty markers on the canvas change on the press, not a second
 * later. Only the affected rows are remembered for the rollback, not the whole
 * list: a list-wide snapshot would undo every drag and rename that landed beside
 * this while it was in flight. Same reasoning as `useUpdatePlace`.
 */
export function useSetGroupPin(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.places.list(mapId);

  return useMutation({
    mutationFn: async ({ groupId, icon }: { groupId: string; icon: string }) =>
      (
        await apiFetch<{ count: number }>(
          `/api/maps/${mapId}/groups/${groupId}/pin`,
          { method: "PATCH", body: JSON.stringify({ icon }) },
        )
      ).count,

    onMutate: async ({ groupId, icon }) => {
      await queryClient.cancelQueries({ queryKey: listKey });

      const previous = (queryClient.getQueryData<Place[]>(listKey) ?? [])
        .filter((place) => place.groupId === groupId)
        .map((place) => ({ id: place.id, icon: place.icon }));

      queryClient.setQueryData<Place[]>(listKey, (places = []) =>
        places.map((place) =>
          place.groupId === groupId ? { ...place, icon } : place,
        ),
      );

      return { previous };
    },

    // Only the `icon` of the rows this touched, so a rename or a drag that
    // landed on one of them meanwhile survives the rollback.
    onError: (_error, _variables, context) => {
      if (!context?.previous) return;

      const restore = new Map(
        context.previous.map((row) => [row.id, row.icon] as const),
      );

      queryClient.setQueryData<Place[]>(listKey, (places = []) =>
        places.map((place) =>
          restore.has(place.id)
            ? { ...place, icon: restore.get(place.id) as string }
            : place,
        ),
      );
    },

    /*
     * Marked stale, not refetched — the same reasoning as `useCreatePlace`.
     * `places.all` prefix-matches the list key, so refetching here would re-page
     * the whole map (up to 50 requests) to learn something the optimistic write
     * already knows.
     */
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.places.all(mapId),
        refetchType: "none",
      });
    },
  });
}

export function useDeleteGroup(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.groups.list(mapId);

  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<void>(`/api/maps/${mapId}/groups/${groupId}`, {
        method: "DELETE",
      }),
    onMutate: async (groupId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Group[]>(listKey);

      queryClient.setQueryData<Group[]>(listKey, (groups = []) =>
        groups.filter((group) => group.id !== groupId),
      );

      return { previous };
    },
    onError: (_error, _groupId, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },

    /*
     * The members are not touched, here or on the server. Their `groupId` still
     * names the group that just went, and the sidebar reads an id with no
     * matching group as ungrouped — so they reappear in the flat lists on this
     * very render, with no second round of writes to go wrong.
     */
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.all(mapId),
        refetchType: "none",
      });
    },
  });
}

/**
 * Deletes a group and everything in it, in one request.
 *
 * One endpoint rather than a PATCH per member, for the reason `useSetGroupPin`
 * gives: this touches *every* member of a group, which §6 allows to be 3,000
 * rows, and firing three thousand DELETEs from a browser is not a thing to
 * build. `useAssignToGroup` stays one-request-each because a marquee is bounded
 * by a drag box; this is not bounded by anything.
 *
 * Three caches move at once and all three are rolled back together, because the
 * user pressed one button: a half-restored map after a failed delete would be
 * worse than the delete not happening. The whole arrays are kept rather than the
 * removed ids — unlike `useSetGroupPin`, which keeps one field per row — because
 * there is no field to merge back. A row is either there or it is not.
 */
export function useDeleteGroupContents(mapId: string) {
  const queryClient = useQueryClient();

  const groupsKey = queryKeys.groups.list(mapId);
  const placesKey = queryKeys.places.list(mapId);
  const shapesKey = queryKeys.shapes.list(mapId);

  return useMutation({
    mutationFn: (groupId: string) =>
      apiFetch<{ places: number; shapes: number }>(
        `/api/maps/${mapId}/groups/${groupId}/contents`,
        { method: "DELETE" },
      ),

    onMutate: async (groupId) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: groupsKey }),
        queryClient.cancelQueries({ queryKey: placesKey }),
        queryClient.cancelQueries({ queryKey: shapesKey }),
      ]);

      const previous = {
        groups: queryClient.getQueryData<Group[]>(groupsKey),
        places: queryClient.getQueryData<Place[]>(placesKey),
        shapes: queryClient.getQueryData<Shape[]>(shapesKey),
      };

      queryClient.setQueryData<Group[]>(groupsKey, (groups = []) =>
        groups.filter((group) => group.id !== groupId),
      );
      queryClient.setQueryData<Place[]>(placesKey, (places = []) =>
        places.filter((place) => place.groupId !== groupId),
      );
      queryClient.setQueryData<Shape[]>(shapesKey, (shapes = []) =>
        shapes.filter((shape) => shape.groupId !== groupId),
      );

      return { previous };
    },

    onError: (_error, _groupId, context) => {
      if (!context?.previous) return;

      const { groups, places, shapes } = context.previous;
      if (groups) queryClient.setQueryData(groupsKey, groups);
      if (places) queryClient.setQueryData(placesKey, places);
      if (shapes) queryClient.setQueryData(shapesKey, shapes);
    },

    /*
     * Marked stale without a refetch, like every other mutation here: the
     * optimistic filter is already the right answer, and re-paging a 3,000-row
     * map is up to 50 requests to confirm it.
     */
    onSettled: () => {
      for (const key of [
        queryKeys.groups.all(mapId),
        queryKeys.places.all(mapId),
        queryKeys.shapes.all(mapId),
      ]) {
        queryClient.invalidateQueries({ queryKey: key, refetchType: "none" });
      }
    },
  });
}
