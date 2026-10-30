"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CardLayout } from "@/packages/shared/card-layout";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

type CardDesignResponse = { cardLayout: Record<string, unknown> };

/**
 * The card design of the workspace `mapId` is in, raw — see readCardLayout for
 * turning it into something drawable. Asked for through the map, because the map
 * is what names the workspace (app/api/maps/[id]/card-design/route.ts).
 */
export function useCardDesign(mapId: string, initialData?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.cardDesign(mapId),
    queryFn: async () =>
      (await apiFetch<CardDesignResponse>(cardDesignPath(mapId))).cardLayout,
    initialData,
  });
}

function cardDesignPath(mapId: string): string {
  return `/api/maps/${encodeURIComponent(mapId)}/card-design`;
}

/**
 * Deliberately **not** optimistic, where every other mutation in this file's
 * neighbourhood is.
 *
 * Optimism is for a control that is expected to have happened by the time the
 * finger leaves it — a theme swatch, a dragged handle. This is a Save button
 * pressed once at the end of a session, and the whole point of the spinner on it
 * is that a request is genuinely in flight; writing the cache first would make
 * that spinner decorative and a failure would show as the card silently
 * reverting some time later. The designer holds its own draft
 * (components/card/designer/card-designer.tsx), so nothing is waiting on this
 * to repaint.
 */
export function useUpdateCardDesign(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardLayout: CardLayout) =>
      (
        await apiFetch<CardDesignResponse>(cardDesignPath(mapId), {
          method: "PATCH",
          body: JSON.stringify({ cardLayout }),
        })
      ).cardLayout,

    // The resolved layout the server actually stored, so anything else reading
    // this workspace's card — the editor's popup, the preview — repaints from
    // the same bytes a visitor would get. Every other map's copy is marked stale:
    // maps in one workspace share the design.
    onSuccess: (cardLayout) => {
      queryClient.setQueryData(queryKeys.cardDesign(mapId), cardLayout);
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[2] === "cardDesign" && query.queryKey[1] !== mapId,
      });
    },
  });
}
