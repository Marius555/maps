import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("plans-and-billing");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * Plans, the lookup allowance, and Settings → Billing and Usage.
 *
 * The plan table mirrors `lib/marketing/plan-rows.ts` and
 * `lib/repositories/plan-limits.ts`; when a limit moves there it moves here in
 * the same commit. Labels are quoted as `components/user-settings/billing/**`
 * draws them.
 */
export default function PlansAndBillingPage() {
  return (
    <DocsArticle
      title="Plans and billing"
      summary="What each plan includes, what an address lookup is, and how to upgrade, change or cancel your plan."
    >
      <DocsSection id="plans" title="The plans">
        <DocsTable
          caption="What each plan includes"
          head={["", "Free", "Starter", "Pro"]}
          rows={[
            ["Price", "€0", "€19 a month, or €190 a year", "€39 a month, or €390 a year"],
            ["Maps", "1", "3", "15"],
            ["Locations on a map", "25", "300", "3,000"],
            ["Areas and routes drawn", "3", "50", "250"],
            ["Views", "Unlimited", "Unlimited", "Unlimited"],
            ["Address lookups a month", "250", "4,000", "50,000"],
            ["Routes with drive times", "—", "Included", "Included"],
            ["Google Sheets sync", "—", "Included", "Included"],
            ["Visitor analytics", "—", "Included", "Included"],
          ]}
        />

        <p>
          Paying yearly gets you two months free. Views are unlimited on every
          plan, the free one included — nobody is counting how often your map is
          opened, and nothing is charged for it.
        </p>
      </DocsSection>

      <DocsSection id="lookups" title="What counts as a lookup">
        <p>
          A lookup is one address turned into a point on the map, or one point
          turned back into an address. They are counted per account and reset on
          the 1st of each month.
        </p>

        <DocsTable
          caption="What uses an address lookup"
          head={["You do this", "It uses"]}
          rows={[
            ["Search for an address", "One lookup per search."],
            [
              "Drop or drag a pin",
              "One lookup, to fill in its street address.",
            ],
            [
              "Import a file",
              "One per distinct address. Rows with latitude and longitude use none, and rows sharing an address share one.",
            ],
            [
              "Sync a Google Sheet",
              "One per new or changed address.",
            ],
            [
              "Open the Route tool",
              "Up to one per location, to check which ones are near a road.",
            ],
          ]}
        />

        <p>
          Lookups that fail on our side aren’t counted. Visitors to your published
          map never use any — their searches run against the locations already on
          it.
        </p>

        <DocsCallout>
          <p>
            Used them all? Searches and imports stop with a message saying so
            until the 1st — or upgrade and carry on straight away. If you see{" "}
            <strong>Address lookups are busy right now</strong>, that isn’t your
            allowance: wait a few minutes and try again. Nothing was lost.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="usage" title="Seeing what you’ve used">
        <p>
          <strong>Settings → Usage</strong> shows four meters against what your
          plan allows: <strong>Maps</strong>, <strong>Locations</strong> (your
          fullest map), <strong>Areas and routes</strong> and{" "}
          <strong>Address lookups</strong>. A meter turns amber at 75% and red at
          90%.
        </p>

        <p>
          Limits are checked whenever you save, so going over isn’t possible.
          Anything that would is refused with a message naming the limit.
        </p>
      </DocsSection>

      <DocsSection id="upgrading" title="Upgrading">
        <DocsSteps>
          <DocsStep title="Choose a plan">
            <p>
              Open <strong>Settings → Billing</strong>, choose{" "}
              <strong>Monthly</strong> or <strong>Yearly</strong>, and press{" "}
              <strong>Upgrade to Starter</strong> or{" "}
              <strong>Upgrade to Pro</strong>. Or start from the{" "}
              <Link href="/pricing">pricing page</Link>.
            </p>
          </DocsStep>

          <DocsStep title="Pay">
            <p>
              Checkout is run by our payment provider, who handle the payment,
              VAT and receipts.
            </p>
          </DocsStep>

          <DocsStep title="Wait a few seconds">
            <p>
              You come back to <strong>Activating your plan</strong>. It usually
              takes a few seconds, and then everything in your new plan is open.
            </p>
          </DocsStep>
        </DocsSteps>
      </DocsSection>

      <DocsSection id="changing" title="Changing plan or billing period">
        <p>
          Already paying? Change plan from the same <strong>Plans</strong> list
          in Settings → Billing — never through a second checkout.
        </p>

        <DocsTable
          caption="Plan changes and when they apply"
          head={["Change", "When it applies"]}
          rows={[
            [
              "Upgrade",
              "Straight away. The difference is added to your next bill.",
            ],
            [
              "Downgrade",
              "At your next renewal. You keep the plan you paid for until then, and Keep Pro (or Starter) cancels the change.",
            ],
            [
              "Monthly to yearly, or back",
              "Press Switch to yearly billing or Switch to monthly billing.",
            ],
            [
              "To Free",
              "Use Cancel plan — see below.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="cancelling" title="Cancelling and resuming">
        <p>
          Press <strong>Cancel plan</strong>, then <strong>Cancel plan</strong>{" "}
          again to confirm. You keep your plan until the end of the period you
          paid for, and aren’t charged again. After that the account moves to
          Free.
        </p>

        <p>
          Changed your mind? Press <strong>Resume plan</strong> any time before
          that date and it renews as normal.
        </p>

        <DocsCallout tone="warning">
          <p>
            On Free, the Free limits apply to what you already have. Nothing is
            deleted and your published maps keep working, but maps, locations and
            shapes over the limit can’t be added to, routes can’t be drawn, sheet
            syncs stop and analytics stops recording.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="payment" title="Card, billing details and invoices">
        <ul>
          <li>
            <strong>Payment method</strong> → <strong>Update</strong> changes the
            card. If a payment didn’t go through, update it here first, then
            change plan.
          </li>
          <li>
            <strong>Billing details</strong> → <strong>Edit</strong> changes your
            billing address, tax ID and the email receipts go to.
          </li>
          <li>
            <strong>Invoices</strong> lists every charge with a{" "}
            <strong>Download</strong> link.
          </li>
        </ul>
      </DocsSection>
    </DocsArticle>
  );
}
