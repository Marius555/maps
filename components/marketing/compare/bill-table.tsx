"use client";

import { useInView } from "motion/react";
import { useRef } from "react";

import { PRODUCT_NAME } from "@/lib/config";
import { compareRows } from "@/lib/marketing/compare";
import { viewsLabel } from "@/lib/marketing/cost";

import { CountUp } from "../count-up";
import { Reserve } from "../reserve";

const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * The same three bills as numbers, at the three traffic levels a decade apart.
 *
 * **It is doing three jobs, and each one on its own would justify it.**
 *
 * 1. **It is what the page ships without JavaScript.** The chart beside it is
 *    `ssr: false`, because recharts measures its container before it can draw
 *    anything. ../reveal.tsx records what this page's rule is and why: an
 *    earlier reveal shipped nineteen elements already invisible in the served
 *    HTML, and with scripts blocked they stayed that way. A section whose whole
 *    argument is three numbers must not be able to arrive empty.
 * 2. **It is the chart's table view**, which any chart owes a reader who cannot
 *    use it — and here the numbers are the point rather than a drill-down.
 * 3. **It is where the exact figures live.** A log axis is read as a shape, not
 *    as values; the amounts the footnote refers to are here, printed.
 *
 * **A client component, and still server-rendered.** `"use client"` means
 * hydrated, not client-only: the server still renders this to HTML with every
 * figure printed, which is what point 1 needs. The client half is the arrival —
 * one `useInView` on the table starts all nine figures counting up from zero as
 * the lines beside them draw (../count-up.tsx has how that stays out of the
 * served HTML). Each figure sits in a `Reserve` holding its final text, because
 * the columns are sized by their content and "$0" is narrower than "$7,000".
 *
 * `compareRows` is the same tested function the bar charts used, so the table
 * and the curves cannot drift — `compare.test.ts` asserts `billSeries` agrees
 * with it at every traffic level the two share.
 *
 * A real `<table>` with a real `<caption>`, not a grid of divs: it is tabular
 * data, and a screen reader navigating it by column is the whole reason the
 * element exists.
 */
export function BillTable({ flat }: { flat: number }) {
  const rows = compareRows(flat);
  const table = useRef<HTMLTableElement>(null);
  const shown = useInView(table, { once: true, amount: 0.4 });

  return (
    <table ref={table} className="w-full border-collapse text-left text-xs">
      <caption className="sr-only">
        Monthly bill for a store locator at three traffic levels, by how it is
        bought.
      </caption>

      <thead>
        <tr className="text-muted">
          <th scope="col" className="py-1.5 pr-3 font-normal">
            Views a month
          </th>
          {rows.map((row) => (
            <th
              key={row.views}
              scope="col"
              className="py-1.5 pl-3 text-right font-normal tabular-nums"
            >
              {viewsLabel(row.views)}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows[0].bars.map((bar, index) => {
          const us = bar.id === "us";

          return (
            <tr key={bar.id} className="border-t border-foreground/[0.08]">
              <th
                scope="row"
                className={`py-1.5 pr-3 font-normal ${us ? "text-foreground" : "text-muted"}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--mk-series-${bar.id})` }}
                  />
                  {us ? PRODUCT_NAME : bar.label}
                </span>
              </th>

              {rows.map((row) => {
                const cell = row.bars[index];

                return (
                  <td
                    key={row.views}
                    className={`py-1.5 pl-3 text-right tabular-nums ${
                      us ? "font-semibold text-foreground" : "text-muted"
                    }`}
                  >
                    <Reserve
                      className="justify-items-end"
                      sizers={[`${cell.currency}${MONEY.format(cell.amount)}`]}
                    >
                      <CountUp
                        value={cell.amount}
                        currency={cell.currency}
                        run={shown}
                      />
                    </Reserve>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
