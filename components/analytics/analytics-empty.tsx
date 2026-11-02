import {
  ArrowRight,
  Lock,
  Power,
  Radio,
  Rocket,
} from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";

/**
 * The three ways this page can have nothing on it.
 *
 * They are three states and not one, because the fix is different in each and an
 * empty state that does not name the fix is just a blank page with a sentence.
 * The Locations list already draws this distinction between "nothing at all" and
 * "nothing matched"; here there are three:
 *
 * 1. **Not on this plan.** Checked first, ahead of everything below, because it
 *    is the only one of the three where the others cannot be reached at all — and
 *    sending somebody to publish a map, then telling them once they have that the
 *    tab was never theirs, is two dead ends in a row.
 * 2. **Never published.** There is no map on anybody's website yet, so there is
 *    nobody to measure. Publishing is the action.
 * 3. **Published, measurement off.** The switch is the action, and it lives in
 *    the Publish designer beside everything else that changes what the embed
 *    does.
 *
 * A measuring map with no visits in the period is **not** one of them: it is
 * the dashboard drawn at zero (the page's `Report`), because a quiet week on a
 * map that had visits last month is a figure, not a missing page.
 */

/**
 * The plan does not include this tab.
 *
 * The description says the part nobody would guess and everybody would resent
 * finding out later: a free map is not *recorded*, so upgrading starts the
 * history on the day it happens. There is no backfill to wait for, and implying
 * otherwise by staying quiet would be the kind of small dishonesty that reads as
 * a bug a week later.
 */
export function PlanRequiredEmpty({ note }: { note: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Analytics is on the paid plans"
      description={`${note} Upgrade to see what visitors search for, which locations they open and where they are. Free maps aren't measured, so figures start from the day you upgrade.`}
      action={
        // Settings → Billing, not `/pricing`: a signed-in owner changes plan
        // there, and inside the Shopify admin it is the page that leads to
        // Shopify's plan page — `/pricing` sells Lemon checkouts in euros.
        <Link
          href="/settings/billing"
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          See plans
        </Link>
      }
    />
  );
}

export function NotPublishedEmpty({ mapId }: { mapId: string }) {
  return (
    <EmptyState
      icon={Rocket}
      title="Nothing to measure yet"
      description="This map isn't on a website yet, so there's nobody using it. Publish it and paste the snippet into your site, then come back here."
      action={
        <Link
          href={`/maps/${mapId}/publish`}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          Publish this map
        </Link>
      }
    />
  );
}

export function MeasurementOffEmpty({ mapId }: { mapId: string }) {
  return (
    <EmptyState
      icon={Radio}
      title="Measurement is off"
      description="Your map is live, but it isn't reporting anything. Turn on visitor analytics, then publish to start seeing what people search for and which locations they open."
      surface={false}
      action={
        <Link
          href={`/maps/${mapId}/publish?analytics=on`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          <Power aria-hidden="true" className="size-4" />
          Turn it on
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    />
  );
}

