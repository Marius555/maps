"use client";

import { useState } from "react";

import { PRODUCT_NAME } from "@/lib/config";
import {
  DEFAULT_VIEWS,
  costVerdict,
  meteredMonthly,
  positionOf,
  verdictSizers,
  viewsAt,
} from "@/lib/marketing/cost";
import { MARKETING_PLANS, RECOMMENDED_PLAN } from "@/lib/marketing/plans";

import { CostBar } from "./cost-bar";
import { CostCard, CostCardBars } from "./cost-card";
import { CostSummary } from "./cost-summary";
import { ViewsSlider } from "./views-slider";
import { WorthChart } from "./worth-chart";

/** The plan the calculator compares against: the one the pricing page leads with. */
const PLAN = MARKETING_PLANS.find((plan) => plan.id === RECOMMENDED_PLAN)!;

/**
 * Every sentence the verdict can be at this plan, so the room for the longest
 * is taken once rather than found mid-drag. Module scope: it depends on nothing
 * the slider changes.
 */
const VERDICT_SIZERS = verdictSizers(PLAN.amount);

/**
 * Drag to your traffic; watch one bill climb and the other stay put.
 *
 * One axis, two cards. The version before it drew visitors and bills as two
 * stacked charts with no numbers on either, which asked the reader to do the
 * comparison the page existed to make. Here the reader's own number goes in and
 * the two prices come out.
 *
 * **Two cards, and they used to be one.** The panel held a two-column grid, and
 * a grid does not make rows agree — it makes columns. Measured, the two halves
 * opened on rows of different heights and never recovered: the left column's
 * first bar was 78px below the right column's, on a panel whose whole point is
 * that the two sides are read against each other. Two `CostCard`s in a stretch
 * grid, both built from the same header and the same bottom-pinned bar block,
 * line up by construction; see cost-card.tsx.
 *
 * **One slider still drives both**, which is why it is two cards and not two
 * sections: they are one instrument. They stack below `lg`, where two columns
 * of small bars would be two columns of nothing.
 *
 * The verdict spans the full width underneath, outside both cards, because it
 * is a sentence rather than a chart and a sentence in a column is a column of
 * broken lines.
 */
export function CostCalculator() {
  const [position, setPosition] = useState(() => positionOf(DEFAULT_VIEWS));

  const views = viewsAt(position);
  const metered = meteredMonthly(views);
  const scale = Math.max(metered, PLAN.amount);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <CostCard>
          <ViewsSlider position={position} onChange={setPosition} />

          <CostCardBars>
            <CostBar
              label="Metered map platform"
              amount={metered}
              currency="$"
              share={metered / scale}
              emphasis={false}
            />
            <CostBar
              label={`${PRODUCT_NAME} ${PLAN.name}`}
              amount={PLAN.amount}
              currency="€"
              share={PLAN.amount / scale}
              emphasis
            />
          </CostCardBars>
        </CostCard>

        <CostCard>
          <WorthChart views={views} flat={PLAN.amount} />
        </CostCard>
      </div>

      <CostSummary
        verdict={costVerdict(views, PLAN.amount)}
        sizers={VERDICT_SIZERS}
      />
    </div>
  );
}
