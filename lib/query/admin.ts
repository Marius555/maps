"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import type { Discount, DiscountRedemptionPage } from "@/lib/billing/types";
import type { AppNotification } from "@/lib/notifications/types";
import type { AdminLoginInput } from "@/lib/validation/admin.schema";
import type { AdminDiscountForm } from "@/lib/validation/discount.schema";
import type { AdminNotificationForm } from "@/lib/validation/notification.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * The operator console's writes. No cache to update on any of them: login and
 * logout end in a document navigation, which is what makes the new cookie (or
 * its absence) the only state the next page sees, and the notification writes
 * end in `router.refresh()`, because the Sent list is server-rendered. So do
 * the discount writes, for the same reason.
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

export function useCreateDiscount() {
  return useMutation({
    mutationFn: (input: AdminDiscountForm) =>
      apiFetch<Discount>("/api/admin/discounts", { method: "POST", body: JSON.stringify(input) }),
    retry: false,
  });
}

export function useDeleteDiscount() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/api/admin/discounts/${encodeURIComponent(id)}`, { method: "DELETE" }),
    retry: false,
  });
}

/**
 * Who redeemed a discount, a page at a time, fetched only while the dialog
 * asking is open. Every page is a live call to the provider.
 */
export function useDiscountRedemptions(discountId: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.discountRedemptions(discountId, page),
    queryFn: () =>
      apiFetch<DiscountRedemptionPage>(
        `/api/admin/discounts/${encodeURIComponent(discountId)}/redemptions?page=${String(page)}`,
      ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/**
 * Show a discount on /pricing for everybody, or stop. The page reads it
 * within a minute (`lib/billing/public-offer.ts` caches).
 */
export function useFeatureDiscount() {
  return useMutation({
    mutationFn: ({ id, code, featured }: { id: string; code: string; featured: boolean }) =>
      apiFetch<unknown>(`/api/admin/discounts/${encodeURIComponent(id)}/feature`, {
        method: featured ? "PUT" : "DELETE",
        body: featured ? JSON.stringify({ code }) : undefined,
      }),
    retry: false,
  });
}
