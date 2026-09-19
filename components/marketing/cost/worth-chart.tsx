"use client";

import { PRODUCT_NAME } from "@/lib/config";
import { worthSegments, worthTotal } from "@/lib/marketing/compare";

import { MIN_SHARE } from "../min-share";
import { Amount } from "./cost-bar";
import { CostCardBars, CostCardHeader } from "./cost-card";
import { WorthStack } from "./worth-stack";

const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * The other half of the argument: not what the plan costs, but what it stands
 * in for.
 *
 * The calculator beside this one answers "how much cheaper", which is only ever
 * a number. This answers "instead of what" — a month of doing it the usual way
 * is three bills, and the one beside it is the whole of ours. Both read off the
 * same slider, because a chart that did not move while the other one did would
 * look broken.
 *
 * Every figure is a published list price except the setup line, which is an
 * assumption and is drawn and written as one (lib/marketing/compare.ts has the
 * sources). The stack is our own ink at three weights; the accent is spent on
 * the one bar the section is about.
 *
 * **The total moved up into the header row and is not repeated.** It used to be
 * a `text-sm` row of its own beside "Doing it the usual way", three rows below
 * where the card next door put *its* big number — which is what made the two
 * halves read as two unrelated panels. It is stated once, at the top, in the
 * same row and the same size as "50,000" beside it; the row down in the bars
 * carries the label and the stack alone, because the three amounts that make
 * the total up are itemised in the middle of the card.
 */
export function WorthChart({ views, flat }: { views: number; flat: number }) {
  const segments = worthSegments(views);
  const total = worthTotal(views);
  const share = total > 0 ? flat / total : 0;

  return (
    <>
      <CostCardHeader
        label="What the flat plan replaces"
        value={<Amount value={total} currency="$" />}
      />

      <ul className="mt-4 space-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.id}
            className="flex items-baseline justify-between gap-4 text-xs text-muted"
          >
            <span>
              {segment.label}
              {segment.assumed ? (
                <span className="text-foreground/40"> · assumed</span>
              ) : null}
            </span>
            <span className="tabular-nums">
              ${MONEY.format(segment.amountUsd)}
            </span>
          </li>
        ))}
      </ul>

      <CostCardBars>
        <div>
          <p className="text-sm text-muted">Doing it the usual way</p>
          <div className="mt-2">
            <WorthStack segments={segments} total={total} />
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="font-semibold text-foreground">
              {PRODUCT_NAME}
            </span>
            <span className="text-foreground tabular-nums">
              <span className="font-semibold">€{MONEY.format(flat)}</span>
              <span className="text-muted"> / month</span>
            </span>
          </div>

          <div className="mt-2 h-3 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className="h-full rounded-full bg-accent"
              style={{
                width: `${(Math.max(share, MIN_SHARE) * 100).toFixed(2)}%`,
              }}
            />
          </div>
        </div>
      </CostCardBars>
    </>
  );
}
