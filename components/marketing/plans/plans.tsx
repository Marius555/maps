import { MARKETING_PLANS, RECOMMENDED_PLAN } from "@/lib/marketing/plans";

import { Reveal } from "../reveal";
import { Section } from "../section";
import { PlanCard } from "./plan-card";

/**
 * The plans — the whole of /pricing.
 *
 * On a page of their own now. They used to close the landing page, where they
 * were the fourth thing competing for one scroll; the landing page's cost
 * calculator carries the argument and ends on a link here.
 *
 * Every button goes to signup. There is no billing behind them yet; when it
 * lands, the buttons change and nothing else here does.
 */
export function Plans() {
  return (
    <Section
      headingLevel="h1"
      eyebrow="Plans"
      title="Priced by what you build, not by who looks at it."
      lede="The limits below are the ones the app enforces — maps, locations, areas. Views are not among them and never will be."
    >
      <ul className="grid gap-5 lg:grid-cols-3">
        {MARKETING_PLANS.map((plan, index) => (
          <li key={plan.id}>
            <Reveal delay={index * 0.06} className="h-full">
              <PlanCard plan={plan} recommended={plan.id === RECOMMENDED_PLAN} />
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
