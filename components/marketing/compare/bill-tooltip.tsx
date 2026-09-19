"use client";

import { PRODUCT_NAME } from "@/lib/config";

const VIEWS = new Intl.NumberFormat("en-GB");
const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** What recharts hands a custom tooltip, narrowed to the bits used here. */
type TooltipPayload = {
  active?: boolean;
  label?: number | string;
  payload?: { dataKey?: string | number; value?: number }[];
};

const ROWS = [
  { key: "metered", label: "Metered map platform", currency: "$" },
  { key: "locator", label: "Locator product", currency: "$" },
  { key: "us", label: PRODUCT_NAME, currency: "€" },
] as const;

/**
 * All three bills at whatever traffic the pointer is over.
 *
 * **All three, always, in a fixed order.** Recharts' default tooltip lists
 * whichever series the cursor happens to be nearest, reordered by value — so
 * the rows moved around under the pointer, and the comparison the chart exists
 * to make was the one thing it would not hold still for. Fixed rows mean the
 * eye can stay in one place and drag.
 *
 * Drawn from the app's own surface and ink tokens rather than recharts'
 * defaults, which are a white box with a light grey border and are invisible on
 * the dark site. Amounts wear text ink, not the series colour; the dot beside
 * each row is what carries identity.
 *
 * The currencies are not converted and are labelled individually: the two we
 * are compared against publish in dollars and we charge in euros. Saying so in
 * every row is cheaper than a conversion that would need maintaining.
 */
export function BillTooltip({ active, label, payload }: TooltipPayload) {
  if (!active || !payload?.length) return null;

  const value = (key: string) =>
    payload.find((entry) => entry.dataKey === key)?.value;

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-lg shadow-black/10">
      <p className="text-xs font-medium text-foreground tabular-nums">
        {VIEWS.format(Number(label))} views a month
      </p>

      <ul className="mt-1.5 space-y-1">
        {ROWS.map((row) => {
          const amount = value(row.key);
          if (amount === undefined) return null;

          return (
            <li
              key={row.key}
              className="flex items-center justify-between gap-5 text-xs text-muted"
            >
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: `var(--mk-series-${row.key})` }}
                />
                {row.label}
              </span>
              <span className="text-foreground tabular-nums">
                {row.currency}
                {MONEY.format(amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
