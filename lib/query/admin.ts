"use client";

import { useMutation } from "@tanstack/react-query";

import type { AppNotification } from "@/lib/notifications/types";
import type { AdminLoginInput } from "@/lib/validation/admin.schema";
import type { AdminNotificationForm } from "@/lib/validation/notification.schema";
import { apiFetch } from "./fetcher";

/**
 * The operator console's writes. No cache to update on any of them: login and
 * logout end in a document navigation, which is what makes the new cookie (or
 * its absence) the only state the next page sees, and the notification writes
 * end in `router.refresh()`, because the Sent list is server-rendered.
 */

export function useAdminLogin() {
  return useMutation({
    mutationFn: (input: AdminLoginInput) =>
      apiFetch<null>("/api/admin/login", { method: "POST", body: JSON.stringify(input) }),
    retry: false,
  });
}

export function useAdminLogout() {
  return useMutation({
    mutationFn: () => apiFetch<null>("/api/admin/logout", { method: "POST" }),
    retry: false,
  });
}

export function useSendNotification() {
  return useMutation({
    mutationFn: (input: AdminNotificationForm) =>
      apiFetch<AppNotification>("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    retry: false,
  });
}

export function useDeleteNotification() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/api/admin/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }),
    retry: false,
  });
}
