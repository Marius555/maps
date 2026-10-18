"use client";

import { PRODUCT_NAME } from "@/lib/config";
import type { BillPoint } from "@/lib/marketing/compare";

const VIEWS = new Intl.NumberFormat("en-GB");
const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** What recharts hands a custom tooltip, narrowed to the bits used here. */
type TooltipPayload = {
  active?: boolean;
  payload?: { payload?: BillPoint }[];
};

/**
 * Both bills at whatever traffic the pointer is over, with what "everyone
 * else" is made of underneath.
 *
 * **Read from the sample, not from the series.** The chart draws two series —
 * everyone else and us — but the metered figure is not one of them, so the
 * row breaking it out reads the whole data point recharts hands over
 * (`payload[0].payload`). Fixed rows in a fixed order, so the eye can stay in
 * one place and drag; recharts' default reorders by value under the pointer.
 *
 * Drawn from the app's own surface and ink tokens rather than recharts'
 * defaults, which are a white box invisible against nothing on the dark site.
 * The currencies are labelled per row and never converted: the two usual ways
 * publish in dollars and we charge in euros.
 */
export function BillTooltip({ active, payload }: TooltipPayload) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg shadow-black/10">
      <p className="text-xs font-medium text-foreground tabular-nums">
        {VIEWS.format(point.views)} views a month
      </p>

      <ul className="mt-1.5 space-y-1 text-xs">
        <Row color="var(--mk-series-metered)" label="Everyone else">
          ${MONEY.format(point.locator)}
        </Row>
        <li className="space-y-0.5 pl-3 text-[0.6875rem] text-muted">
          <p className="flex justify-between gap-5">
            <span>Metered map loads</span>
            <span className="tabular-nums">${MONEY.format(point.metered)}</span>
          </p>
          <p className="flex justify-between gap-5">
            <span>Locator subscription</span>
            <span className="tabular-nums">
              ${MONEY.format(point.locator - point.metered)}
            </span>
          </p>
        </li>
        <Row color="var(--mk-series-us)" label={PRODUCT_NAME} strong>
          €{MONEY.format(point.us)}
        </Row>
      </ul>
    </div>
  );
}

function Row({
  color,
  label,
  strong = false,
  children,
}: {
  color: string;
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-5 text-muted">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <span
        className={`text-foreground tabular-nums ${strong ? "font-semibold" : ""}`}
      >
        {children}
      </span>
    </li>
  );
}
