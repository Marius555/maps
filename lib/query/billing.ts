"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { BillingCadence, KeptPlan, PaidPlanId } from "@/lib/billing/types";
import type { ChangePlanInput } from "@/lib/validation/billing.schema";
import { apiFetch } from "./fetcher";

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
