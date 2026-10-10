import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";
import { BRAND } from "@/lib/brand";

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
            [`“Made with ${BRAND.name}” badge`, "Shown", "Removed", "Removed"],
          ]}
        />

        <p>
          Yearly billing gets two months free. Views are unlimited and free on
          every plan. On Starter and Pro the{" "}
          <strong>Made with {BRAND.name}</strong> link goes the next time you
          publish.
        </p>
      </DocsSection>

      <DocsSection id="lookups" title="What counts as a lookup">
        <p>
          A lookup turns one address into a point, or one point into an address.
          They are counted per account and reset on the 1st of each month.
        </p>

        <DocsTable
          caption="What uses an address lookup"
          head={["You do this", "It uses"]}
          rows={[
            ["Search for an address", "One lookup per search."],
            [
              "Drop or drag a pin",
              "One, to fill in its street address.",
            ],
            [
              "Import a file",
              "One per distinct address; rows with latitude and longitude use none.",
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
          Lookups that fail on our side aren’t counted, and visitors to your map
          never use any.
        </p>

        <DocsCallout>
          <p>
            Used them all? Searches and imports stop until the 1st, or upgrade to
            carry on. <strong>Address lookups are busy right now</strong> isn’t
            your allowance — try again in a few minutes.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="usage" title="Seeing what you’ve used">
        <p>
          <strong>Settings → Usage</strong> meters <strong>Maps</strong>,{" "}
          <strong>Locations</strong> (your fullest map),{" "}
          <strong>Areas and routes</strong> and <strong>Address lookups</strong>{" "}
          against your plan — amber at 75%, red at 90%. Anything that would go
          over is refused with a message naming the limit.
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
              Our payment provider handles the payment, VAT and receipts.
            </p>
          </DocsStep>

          <DocsStep title="Wait a few seconds">
            <p>
              <strong>Activating your plan</strong> usually takes a few seconds.
            </p>
          </DocsStep>
        </DocsSteps>
      </DocsSection>

      <DocsSection id="changing" title="Changing plan or billing period">
        <p>
          Already paying? Change plan from the <strong>Plans</strong> list in
          Settings → Billing, not a second checkout.
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
              "At your next renewal. Keep Pro (or Starter) cancels the change.",
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
          Press <strong>Cancel plan</strong> twice. You keep your plan to the end
          of the paid period, then move to Free. <strong>Resume plan</strong>{" "}
          before then undoes it.
        </p>

        <DocsCallout tone="warning">
          <p>
            On Free, nothing is deleted and published maps keep working, but you
            can’t add past the Free limits, draw routes, sync sheets or record
            analytics.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="payment" title="Card, billing details and invoices">
        <ul>
          <li>
            <strong>Payment method</strong> → <strong>Update</strong> changes the
            card — do this first if a payment failed.
          </li>
          <li>
            <strong>Billing details</strong> → <strong>Edit</strong> changes the
            billing address, tax ID and receipt email.
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
