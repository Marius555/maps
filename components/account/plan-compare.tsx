"use client";

import { toast } from "@heroui/react";
import { useState } from "react";

import { CadenceToggle } from "@/components/ui/cadence-toggle";
import type { BillingStanding } from "@/lib/billing/standing";
import { MARKETING_PLANS, type PlanCadence } from "@/lib/marketing/plans";
import { useChangePlan } from "@/lib/query/billing";
import { formatDate } from "@/lib/format/date";
import { toastError } from "@/lib/query/toast-error";
import { isEmailUnverified } from "@/lib/query/verify-email-toast";
import type { PlanId } from "@/lib/repositories/plan-limits";
import {
  nameOf,
  PlanAction,
  planActionFor,
  planNoteFor,
  type PendingChange,
} from "./plan-action";
import { PlanChangeNotice } from "./plan-change-notice";
import { PlanColumn } from "./plan-column";

/**
 * Free, Starter and Pro side by side, with this account's own marked — and the
 * place a plan is actually changed.
 *
 * **This is what replaced a link to `/pricing`.** Sending a signed-in customer to
 * the public pricing page to find out what their next plan gives them is sending
 * them to a page written for somebody who has never heard of us, and then making
 * them come back. The same three columns belong here, where they can be read
 * against the meters above them.
 *
 * **The toggle starts on the cadence this account actually pays**, not on
 * monthly. It used to be hard-coded, so a yearly customer was shown monthly
 * prices and had no way to see the button that moves them back — and a monthly
 * one, flipping it, found their own column saying only "this is what you're on".
 * Moving it now offers the switch.
 *
 * **One mutation for all three columns**, held here rather than in each: a
 * change is one thing happening to one subscription, and three independent
 * mutation states would let a second press start while the first was still in
 * flight.
 *
 * **A downgrade waits for the renewal**, and while it does the paid plan keeps
 * "Your plan", its column offers "Keep …", and `PlanChangeNotice` under the
 * columns says what changes and when — see `planChange` for why the wait is
 * ours rather than the provider's.
 *
 * The cadence is state rather than a query parameter, the same choice `/pricing`
 * makes, because an account page with two URLs is a Back button that lands
 * somewhere the reader did not leave.
 */
export function PlanCompare({
  plan,
  currentCadence,
  standing,
  pending,
  renewsOn,
  portalUrl,
}: {
  /** The plan the columns mark as this account's — the one paid for this period. */
  plan: PlanId;
  /** What this period was paid at, or null when there is none or it is unknown. */
  currentCadence: PlanCadence | null;
  standing: BillingStanding;
  /** A downgrade booked for the renewal, or null. */
  pending: PendingChange | null;
  /** The next renewal, or null when none is known. */
  renewsOn: string | null;
  portalUrl: string | null;
}) {
  const [cadence, setCadence] = useState<PlanCadence>(currentCadence ?? "monthly");
  const changePlan = useChangePlan();

  const current =
    MARKETING_PLANS.find((entry) => entry.id === plan) ?? MARKETING_PLANS[0];
  const next = MARKETING_PLANS.find((entry) => entry.places > current.places);

  const onChange = (target: PlanId, label: string) => {
    if (target === "free") return;

    changePlan.mutate(
      { plan: target, cadence },
      {
        /*
         * The toast keeps the button's own words in the past tense — "Upgrade
         * to Pro" becomes "Upgraded to Pro" — per CLAUDE.md §8's rule that an
         * action keeps its name through the whole flow.
         */
        onSuccess: (result) =>
          toast.success(pastTense(label), {
            description: result.kept
              ? result.kept.plan === result.plan
                ? `Your ${result.kept.cadence ?? "current"} billing runs until ${formatDate(result.kept.until)}.`
                : `You keep ${nameOf(result.kept.plan)} until ${formatDate(result.kept.until)}.`
              : label.startsWith("Keep ")
                ? "Nothing changes at your renewal."
                : "The difference is added to your next bill.",
          }),
        onError: (error) => {
          // Already raised once, globally, by the MutationCache.
          if (isEmailUnverified(error)) return;

          toastError(error, "Couldn't change your plan");
        },
      },
    );
  };

  return (
    <section className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {next ? "Room to grow" : "Your plan"}
          </h2>
          <p className="mt-1 text-sm text-pretty text-muted">
            {next
              ? `You're on ${current.name}. ${next.name} takes you to ${describe(next)}.`
              : "You're on the largest plan, so everything in the product is switched on."}
          </p>
        </div>

        <CadenceToggle
          value={cadence}
          onChange={setCadence}
          className="shrink-0"
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {MARKETING_PLANS.map((entry) => {
          const kind = planActionFor({
            plan: entry,
            cadence,
            current: plan,
            currentCadence,
            standing,
            pending,
          });

          // Nothing to say is an absent footer, not an empty padded one.
          const hasAction =
            kind !== null && !(kind === "cancel-in-portal" && !portalUrl);

          return (
            <PlanColumn
              key={entry.id}
              plan={entry}
              current={entry.id === plan}
              cadence={cadence}
              against={current}
              note={planNoteFor({
                kind,
                plan: entry,
                cadence,
                current: plan,
                currentCadence,
                pending,
                renewsOn,
              })}
              action={
                hasAction ? (
                  <PlanAction
                    kind={kind}
                    plan={entry}
                    cadence={cadence}
                    current={plan}
                    currentCadence={currentCadence}
                    pending={pending}
                    portalUrl={portalUrl}
                    isPending={
                      changePlan.isPending && changePlan.variables?.plan === entry.id
                    }
                    isBusy={changePlan.isPending}
                    onChange={(label) => onChange(entry.id, label)}
                  />
                ) : null
              }
            />
          );
        })}
      </div>

      {pending ? (
        <PlanChangeNotice current={plan} currentCadence={currentCadence} pending={pending} />
      ) : null}

      <p className="mt-4 text-xs text-muted">
        Views are unlimited on every plan, including the free one. We are priced
        by what you build, never by how many people look at it.
      </p>
    </section>
  );
}

/**
 * The next plan up, in the two numbers most people are actually short of.
 *
 * Maps and locations rather than the whole row list, because the columns below
 * carry that and a lede that repeats them is a lede nobody reads.
 */
function describe(plan: { maps: number; places: number }): string {
  return `${String(plan.maps)} maps and ${String(plan.places)} locations on each of them`;
}

/** "Upgrade to Pro" → "Upgraded to Pro"; "Keep Pro" → "Kept Pro". */
function pastTense(label: string): string {
  return label
    .replace(/^Keep /, "Kept ")
    .replace(/^Upgrade /, "Upgraded ")
    .replace(/^Downgrade /, "Downgraded ")
    .replace(/^Switch /, "Switched ");
}
