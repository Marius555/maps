import { Card } from "@heroui/react";
import { Check, Minus } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import type { MarketingPlan } from "@/lib/marketing/plans";

const NUMBERS = new Intl.NumberFormat("en-GB");

/**
 * One plan.
 *
 * The recommended one is marked by a ring and a word, not by being bigger
 * or brighter than its neighbours — a card that grows to sell itself makes the
 * other two look like mistakes, and two of the three are the right answer for
 * somebody.
 *
 * Every number comes from `MARKETING_PLANS`, which a test holds to the
 * repositories' own table. Nothing here is written by hand.
 */
export function PlanCard({
  plan,
  recommended,
}: {
  plan: MarketingPlan;
  recommended: boolean;
}) {
  return (
    <Card
      /*
       * A ring, not `border-accent`. HeroUI's card draws no border at all
       * (`border-width: 0`), so a border *colour* was measured to paint nothing
       * and the recommended plan was marked only by its button. A ring is a box
       * shadow, which the card also leaves empty, and it costs no layout — a
       * 2px border would have made this card's content sit 2px in from its
       * neighbours'.
       */
      className={`h-full ${recommended ? "ring-2 ring-accent" : ""}`}
    >
      <Card.Header>
        <div className="flex items-baseline justify-between gap-3">
          <Card.Title>{plan.name}</Card.Title>
          {recommended ? (
            <span className="font-mono text-xs tracking-wider text-accent uppercase">
              Most people
            </span>
          ) : null}
        </div>

        <p className="mk-display mt-2 text-4xl text-foreground">
          {plan.price}
          {plan.cadence ? (
            <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted">
              {plan.cadence}
            </span>
          ) : null}
        </p>

        <Card.Description>{plan.pitch}</Card.Description>
      </Card.Header>

      <Card.Content>
        <dl className="space-y-2.5 border-t border-border pt-5 text-sm">
          <Quantity label="Maps" value={plan.maps} />
          <Quantity label="Locations on a map" value={plan.places} />
          <Quantity label="Areas and routes drawn" value={plan.shapes} />
          <Feature label="Views" on note="Unlimited" />
          <Feature label="Routes with drive times" on={plan.routes} />
          <Feature label="Google Sheets sync" on={plan.sheetSync} />
        </dl>

        <p className="mt-5 text-sm text-pretty text-foreground">
          {plan.highlight}
        </p>
      </Card.Content>

      <Card.Footer className="mt-auto">
        <LinkButton
          href="/signup"
          fullWidth
          variant={recommended ? undefined : "secondary"}
        >
          {plan.id === "free" ? "Sign up free" : `Start on ${plan.name}`}
        </LinkButton>
      </Card.Footer>
    </Card>
  );
}

function Quantity({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono text-[0.8125rem] text-foreground">
        {NUMBERS.format(value)}
      </dd>
    </div>
  );
}

/**
 * A feature, with the icon *and* the word — never the tick alone.
 *
 * A row that says only "Routes" beside a grey tick asks the reader to work out
 * which state they are looking at from a colour, which is exactly what the
 * quality floor rules out.
 */
function Feature({
  label,
  on,
  note,
}: {
  label: string;
  on: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`flex items-center gap-1.5 text-[0.8125rem] ${
          on ? "text-foreground" : "text-muted"
        }`}
      >
        {on ? (
          <Check aria-hidden="true" className="size-3.5 text-accent" />
        ) : (
          <Minus aria-hidden="true" className="size-3.5" />
        )}
        {note ?? (on ? "Included" : "Not on this plan")}
      </dd>
    </div>
  );
}
