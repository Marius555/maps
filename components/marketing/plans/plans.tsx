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
 *
 * **One screen, opening on the cards**: no eyebrow, no lede and no visible
 * title — the navbar's "Pricing" link already said where the visitor was
 * going, so the h1 is for screen readers and search only. `fill` centres the
 * toggle, the cards and the discount row in the viewport under the header.
 */
export function Plans() {
  return (
    <Section headingLevel="h1" fill hideTitle title="Priced by what you build, not by who looks at it.">
      <PlanGrid />
    </Section>
  );
}
