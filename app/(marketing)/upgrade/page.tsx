import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  UpgradeFailed,
  UpgradeSignedOut,
} from "@/components/billing/upgrade-notice";
import { Section } from "@/components/marketing/section";
import { getCurrentUser } from "@/lib/auth/current-user";
import { BillingError, getBilling } from "@/lib/billing";
import { checkoutSchema } from "@/lib/validation/billing.schema";

export const metadata: Metadata = { title: "Upgrade", robots: { index: false } };

/**
 * The door between the pricing page and the provider's checkout.
 *
 * **It exists so `/pricing` can stay statically rendered**, which is not a detail
 * — that page loads for strangers and is prerendered, and it imports
 * `lib/marketing/plans.ts` precisely because the enforcing table is `server-only`
 * and would drag the admin Appwrite client into a static build. A "Start on
 * Starter" button that had to know whether you were signed in would undo all of
 * it. So the button stays a plain link and everything needing a session happens
 * here, one navigation later.
 *
 * **In the marketing group rather than the dashboard one, deliberately.** The
 * dashboard's layout redirects anyone without a session straight to `/login`,
 * before a page in it gets to run — so a signed-out visitor pressing a plan would
 * be bounced to a login form with no idea what became of their choice. Here the
 * page decides for itself, and can say what they were buying.
 *
 * A GET that creates a checkout is deliberate and worth defending: nothing is
 * charged and nothing is written. The provider's page is where a decision gets
 * made; this only opens it.
 */
export default async function UpgradePage(props: PageProps<"/upgrade">) {
  const search = await props.searchParams;

  const parsed = checkoutSchema.safeParse({
    plan: search.plan,
    cadence: search.cadence,
  });

  // A hand-typed or stale link. The plans are the only place to go from here.
  if (!parsed.success) redirect("/pricing");

  const user = await getCurrentUser();

  if (!user) {
    return (
      <Section eyebrow="Plans" headingLevel="h1" title="Nearly there">
        <UpgradeSignedOut plan={parsed.data.plan} />
      </Section>
    );
  }

  /*
   * The `try` wraps only the call and returns no JSX. React renders children
   * after this function returns, so a `catch` around JSX never fires — the rule
   * the lint config enforces and that `maps/[id]/settings/page.tsx` documents.
   */
  let url: string;

  try {
    const checkout = await getBilling().createCheckout({
      plan: parsed.data.plan,
      cadence: parsed.data.cadence,
      email: user.email,
      userId: user.id,
    });

    url = checkout.url;
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    /*
     * A page, not a thrown error. The person here is trying to give us money and
     * the one thing they must not meet is an error boundary. `BillingError`'s own
     * text is written to be read by them.
     */
    return (
      <Section eyebrow="Plans" headingLevel="h1" title="Something went wrong">
        <UpgradeFailed plan={parsed.data.plan} message={error.message} />
      </Section>
    );
  }

  /*
   * Outside the try, because `redirect` works by throwing — inside it, every
   * successful checkout would be caught and turned into the failure page above.
   */
  redirect(url);
}
