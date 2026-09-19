import { Reveal } from "../reveal";
import { Section } from "../section";
import { CostCalculator } from "./cost-calculator";

/**
 * The one argument nobody else on this market can make, as something to try
 * rather than something to look at.
 *
 * It has been two cards of prices, then two stacked charts with no numbers;
 * the first made the point in small print and the second asked the reader to
 * find it. The calculator takes the reader's own traffic and gives back both
 * bills.
 *
 * Why it is true is CLAUDE.md §2, and it is structural rather than generous:
 * publishing writes a static file, the embed reads that file and static tiles,
 * and nothing we are billed for runs when a visitor opens the map.
 *
 * The page ends here. The plans have their own page now, and the calculator's
 * two buttons are the way to it and the way in.
 */
export function FlatCost() {
  return (
    <Section
      screen
      eyebrow="Scale"
      title="Your bill does not move when your traffic does."
      lede="Drag to your traffic. Map platforms bill every load; we don't count them."
    >
      <Reveal>
        <CostCalculator />
      </Reveal>
    </Section>
  );
}
