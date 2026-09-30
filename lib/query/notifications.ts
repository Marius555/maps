"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NotificationFeed } from "@/lib/notifications/types";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * The account's notifications, for the sidebar's count and the page.
 *
 * Read on the client rather than in the dashboard layout, so no page waits on
 * it: the count arrives a beat after the sidebar, at the end of its row, where
 * it moves nothing. Messages from us are not urgent to the second, so it
 * refreshes when the tab regains focus and every ten minutes, not on a tight
 * poll.
 */
export function useNotifications(initialData?: NotificationFeed) {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => apiFetch<NotificationFeed>("/api/notifications"),
    initialData,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * The page was opened: clear the count.
 *
 * Takes the feed the page rendered with and writes it into the cache, count
 * zeroed — the sidebar may be holding a copy up to five minutes old, and this is
 * the moment the page has a fresher one. The page keeps its own record of which
 * items were new, so they stay marked for the rest of the visit even after a
 * refetch reports them read. `keepalive` so the write survives the owner
 * navigating straight away.
 */
export function useMarkNotificationsSeen() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, NotificationFeed>({
    mutationFn: () =>
      apiFetch<void>("/api/notifications/seen", { method: "POST", keepalive: true }),
    onMutate: async (feed) => {
      /*
       * Cancelled first: on a cold load of the page the sidebar's own first
       * fetch is still in flight, and it lands after this — putting the count
       * back — unless it is stopped.
       */
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      queryClient.setQueryData<NotificationFeed>(queryKeys.notifications, {
        ...feed,
        unreadCount: 0,
      });
    },
    // Once the stamp is written, the server's answer is the truth again.
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
