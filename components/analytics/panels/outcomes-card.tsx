import type { AnalyticsView } from "@/lib/analytics/view";
import { METRIC_COLOR } from "../charts/chart-colors";
import { OUTCOME_LABELS } from "../sections";
import { ShareDonutCard } from "./share-donut-card";

type Outcome = keyof typeof OUTCOME_LABELS;

/**
 * What an opened card led to, as a donut: directions, calls, website, email.
 *
 * The part-to-whole of the map's actual purpose. The headline row counts
 * directions and calls together; this splits every outcome by kind, and says
 * which way people prefer to reach a location — a brand whose visitors all
 * ring rather than navigate has learned something about its customers.
 *
 * Slices keep their metric colours and their fixed ring order (the order the
 * palette was validated in), never re-sorted by size. Not drawn when nothing
 * led anywhere — see `hasOutcomes`.
 */
export function OutcomesCard({ view }: { view: AnalyticsView }) {
  return (
    <ShareDonutCard
      title="What it led to"
      hint="Every time an opened location turned into a visit, call or email"
      rows={outcomeRows(view)}
      name={(key) => OUTCOME_LABELS[key as Outcome]}
      unit={["action", "actions"]}
      colors={METRIC_COLOR}
    />
  );
}

export function hasOutcomes(view: AnalyticsView): boolean {
  return outcomeRows(view).length > 0;
}

function outcomeRows(view: AnalyticsView) {
  return (Object.keys(OUTCOME_LABELS) as Outcome[])
    .map((key) => ({ key, count: view.outcomes[key] }))
    .filter((row) => row.count > 0);
}
