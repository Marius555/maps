import { Card } from "@heroui/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { formatCount } from "@/lib/format/number";
import type { Delta } from "@/lib/analytics/view";
import { softOf } from "../charts/chart-colors";
import { LazySparkline } from "../charts/lazy";
import type { SparkPoint } from "../charts/sparkline";
import { TrendChip } from "./trend-chip";

/**
 * One headline figure: what it is, what it counts, how much, how it moved, and
 * its shape.
 *
 * The anatomy of a dashboard KPI card — icon and label, a line saying what the
 * figure counts, the figure with its trend beside it, a sparkline of the
 * period, and one line naming what the trend is measured against.
 *
 * **Each card wears its metric's colour** — the icon chip and the sparkline —
 * and that colour follows the metric onto every chart below, so the headline
 * row doubles as the page's legend. The figure itself stays in text ink.
 *
 * The sparkline box is sized here, from the server render on, so the card is
 * its final height before recharts arrives.
 */
export function KpiCard({
  icon: Icon,
  label,
  description,
  color,
  delta,
  series,
  seriesName,
  footer,
}: {
  icon: LucideIcon;
  label: string;
  /** What the figure counts, in a few words. */
  description: string;
  /** The metric's colour — `METRIC_COLOR`. */
  color: string;
  delta: Delta;
  series: SparkPoint[];
  /** What one point counts, for the sparkline's tooltip: "visits". */
  seriesName: string;
  /** The line under the chart — the comparison, or a caveat that outranks it. */
  footer: ReactNode;
}) {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ background: softOf(color), color }}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-foreground">{label}</h3>
          <p className="text-xs leading-snug text-muted text-pretty">{description}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {formatCount(delta.value)}
        </p>
        <TrendChip delta={delta} />
      </div>

      <div className="an-chart -mx-1 mt-3 h-12" aria-hidden="true">
        <LazySparkline data={series} name={seriesName} color={color} />
      </div>

      <p className="mt-2 text-xs text-muted">{footer}</p>
    </Card>
  );
}
