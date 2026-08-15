"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { Shape } from "@/lib/repositories/types";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
  type CreateShapeInput,
  type UpdateShapeInput,
} from "@/lib/validation/shape.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";
import { mergeShapeFields, patchedShapeKeys } from "./shape-cache";

type ShapesPage = {
  shapes: Shape[];
  nextCursor: string | null;
  total: number;
};

/** Guard against an unbounded loop if the server ever returns a stuck cursor. */
const MAX_PAGES = 20;

/**
 * Marks a shape that exists only in the cache, waiting on its create round trip.
 *
 * Exported because the UI has to be able to tell one apart: a shape mid-flight
 * cannot be selected, dragged or deleted, since none of those have a real id to
 * send.
 */
const TEMP_SHAPE_ID_PREFIX = "temp-";

export function isOptimisticShapeId(shapeId: string): boolean {
  return shapeId.startsWith(TEMP_SHAPE_ID_PREFIX);
}

async function fetchAllShapes(mapId: string): Promise<Shape[]> {
  const all: Shape[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const result: ShapesPage = await apiFetch<ShapesPage>(
      `/api/maps/${mapId}/shapes${query}`,
    );

    all.push(...result.shapes);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }

  return all;
}

export function useShapes(mapId: string, initialData?: Shape[]) {
  return useQuery({
    queryKey: queryKeys.shapes.list(mapId),
    queryFn: () => fetchAllShapes(mapId),
    initialData,
  });
}

/**
 * The shapes array as the cache holds it *now*, not as of the last render.
 *
 * A callback rather than a value, for the reason `usePlacesSnapshot` gives: the
 * caller is a pointer handler deciding what to call the shape it is about to
 * create, and a value closed over at render time is one gesture out of date. Two
 * circles drawn in quick succession both read the same array and both land as
 * "Circle 1" — which is exactly what happened before this existed.
 */
export function useShapesSnapshot(mapId: string): () => Shape[] {
  const queryClient = useQueryClient();

  return useCallback(
    () => queryClient.getQueryData<Shape[]>(queryKeys.shapes.list(mapId)) ?? [],
    [queryClient, mapId],
  );
}

export function useCreateShape(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.shapes.list(mapId);

  return useMutation({
    mutationFn: async (input: CreateShapeInput) =>
      (
        await apiFetch<{ shape: Shape }>(`/api/maps/${mapId}/shapes`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).shape,

    // The shape has to stay on screen when the pointer comes up. Waiting for the
    // round trip would make a just-drawn circle vanish and reappear.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Shape[]>(listKey);

      const now = new Date().toISOString();
      const optimistic: Shape = {
        id: `${TEMP_SHAPE_ID_PREFIX}${crypto.randomUUID()}`,
        mapId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? DEFAULT_SHAPE_COLOR,
        opacity: input.opacity ?? DEFAULT_SHAPE_OPACITY,
        geometry: input.geometry,
        sortOrder: input.sortOrder ?? 0,
        groupId: input.groupId ?? "",
        createdAt: now,
        updatedAt: now,
      };

      queryClient.setQueryData<Shape[]>(listKey, (shapes = []) => [
        ...shapes,
        optimistic,
      ]);

      return { previous, tempId: optimistic.id };
    },

    // Rollback removes the optimistic shape. This is the path a plan-limit 403
    // takes, so leaving an orphan circle here would be the most visible bug.
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },

    // Swap the temp row for the real one rather than appending, or the layer
    // would draw two identical shapes stacked on each other.
    onSuccess: (shape, _input, context) => {
      queryClient.setQueryData<Shape[]>(listKey, (shapes = []) =>
        shapes.map((existing) =>
          existing.id === context?.tempId ? shape : existing,
        ),
      );
    },

    // Marked stale, not refetched — same reasoning as useCreatePlace: `shapes.all`
    // prefix-matches the list key, and onSuccess has already installed the
    // server's own row, so a refetch would have nothing to reconcile.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shapes.all(mapId),
        refetchType: "none",
      });
    },
  });
}

export function useUpdateShape(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.shapes.list(mapId);

  /** Rewrite one row, leaving every other row's identity untouched. */
  const patchRow = (shapeId: string, update: (shape: Shape) => Shape) => {
    queryClient.setQueryData<Shape[]>(listKey, (shapes = []) =>
      shapes.map((existing) =>
        existing.id === shapeId ? update(existing) : existing,
      ),
    );
  };

  return useMutation({
    mutationFn: async ({
      shapeId,
      input,
    }: {
      shapeId: string;
      input: UpdateShapeInput;
    }) =>
      (
        await apiFetch<{ shape: Shape }>(`/api/maps/${mapId}/shapes/${shapeId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        })
      ).shape,

    // Applied before the round trip. Releasing a handle is the loudest caller:
    // without this the circle snaps back to its old radius until the reply lands.
    onMutate: async ({ shapeId, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey });

      // This row's prior values, not a snapshot of the whole list — a failed
      // PATCH must not roll back edits to other shapes that landed beside it.
      const previous = queryClient
        .getQueryData<Shape[]>(listKey)
        ?.find((shape) => shape.id === shapeId);

      patchRow(shapeId, (existing) => ({ ...existing, ...input }));

      return { shapeId, keys: patchedShapeKeys(input), previous };
    },

    onError: (_error, _variables, context) => {
      if (!context?.previous) return;

      const { shapeId, keys, previous } = context;
      patchRow(shapeId, (existing) => mergeShapeFields(existing, previous, keys));
    },

    // Merged field by field rather than replacing the row — see shape-cache.ts.
    onSuccess: (shape, _variables, context) => {
      patchRow(shape.id, (existing) =>
        mergeShapeFields(existing, shape, context.keys),
      );
    },
  });
}

export function useDeleteShape(mapId: string) {
  const queryClient = useQueryClient();
  const listKey = queryKeys.shapes.list(mapId);

  return useMutation({
    mutationFn: (shapeId: string) =>
      apiFetch<void>(`/api/maps/${mapId}/shapes/${shapeId}`, {
        method: "DELETE",
      }),
    onMutate: async (shapeId) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<Shape[]>(listKey);

      queryClient.setQueryData<Shape[]>(listKey, (shapes = []) =>
        shapes.filter((shape) => shape.id !== shapeId),
      );

      return { previous };
    },
    onError: (_error, _shapeId, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shapes.all(mapId),
        refetchType: "none",
      });
    },
  });
}
