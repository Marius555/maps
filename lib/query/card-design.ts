"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CardLayout } from "@/packages/shared/card-layout";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

type CardDesignResponse = { cardLayout: Record<string, unknown> };

/** The account's own card design, raw — see readCardLayout for turning it into something drawable. */
export function useCardDesign(initialData?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.cardDesign,
    queryFn: async () =>
      (await apiFetch<CardDesignResponse>("/api/account/card-design")).cardLayout,
    initialData,
  });
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
export function useUpdateCardDesign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardLayout: CardLayout) =>
      (
        await apiFetch<CardDesignResponse>("/api/account/card-design", {
          method: "PATCH",
          body: JSON.stringify({ cardLayout }),
        })
      ).cardLayout,

    // The resolved layout the server actually stored, so anything else reading
    // this account's card — the editor's popup, the preview — repaints from the
    // same bytes a visitor would get.
    onSuccess: (cardLayout) =>
      queryClient.setQueryData(queryKeys.cardDesign, cardLayout),
  });
}
