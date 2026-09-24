import { Card } from "@heroui/react";

import { LinkButton } from "@/components/ui/link-button";
import { PlanRowList } from "@/components/ui/plan-row-list";
import { planRows } from "@/lib/marketing/plan-rows";
import type { MarketingPlan, PlanCadence } from "@/lib/marketing/plans";

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
 *
 * The rows themselves come from `lib/marketing/plan-rows.ts` and are drawn by
 * `PlanRowList`, because Settings → Billing lists the identical limits beside what the
 * customer is using and the two pages must not word one limit two ways.
 */
export function PlanCard({
  plan,
  recommended,
  cadence,
}: {
  plan: MarketingPlan;
  recommended: boolean;
  cadence: PlanCadence;
}) {
  /*
   * Free has no year to buy, so it prints "€0" under either setting rather than
   * disappearing from the grid or showing a blank price when the toggle moves.
   */
  const yearly = cadence === "yearly" && plan.amountYearly !== undefined;
  const price = yearly ? plan.priceYearly : plan.price;
  const per = yearly ? "a year" : plan.cadence;

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
          {price}
          {per ? (
            <span className="ml-2 font-sans text-sm font-normal tracking-normal text-muted">
              {per}
            </span>
          ) : null}
        </p>

        {/* The saving said as what it is rather than as a percentage, and held
            in the layout either way so the toggle does not move the cards. */}
        <p
          className={`text-xs ${yearly ? "text-accent" : "invisible"}`}
          aria-hidden={!yearly}
        >
          Two months free
        </p>

        <Card.Description>{plan.pitch}</Card.Description>
      </Card.Header>

      <Card.Content>
        <PlanRowList rows={planRows(plan)} />

        <p className="mt-5 text-sm text-pretty text-foreground">
          {plan.highlight}
        </p>
      </Card.Content>

      <Card.Footer className="mt-auto">
        {/*
         * A plain link, and that is what keeps this page statically rendered.
         * `/upgrade` is where the session is read and the checkout is opened; a
         * button here that knew whether you were signed in would make the whole
         * public page dynamic. CLAUDE.md §8: the action keeps its name through
         * the flow, so "Start on Starter" leads to a Starter checkout.
         */}
        <LinkButton
          href={
            plan.id === "free"
              ? "/signup"
              : `/upgrade?plan=${plan.id}&cadence=${cadence}`
          }
          fullWidth
          variant={recommended ? undefined : "secondary"}
        >
          {plan.id === "free" ? "Sign up free" : `Start on ${plan.name}`}
        </LinkButton>
      </Card.Footer>
    </Card>
  );
}
