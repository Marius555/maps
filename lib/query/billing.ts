"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type {
  BillingCadence,
  InvoicePage,
  KeptPlan,
  PaidPlanId,
} from "@/lib/billing/types";
import type { ChangePlanInput } from "@/lib/validation/billing.schema";
import { apiFetch } from "./fetcher";
import { queryKeys } from "./keys";

/**
 * Move this account's running subscription to another plan or cadence.
 *
 * **Refreshes the route rather than touching a query cache**, because nothing
 * the plan decides lives in one: the account page, the plan badge and the user
 * menu all read the plan from the server components that render them, resolved
 * once per request in the dashboard layout. `router.refresh()` re-runs exactly
 * those, and the route has already written the new row by the time it answers,
 * so the refresh reads the new plan rather than racing the webhook for it.
 *
 * `import type` from `lib/billing/types` only — that module is plain types, but
 * the folder's `index.ts` builds the provider and is server-only.
 */
export function useChangePlan() {
  const router = useRouter();

  return useMutation({
    mutationFn: (input: ChangePlanInput) =>
      // `kept` is set when the change waits for the renewal — see `planChange`.
      apiFetch<{ plan: PaidPlanId; cadence: BillingCadence | null; kept: KeptPlan | null }>(
        "/api/account/subscription",
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: () => router.refresh(),
  });
}

/**
 * One page of invoices. Page one arrives with the Billing page itself, as
 * `initialData`, so the table is there on the first frame; the rest are fetched
 * as the pager asks.
 *
 * `keepPreviousData` holds the page on screen while the next one loads, so the
 * table never empties and collapses under the pager in between.
 */
export function useInvoices(page: number, firstPage: InvoicePage) {
  return useQuery({
    queryKey: queryKeys.invoices(page),
    queryFn: () => apiFetch<InvoicePage>(`/api/account/invoices?page=${String(page)}`),
    initialData: page === firstPage.page ? firstPage : undefined,
    placeholderData: keepPreviousData,
    // An invoice does not change once issued, and the next one is a month away.
    staleTime: 5 * 60_000,
  });
}

/** Stop the renewal. The plan stays until the period paid for ends. */
export function useCancelPlan() {
  const router = useRouter();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ endsAt: string | null }>("/api/account/subscription", { method: "DELETE" }),
    onSuccess: () => router.refresh(),
  });
}

/** Undo a cancellation while the period has not ended. */
export function useResumePlan() {
  const router = useRouter();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ renewsAt: string | null }>("/api/account/subscription/resume", {
        method: "POST",
      }),
    onSuccess: () => router.refresh(),
  });
}
