import type { Metadata } from "next";

import { Compare } from "@/components/marketing/compare/compare";
import { FlatCost } from "@/components/marketing/cost/flat-cost";
import { Hero } from "@/components/marketing/hero/hero";
import { MapShowcase } from "@/components/marketing/hero/map-showcase";
import { Legend } from "@/components/marketing/legend/legend";
import { SnapScroll } from "@/components/marketing/snap-scroll";
import { Steps } from "@/components/marketing/steps/steps";
import { PRODUCT_NAME } from "@/lib/config";

const DESCRIPTION =
  "Import your locations from a spreadsheet, style the map, and paste one line of code into your site. No API keys, no developer, and unlimited views on every plan.";

export const metadata: Metadata = {
  // Absolute, so the front page is not "Pinglide · Pinglide" under the root
  // layout's `%s · Pinglide` template.
  title: { absolute: `${PRODUCT_NAME} — a store locator for your own site` },
  description: DESCRIPTION,
  openGraph: {
    title: `${PRODUCT_NAME} — a store locator for your own site`,
    description: DESCRIPTION,
    type: "website",
  },
};

/**
 * The landing page.
 *
 * Read by its section labels alone it says: *key*, *sequence*, *scale*,
 * *survey* — which is how a map sheet is labelled, and is the page's whole
 * structure. The hero is the thesis and everything under it is detail, in the
 * order somebody buying this actually asks: what do my visitors get, how much
 * work is it, what does it cost, and what else could I buy instead.
 *
 * No testimonials and no logo cloud. There are no customers yet, and the one
 * thing that would make a page like this worthless is inventing either. The
 * same rule governs the survey at the bottom: it compares against *categories*
 * at published prices, and names nobody.
 *
 * **`mk-snap` is what makes the page scroll a section at a time.** The class
 * does nothing on its own — `html:has(.mk-snap)` in globals.css is what turns
 * snapping on, and only here, because /pricing, /docs and the legal pages share
 * this shell and are ordinary documents. Each section holds a viewport
 * (`screen` on `Section`) and each one is a snap point.
 *
 * **Six children, not five: the map has a screen of its own.** It used to sit
 * inside the hero, sharing one screen with the headline, the lede and the
 * buttons — and the words won, leaving the map on its 15rem floor. The hero is
 * the claim and `MapShowcase` is the evidence, and each gets a screen. Every
 * section fitting its screen is also what lets the snap be *mandatory* rather
 * than the proximity it had settled for; docs/notes/marketing.md has the
 * measurements.
 *
 * **`SnapScroll` brings that snap forward to the start of the gesture.** CSS
 * snapping is defined to act when a scroll *ends*, which on a page of whole
 * screens reads as arriving almost at a section and then being tugged into it.
 * It renders nothing, handles the wheel alone, and is off below `lg`, where
 * there is no snap at all — so a phone, a keyboard, a touch and a page with no
 * JavaScript are all exactly as they were.
 *
 * It ends on the survey, whose two buttons — see the plans, start free — are
 * the ask. The plans are on /pricing: three cards of limits at the foot of this
 * page were another argument in a scroll that had made its case.
 */
export default function LandingPage() {
  return (
    <div className="mk-snap">
      <Hero />
      <MapShowcase />
      <Legend />
      <Steps />
      <FlatCost />
      <Compare />

      {/* Renders nothing; see the note above. Last, so the `:first-child` rule
          that exempts the hero from being a snap stop cannot be affected. */}
      <SnapScroll />
    </div>
  );
}
