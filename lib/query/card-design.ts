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
 * Optimistic, on the same argument `useUpdateMap` makes for the appearance
 * controls: a drop, a resize or a removal is expected to repaint the canvas in
 * that frame, and a round trip of latency there reads as a broken control
 * rather than a slow one.
 */
export function useUpdateCardDesign() {
  const queryClient = useQueryClient();

  const write = (cardLayout: Record<string, unknown>) =>
    queryClient.setQueryData(queryKeys.cardDesign, cardLayout);

  return useMutation({
    mutationFn: async (cardLayout: CardLayout) =>
      (
        await apiFetch<CardDesignResponse>("/api/account/card-design", {
          method: "PATCH",
          body: JSON.stringify({ cardLayout }),
        })
      ).cardLayout,

    onMutate: async (cardLayout) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cardDesign });
      const previous = queryClient.getQueryData<Record<string, unknown>>(
        queryKeys.cardDesign,
      );

      write(cardLayout);
      return { previous };
    },

    onError: (_error, _input, context) => {
      if (context?.previous) write(context.previous);
    },

    onSuccess: write,
  });
}
