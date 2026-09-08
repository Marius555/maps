import { ChartColumn, Radio, Rocket } from "lucide-react";
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
 * 1. **Never published.** There is no map on anybody's website yet, so there is
 *    nobody to measure. Publishing is the action.
 * 2. **Published, measurement off.** The switch is the action, and it lives in
 *    the Publish designer beside everything else that changes what the embed
 *    does.
 * 3. **On and waiting.** Nothing is wrong. Saying so plainly is the whole job —
 *    the failure mode here is a customer who turned it on, saw an empty page and
 *    concluded it was broken.
 */

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
      description="Your map is live, but it isn't reporting anything. Switch on visitor analytics in the Publish designer and publish again to start seeing what people search for and which locations they open."
      action={
        <Link
          href={`/maps/${mapId}/publish`}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          Turn it on
        </Link>
      }
    />
  );
}

export function NoVisitsYetEmpty({ range }: { range: string }) {
  return (
    <EmptyState
      icon={ChartColumn}
      title={`No visits in the ${range.toLowerCase()}`}
      description="Your map is live and measuring. Figures appear here once somebody loads it on your site — there's nothing to fix."
    />
  );
}
