import type { AnalyticsView } from "@/lib/analytics/view";
import { BAR_ROWS_SHOWN, eventColor, METRIC_COLOR } from "../charts/chart-colors";
import { DEVICE_LABELS, labelCountry, labelEvent, NO_REFERRER_LABEL } from "../sections";
import { BarListCard } from "./bar-list-card";
import { ShareDonutCard } from "./share-donut-card";

/** Grid columns by how many cards have data — see `BreakdownGrid`. */
const COLUMNS: Record<number, string> = {
  1: "",
  2: "md:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

/**
 * Who the visitors were and what they pressed, as a row of small cards.
 *
 * **The row packs itself.** The column count comes from how many cards have
 * data, rather than a `col-span` per card: two are halves, three are thirds,
 * four are quarters on a wide screen and a two-by-two below it. Not `auto-fit`
 * — that fits as many *tracks* as the width allows, so four cards in three
 * tracks wrap three-and-one and leave two empty cells beside the last, the
 * exact hole this replaced. `items-start` because a bar list of three rows
 * beside one of eight should end where it ends, not be stretched into a card
 * of empty space.
 */
export function BreakdownGrid({ view }: { view: AnalyticsView }) {
  const referrers = [
    ...view.referrers.map((row) => ({ key: row.key, label: row.key, value: row.count })),
    ...(view.direct > 0
      ? [{ key: "", label: NO_REFERRER_LABEL, value: view.direct }]
      : []),
  ]
    .sort((a, b) => b.value - a.value)
    .slice(0, BAR_ROWS_SHOWN);

  const cards = [
    view.devices.length > 0 ? (
      <ShareDonutCard
        key="devices"
        title="Devices"
        hint="What visitors used to look at your map"
        rows={view.devices.map((row) => ({ key: row.kind, count: row.count }))}
        name={(key) => DEVICE_LABELS[key as keyof typeof DEVICE_LABELS] ?? key}
        unit={["visit", "visits"]}
      />
    ) : null,

    view.countries.length > 0 ? (
      <ShareDonutCard
        key="countries"
        title="Countries"
        hint="Where visitors were, from what their connection reported"
        rows={view.countries}
        name={labelCountry}
        unit={["visit", "visits"]}
      />
    ) : null,

    // A chart whose only bar is "No referring site" at 100% says nothing.
    view.referrers.length > 0 ? (
      <BarListCard
        key="referrers"
        title="Came from"
        hint="The site visitors were on before your page"
        rows={referrers}
        name="visits"
        color={METRIC_COLOR.sessions}
      />
    ) : null,

    // Map loads are left out in `view.ts`: they are the Visits card, and as a
    // bar here they would squash the comparison the chart exists for.
    view.interactions.length > 0 ? (
      <BarListCard
        key="interactions"
        title="What they pressed"
        hint="The controls visitors used on your map"
        rows={view.interactions.slice(0, BAR_ROWS_SHOWN).map((row) => ({
          key: row.key,
          label: labelEvent(row.key),
          value: row.count,
          color: eventColor(row.key),
        }))}
        name="times"
        color={METRIC_COLOR.sessions}
      />
    ) : null,
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <div className={`grid items-start gap-4 ${COLUMNS[cards.length] ?? ""}`}>
      {cards}
    </div>
  );
}
