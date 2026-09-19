import { LinkButton } from "@/components/ui/link-button";
import { MARKETING_PLANS, RECOMMENDED_PLAN } from "@/lib/marketing/plans";

import { Reveal } from "../reveal";
import { Section } from "../section";
import { BillChartLoader } from "./bill-chart-loader";
import { BillTable } from "./bill-table";

/** The plan the page compares with, the same one the calculator above uses. */
const PLAN = MARKETING_PLANS.find((plan) => plan.id === RECOMMENDED_PLAN)!;

/**
 * Where this sits against the two ways a store locator is normally bought.
 *
 * **Eyebrow: "Survey".** The page is labelled like a map sheet — key, sequence,
 * scale — and a survey is what you do to the ground around you before you draw
 * any of it.
 *
 * **Three lines, where there used to be nine bars.** The section's claim is
 * about a *shape* — two bills that climb with your traffic and one that does
 * not — and three separately scaled bar columns made the reader assemble that
 * shape from three snapshots. It is also the page's fourth bar chart in a row,
 * which is a page that has stopped choosing forms. See bill-chart.tsx, and
 * bill-table.tsx for why the numbers are still printed underneath.
 *
 * The section the page ends on, and it ends on the ask: the two buttons that
 * used to sit under the calculator are here, after the last argument rather
 * than in the middle of the scroll.
 */
export function Compare() {
  return (
    <Section
      screen
      eyebrow="Survey"
      title="Everyone else’s bill has your traffic in it."
      lede="Two ways this is normally bought: a metered map you build on, or a locator product you still connect your own map key to. Both are priced by how many people look."
    >
      <Reveal>
        <div className="mk-panel space-y-4 rounded-2xl p-5 sm:p-6 lg:p-7">
          {/* The table is beside the chart rather than under it, and that is a
              height decision as much as a reading one: stacked, the two came to
              503px and put this section 235px past the screen it has to hold.
              Beside it, the table reads as the chart's key — the same three
              dots, the exact figures the curves only show the shape of. */}
          <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-center lg:gap-10">
            <BillChartLoader flat={PLAN.amount} />

            <div className="space-y-2.5">
              <BillTable flat={PLAN.amount} />
              <p className="text-[0.6875rem]/4 text-pretty text-muted">
                Both axes step by ten. Metered at $7 per 1,000 loads before any
                free allowance; the locator figure is a published mid-tier
                subscription plus the loads your own key is billed for. Those
                publish in dollars; ours is €{PLAN.amount} at every point.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-foreground/[0.08] pt-4 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-xl text-base/6 font-medium text-pretty text-foreground">
              A hundred times the traffic, the same €{PLAN.amount}. That is not a
              discount — publishing writes a file, and nobody bills us when
              somebody opens your map.
            </p>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <LinkButton href="/pricing">See plans</LinkButton>
              <LinkButton href="/signup" variant="tertiary">
                Start free
              </LinkButton>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
