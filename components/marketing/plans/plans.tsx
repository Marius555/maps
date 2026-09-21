import { Section } from "../section";
import { PlanGrid } from "./plan-grid";

/**
 * The plans — the whole of /pricing.
 *
 * On a page of their own now. They used to close the landing page, where they
 * were the fourth thing competing for one scroll; the landing page's cost
 * calculator carries the argument and ends on a link here.
 *
 * The grid below is a client component because of the monthly/yearly toggle, and
 * the page stays statically rendered all the same — see `plan-grid.tsx`. The
 * paid cards link to `/upgrade`, which is where a session is read and a checkout
 * is opened; nothing on this page knows whether anybody is signed in, which is
 * what keeps it prerenderable.
 */
export function Plans() {
  return (
    <Section
      headingLevel="h1"
      eyebrow="Plans"
      title="Priced by what you build, not by who looks at it."
      lede="The limits below are the ones the app enforces — maps, locations, areas. Views are not among them and never will be."
    >
      <PlanGrid />
    </Section>
  );
}
