import { LinkButton } from "@/components/ui/link-button";
import { MARKETING_PLANS } from "@/lib/marketing/plans";

/**
 * The two ways `/upgrade` can end up with something to say instead of a redirect.
 *
 * Both are pages somebody reaches while trying to pay us, which is the most
 * expensive moment in the product to be confusing. They name the plan that was
 * chosen — a page that says "sign up to continue" without saying what you were
 * buying reads as having lost it, and the commonest reason people abandon here is
 * suspecting exactly that.
 *
 * **One title, one sentence, two buttons, on the page's own ground.** These
 * used to sit inside a marketing section (an eyebrow, a second title above the
 * real one) and a grey panel with grey buttons, which made a one-step page read
 * like a form that had failed to load.
 */

function nameOf(plan: string): string {
  return MARKETING_PLANS.find((entry) => entry.id === plan)?.name ?? plan;
}

function Notice({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <h1 className="mk-display text-3xl text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-3 text-pretty text-muted">{children}</p>
        <div className="mt-7 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
          {actions}
        </div>
      </div>
    </div>
  );
}

/** This page's own address, which is where signing up or in brings them back. */
function upgradeHref(plan: string, cadence: string, code?: string): string {
  return `/upgrade?plan=${plan}&cadence=${cadence}${code ? `&code=${code}` : ""}`;
}

/**
 * Signed out, with a plan picked.
 *
 * Both doors, not one. Somebody arriving here is either new — in which case the
 * account is the next step — or a returning customer adding a plan to an account
 * they already have, and sending that second person through signup would end at
 * "this address is already registered", which is a dead end at the checkout.
 *
 * **Both carry the choice back here as `?next=`**, so the checkout opens the
 * moment there is an account — plan, cadence and discount code intact. This used
 * to be withheld as an open redirect waiting to happen; `/signup` and `/login`
 * now pass every `next` through `safeRedirect`, which allows same-site paths only,
 * and the WordPress connect flow already relies on the same thing. Without it a
 * new customer finished signing up and landed in the dashboard with no idea
 * what had become of the plan they were buying.
 */
export function UpgradeSignedOut({
  plan,
  cadence,
  code,
}: {
  plan: string;
  cadence: string;
  code?: string;
}) {
  const next = encodeURIComponent(upgradeHref(plan, cadence, code));

  return (
    <Notice
      title={`Start on ${nameOf(plan)}`}
      actions={
        <>
          <LinkButton href={`/signup?next=${next}`}>Create an account</LinkButton>
          <LinkButton href={`/login?next=${next}`} variant="outline">
            I already have one
          </LinkButton>
        </>
      }
    >
      {code
        ? `You'll need an account first. It takes a minute, and the checkout opens straight afterwards with your discount code ${code} applied.`
        : "You'll need an account first. It takes a minute, and the checkout opens straight afterwards."}
    </Notice>
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
  cadence,
  code,
  message,
}: {
  plan: string;
  /** Carried into Try again, or a failed yearly checkout retries as monthly. */
  cadence: string;
  /** Carried into Try again too, so a retry keeps the discount. */
  code?: string;
  message: string;
}) {
  return (
    <Notice
      title="Couldn't open the checkout"
      actions={
        <>
          <LinkButton href={upgradeHref(plan, cadence, code)}>
            Try again
          </LinkButton>
          <LinkButton href="/pricing" variant="outline">
            Back to plans
          </LinkButton>
        </>
      }
    >
      {message} Nothing has been charged.
    </Notice>
  );
}
