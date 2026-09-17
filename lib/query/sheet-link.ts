"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  SheetLinkView,
  SheetSyncReport,
  SheetSyncStatus,
} from "@/lib/sheet-sync/types";
import type { SaveSheetLinkInput } from "@/lib/validation/sheet-link.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

export type SheetSyncResult = {
  status: SheetSyncStatus;
  report: SheetSyncReport;
  link: SheetLinkView;
  more: boolean;
};

/**
 * A runaway guard. A step looks up a few seconds' worth of addresses, so this
 * is hours of sheet — far past any real one — and exists only so a server that
 * kept answering `more: true` could not hold the button down forever.
 */
const MAX_STEPS = 300;

/** The map's link, or null when it has none. */
export function useSheetLink(
  mapId: string,
  initialData?: SheetLinkView | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.sheetLink(mapId),
    queryFn: async () =>
      (await apiFetch<{ link: SheetLinkView | null }>(`/api/maps/${mapId}/sheet-link`))
        .link,
    initialData,
    enabled,
  });
}

/** Link the map to the sheet an import just read. */
export function useSaveSheetLink(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveSheetLinkInput) =>
      (
        await apiFetch<{ link: SheetLinkView }>(`/api/maps/${mapId}/sheet-link`, {
          method: "POST",
          body: JSON.stringify(input),
        })
      ).link,
    onSuccess: (link) => {
      queryClient.setQueryData(queryKeys.sheetLink(mapId), link);
    },
  });
}

/**
 * Sync now — every step of it.
 *
 * The server does a sync in short steps, because Appwrite Sites cuts a request
 * off at its site timeout (lib/sheet-sync/run.ts). This calls one, and while it
 * answers `more: true` calls the next with `continuing`, so the mutation is
 * pending for the whole sync and resolves with its combined report. `onStep`
 * hears each step, so the button can show the counts climbing on a big sheet.
 *
 * Invalidates the places and the map rather than patching them: a sync can add,
 * change and remove hundreds of rows, rewrite the tag vocabulary and republish,
 * and the response carries none of those rows.
 */
export function useSyncSheet(
  mapId: string,
  { onStep }: { onStep?: (result: SheetSyncResult) => void } = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ confirmRemovals = false }: { confirmRemovals?: boolean } = {}) => {
      let result: SheetSyncResult | null = null;

      for (let step = 0; step < MAX_STEPS; step += 1) {
        result = await apiFetch<SheetSyncResult>(`/api/maps/${mapId}/sheet-link/sync`, {
          method: "POST",
          body: JSON.stringify({ confirmRemovals, continuing: step > 0 }),
        });

        queryClient.setQueryData(queryKeys.sheetLink(mapId), result.link);
        onStep?.(result);

        if (!result.more) break;
      }

      // Unreachable in practice — the loop runs at least once.
      if (!result) throw new Error("The sync did not start.");

      return result;
    },
    // Settled rather than success: a step that fails half way through a sync
    // still follows steps that wrote rows, and the list must show them.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.places.all(mapId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.maps.detail(mapId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sheetLink(mapId) });
    },
  });
}

export function useSetSheetAutoSync(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (autoSync: boolean) =>
      (
        await apiFetch<{ link: SheetLinkView }>(`/api/maps/${mapId}/sheet-link`, {
          method: "PATCH",
          body: JSON.stringify({ autoSync }),
        })
      ).link,
    onSuccess: (link) => {
      queryClient.setQueryData(queryKeys.sheetLink(mapId), link);
    },
  });
}

export function useUnlinkSheet(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () =>
      await apiFetch<void>(`/api/maps/${mapId}/sheet-link`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.sheetLink(mapId), null);
    },
  });
}
