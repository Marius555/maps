"use client";

import { useInView } from "motion/react";
import dynamic from "next/dynamic";
import { useRef } from "react";

/**
 * The chart, kept off the server render and off the first payload.
 *
 * **`ssr: false` is forced rather than chosen.** Recharts sizes itself from a
 * measured container, so there is nothing for it to draw on the server; and
 * `ssr: false` is only legal inside a client component, which is the whole
 * reason this file exists as a wrapper rather than being a `dynamic()` call
 * inside `Compare`. It is the same shape CLAUDE.md §7 already mandates for
 * MapLibre, for the same reason.
 *
 * **It also keeps recharts out of the landing page's critical path.** Recharts
 * brings Redux Toolkit, react-redux and immer with it — fine on the dashboard
 * side of the seam (the embed's own budget is untouched; ESLint will not let
 * anything under /components reach /embed), but it is real weight on a page
 * whose job is to load fast for a stranger. Deferred, it arrives after the
 * page does.
 */
const Chart = dynamic(() => import("./bill-chart").then((m) => m.BillChart), {
  ssr: false,
});

/**
 * Where the chart goes, and when it is drawn.
 *
 * **This box owns the chart's height**, which used to be written three times —
 * here as the loading placeholder, here again as the fallback, and on the chart's
 * own wrapper. It is the one element that exists from the server render on, so it
 * is what holds the table beside it still while recharts loads. The placeholder
 * is blank on purpose: the figures are already printed in `BillTable`, and a
 * spinner over a chart whose numbers are legible beside it is an interruption,
 * not information.
 *
 * **Two readings of the same box, because loading and drawing want different
 * moments.** `near` mounts the chart while the reader is still a screen away, so
 * the chunk has landed by the time they arrive; `shown` is the arrival, and is
 * what starts the lines drawing (see `BillChart`'s `draw`). One trigger for both
 * would either draw the lines where nobody could see them or make the reader wait
 * on a download before anything moved.
 */
export function BillChartLoader({ flat }: { flat: number }) {
  const box = useRef<HTMLDivElement>(null);
  const near = useInView(box, { once: true, margin: "600px" });
  const shown = useInView(box, { once: true, amount: 0.4 });

  return (
    <div ref={box} className="mk-chart h-[220px] w-full sm:h-[258px]">
      {near ? <Chart flat={flat} draw={shown} /> : null}
    </div>
  );
}
