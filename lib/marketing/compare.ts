import {
  METERED_USD_PER_1000,
  SLIDER_STEPS,
  meteredMonthly,
  viewsAt,
} from "./cost";

/**
 * What a store locator costs when it is bought the two usual ways, so the
 * landing page can draw the third against them.
 *
 * **Published prices, and nothing else.** The page's own standing rule is that
 * inventing what we cannot show would make it worthless, and a comparison chart
 * is the easiest place in a marketing site to invent. So every figure below is
 * either a list price somebody publishes or is marked as an assumption, on the
 * page as well as here:
 *
 * - **$7 per 1,000 map loads** — the metered list price CLAUDE.md §2 is built
 *   on, already on the page in the cost calculator and already footnoted there.
 * - **$49 a month** — the middle of the three tiers a locator product of this
 *   kind publishes ($25 / $49 / $99: storepoint.co/docs/guides/best-store-locator-software,
 *   read September 2026), with the wider market at roughly $9–$49 for small
 *   networks (storerocket.io/learn/best-store-locator-software).
 * - **Your own map key on top** — those products ask you to "connect your own
 *   Google Maps or Mapbox key … at their prices", which is why the locator
 *   figure is a subscription *plus* metered loads rather than either alone.
 *   Some offer a managed option with views included; its price is not published,
 *   so it is not modelled and the page says so.
 * - **A day of setup** — an assumption, and labelled one everywhere it appears.
 *
 * **No product is named on the page.** The bars are categories, so nothing here
 * goes stale or misrepresents anybody when a competitor changes a price — the
 * shape of the bill is the claim, not any one vendor's number.
 *
 * Pure, like ./cost.ts, so the numbers the page prints are the numbers a test
 * checked.
 */

/** The published mid-tier subscription for a locator product of this kind. */
export const LOCATOR_MONTHLY_USD = 49;

/** One day of somebody's time to wire a locator into a site. An assumption. */
export const SETUP_ONCE_USD = 500;

/** Setup is a one-off, so it is spread across a year to sit beside monthly bills. */
export const SETUP_MONTHS = 12;

/** The traffic levels the comparison draws, a decade apart. */
export const COMPARE_VIEWS: readonly number[] = [10_000, 100_000, 1_000_000];

/**
 * A locator product's monthly bill at `views`: its subscription, plus the map
 * loads you are still billed for by whoever's key you connected.
 */
export function locatorMonthly(views: number): number {
  return LOCATOR_MONTHLY_USD + meteredMonthly(views);
}

/** The setup assumption as a monthly figure. */
export function setupMonthly(): number {
  return SETUP_ONCE_USD / SETUP_MONTHS;
}

export type Segment = {
  id: string;
  label: string;
  amountUsd: number;
  /** True for a figure nobody publishes — the page says so beside it. */
  assumed: boolean;
};

/**
 * What a month of doing it the usual way is made of, at `views`.
 *
 * Three segments rather than one total, because the point of this chart is that
 * the flat plan replaces a *stack* of bills — the map, the tool that draws it,
 * and the afternoon somebody spent connecting the two.
 */
export function worthSegments(views: number): Segment[] {
  return [
    {
      id: "loads",
      label: "Map loads, metered",
      amountUsd: meteredMonthly(views),
      assumed: false,
    },
    {
      id: "locator",
      label: "Locator subscription",
      amountUsd: LOCATOR_MONTHLY_USD,
      assumed: false,
    },
    {
      id: "setup",
      label: "Setup, spread over a year",
      amountUsd: setupMonthly(),
      assumed: true,
    },
  ];
}

export function worthTotal(views: number): number {
  return worthSegments(views).reduce((total, segment) => total + segment.amountUsd, 0);
}

export type CompareBar = {
  id: "metered" | "locator" | "us";
  label: string;
  amount: number;
  currency: "$" | "€";
  /** This bar against the widest in its own row, 0–1. */
  share: number;
};

export type CompareRow = {
  views: number;
  bars: CompareBar[];
};

/**
 * One row per traffic level, each scaled to its own widest bar.
 *
 * **Per row, deliberately.** One scale across three decades would leave eight of
 * the nine bars under a pixel, and a log axis on a landing page needs a
 * paragraph of explanation before it says anything. A row is a comparison —
 * "at 100,000 views a month" — and every bar prints its own number, so nothing
 * is hidden by the scaling.
 */
export function compareRows(flatEur: number): CompareRow[] {
  return COMPARE_VIEWS.map((views) => {
    const amounts: Omit<CompareBar, "share">[] = [
      {
        id: "metered",
        label: "Metered map platform",
        amount: meteredMonthly(views),
        currency: "$",
      },
      {
        id: "locator",
        label: "Locator product, your own map key",
        amount: locatorMonthly(views),
        currency: "$",
      },
      { id: "us", label: "Us", amount: flatEur, currency: "€" },
    ];

    const widest = Math.max(...amounts.map((bar) => bar.amount));

    return {
      views,
      bars: amounts.map((bar) => ({
        ...bar,
        share: widest > 0 ? bar.amount / widest : 0,
      })),
    };
  });
}

/** How much a bill multiplies between the first traffic level and the last. */
export function growthFactor(at: (views: number) => number): number {
  const first = at(COMPARE_VIEWS[0]);
  const last = at(COMPARE_VIEWS[COMPARE_VIEWS.length - 1]);

  return first > 0 ? last / first : 0;
}

export { METERED_USD_PER_1000 };

/**
 * The bill axis the survey chart draws, as decades.
 *
 * **Exported rather than written in the component, because a log axis drops a
 * point outside its domain without a word.** A €19 line under a $10 floor, or a
 * $7,000 one over a $10,000 ceiling, simply is not drawn — no warning, no gap,
 * just a series that ends early. `compare.test.ts` asserts every point of
 * `billSeries` lands inside these, so the failure is a red test rather than a
 * chart that looks finished.
 */
export const BILL_AXIS_MIN = 10;
export const BILL_AXIS_MAX = 10_000;

/** The decades the bill axis is labelled at. */
export const BILL_AXIS_TICKS: readonly number[] = [10, 100, 1_000, 10_000];

export type BillPoint = {
  views: number;
  /** A metered map platform, billed per load. */
  metered: number;
  /** A locator subscription, plus the loads its own map key is still billed for. */
  locator: number;
  /** Us: the same number at every traffic level, which is the whole point. */
  us: number;
};

/**
 * The three bills as continuous curves over the traffic range, for the survey
 * section's line chart.
 *
 * **Sampled on the calculator's own track, not on a fresh one.** `viewsAt` over
 * `0..SLIDER_STEPS` is exactly the log scale the slider two sections up moves
 * along, so the curve a reader sees here is the one they were just dragging.
 * Sixty-one points over three decades is about twenty a decade — enough that a
 * log-log plot draws as a clean line rather than a polyline with visible joints,
 * and few enough to ship in the page.
 *
 * `us` is constant by construction rather than by a flat-looking curve: nothing
 * about `flatEur` depends on `views`, and that is the claim.
 */
export function billSeries(flatEur: number): BillPoint[] {
  return Array.from({ length: SLIDER_STEPS + 1 }, (_, position) => {
    const views = viewsAt(position);

    return {
      views,
      metered: meteredMonthly(views),
      locator: locatorMonthly(views),
      us: flatEur,
    };
  });
}
