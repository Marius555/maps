"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { MARKETING_PLANS } from "@/lib/marketing/plans";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { CelebrationDialog, type CelebrationState } from "./celebration-dialog";
import { useActivationPoll } from "./use-activation-poll";

/**
 * "You're in" — the first thing a buyer sees back on their map.
 *
 * The provider returns the buyer to `/checkout/done`, which hops to
 * `/maps?checkout=done`, which forwards to their last map with the parameter
 * kept (`CheckoutReturn`, `app/(dashboard)/maps/(list)/page.tsx`). This is
 * mounted once in the dashboard shell and opens wherever that lands.
 *
 * `accountPlan` is the person's own plan, read by the dashboard layout — the
 * account that paid, whatever team they are looking at. While it is still Free
 * the webhook has not landed, and `useActivationPoll` refreshes the layout until
 * it does; the dialog then turns into the welcome by itself.
 *
 * Closing strips `?checkout=done` with a `replace`, so a reload or Back does not
 * congratulate them twice.
 *
 * Needs a `<Suspense>` above it: `useSearchParams` in a layout-level client
 * component opts the tree into client rendering otherwise.
 */
export function PurchaseCelebration({
  accountPlan,
  email,
}: {
  accountPlan: PlanId;
  email: string;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  // Settings → Billing answers `?checkout=done` with its own `ActivationWatch`.
  const returned = params.get("checkout") === "done" && !pathname.startsWith("/settings");

  // Rendered only for the visit that came back from a checkout, so the poll
  // and the dialog's state start fresh each time.
  return returned ? <Celebration accountPlan={accountPlan} email={email} /> : null;
}

function Celebration({ accountPlan, email }: { accountPlan: PlanId; email: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isOpen, setIsOpen] = useState(true);

  const paid = MARKETING_PLANS.find((plan) => plan.id === accountPlan && plan.id !== "free");
  const { waiting } = useActivationPoll(isOpen && !paid);

  const state: CelebrationState = paid
    ? { kind: "active", plan: paid }
    : waiting
      ? { kind: "activating" }
      : { kind: "late" };

  const onClose = () => {
    setIsOpen(false);

    const rest = new URLSearchParams(params.toString());
    rest.delete("checkout");
    const query = rest.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return <CelebrationDialog isOpen={isOpen} state={state} email={email} onClose={onClose} />;
}
