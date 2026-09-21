import { CreditCard, UserPlus } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { MARKETING_PLANS } from "@/lib/marketing/plans";

/**
 * The two ways `/upgrade` can end up with something to say instead of a redirect.
 *
 * Both are pages somebody reaches while trying to pay us, which is the most
 * expensive moment in the product to be confusing. They name the plan that was
 * chosen — a page that says "sign up to continue" without saying what you were
 * buying reads as having lost it, and the commonest reason people abandon here is
 * suspecting exactly that.
 */

function nameOf(plan: string): string {
  return MARKETING_PLANS.find((entry) => entry.id === plan)?.name ?? plan;
}

const ACTION =
  "rounded-lg px-3 py-2 text-sm font-medium transition-colors";

/**
 * Signed out, with a plan picked.
 *
 * Both doors, not one. Somebody arriving here is either new — in which case the
 * account is the next step — or a returning customer adding a plan to an account
 * they already have, and sending that second person through signup would end at
 * "this address is already registered", which is a dead end at the checkout.
 *
 * The plan is deliberately *not* carried through to signup. Doing that means a
 * redirect target in a query string, and a redirect target in a query string is
 * an open-redirect waiting to be got wrong — a real risk for a saving of one
 * click. The plans are one link away from everywhere.
 */
export function UpgradeSignedOut({ plan }: { plan: string }) {
  return (
    <EmptyState
      icon={UserPlus}
      title={`Start on ${nameOf(plan)}`}
      description="You'll need an account first. It takes a minute, and you can pick your plan straight afterwards."
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/signup"
            className={`${ACTION} bg-accent text-accent-foreground`}
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className={`${ACTION} bg-surface-secondary text-foreground`}
          >
            I already have one
          </Link>
        </div>
      }
    />
  );
}

/**
 * The provider would not open a checkout.
 *
 * The message comes from `BillingError`, which is written for a customer to read
 * and never carries a variable name, a store id or a status line. What this adds
 * is the way out: try again, or tell us. A payment page that fails and offers
 * nothing is a cancelled subscription.
 */
export function UpgradeFailed({
  plan,
  message,
}: {
  plan: string;
  message: string;
}) {
  return (
    <EmptyState
      icon={CreditCard}
      title="Couldn't open the checkout"
      description={`${message} Nothing has been charged.`}
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/upgrade?plan=${plan}`}
            className={`${ACTION} bg-accent text-accent-foreground`}
          >
            Try again
          </Link>
          <Link
            href="/pricing"
            className={`${ACTION} bg-surface-secondary text-foreground`}
          >
            Back to plans
          </Link>
        </div>
      }
    />
  );
}
