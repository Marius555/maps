import { describe, expect, it } from "vitest";

import {
  COMPARE_VIEWS,
  LOCATOR_MONTHLY_USD,
  SETUP_MONTHS,
  SETUP_ONCE_USD,
  BILL_AXIS_MAX,
  BILL_AXIS_MIN,
  billSeries,
  compareRows,
  growthFactor,
  locatorMonthly,
  setupMonthly,
  worthSegments,
  worthTotal,
} from "./compare";
import {
  MAX_VIEWS,
  METERED_USD_PER_1000,
  MIN_VIEWS,
  SLIDER_STEPS,
  meteredMonthly,
} from "./cost";
import { MARKETING_PLANS, RECOMMENDED_PLAN } from "./plans";

const PLAN = MARKETING_PLANS.find((plan) => plan.id === RECOMMENDED_PLAN)!;

describe("locatorMonthly", () => {
  it("is the subscription plus the map loads their own key is billed for", () => {
    expect(locatorMonthly(100_000)).toBe(
      LOCATOR_MONTHLY_USD + 100 * METERED_USD_PER_1000,
    );
  });

  it("still costs the subscription at no traffic at all", () => {
    expect(locatorMonthly(0)).toBe(LOCATOR_MONTHLY_USD);
  });
});

describe("worthSegments", () => {
  it("adds up to the total the chart prints", () => {
    const views = 50_000;
    const sum = worthSegments(views).reduce((total, one) => total + one.amountUsd, 0);

    expect(worthTotal(views)).toBeCloseTo(sum, 10);
  });

  it("marks the setup figure as an assumption and nothing else", () => {
    expect(worthSegments(50_000).filter((one) => one.assumed).map((one) => one.id)).toEqual([
      "setup",
    ]);
  });

  it("spreads the one-off setup across a year", () => {
    expect(setupMonthly()).toBeCloseTo(SETUP_ONCE_USD / SETUP_MONTHS, 10);
  });
});

describe("compareRows", () => {
  const rows = compareRows(PLAN.amount);

  it("draws a row per traffic level", () => {
    expect(rows.map((row) => row.views)).toEqual([...COMPARE_VIEWS]);
  });

  it("states our own bar at the price the plans page states", () => {
    for (const row of rows) {
      const us = row.bars.find((bar) => bar.id === "us")!;

      expect(us.amount).toBe(PLAN.amount);
      expect(us.currency).toBe("€");
    }
  });

  it("scales each row to its own widest bar", () => {
    for (const row of rows) {
      const widest = Math.max(...row.bars.map((bar) => bar.amount));

      expect(Math.max(...row.bars.map((bar) => bar.share))).toBe(1);

      for (const bar of row.bars) {
        expect(bar.share).toBeCloseTo(bar.amount / widest, 10);
      }
    }
  });

  it("puts the metered bill above ours only once the traffic is there", () => {
    const [smallest] = rows;
    const metered = smallest.bars.find((bar) => bar.id === "metered")!;

    // 10,000 views is $70 against €19 — true, and the chart shows it rather
    // than starting at a traffic level that flatters us.
    expect(metered.amount).toBe(meteredMonthly(COMPARE_VIEWS[0]));
  });
});

describe("growthFactor", () => {
  it("is the whole argument: a hundredfold against one", () => {
    expect(growthFactor(meteredMonthly)).toBeCloseTo(100, 10);
    expect(growthFactor(() => PLAN.amount)).toBe(1);
  });
});

describe("billSeries", () => {
  const series = billSeries(PLAN.amount);

  it("spans the slider's own range, end to end", () => {
    expect(series).toHaveLength(SLIDER_STEPS + 1);
    expect(series[0].views).toBe(MIN_VIEWS);
    expect(series[series.length - 1].views).toBe(MAX_VIEWS);
  });

  it("never bends our line: that is the claim the chart is making", () => {
    for (const point of series) expect(point.us).toBe(PLAN.amount);
  });

  it("climbs on both of the other two, and never dips", () => {
    for (let i = 1; i < series.length; i += 1) {
      expect(series[i].metered).toBeGreaterThanOrEqual(series[i - 1].metered);
      expect(series[i].locator).toBeGreaterThanOrEqual(series[i - 1].locator);
    }

    expect(series[series.length - 1].metered).toBeGreaterThan(series[0].metered);
  });

  it("keeps every point inside the axis domain the chart declares", () => {
    // A log axis silently drops a point outside its domain, so the floor and
    // the ceiling the chart hardcodes have to be true of the data.
    for (const point of series) {
      expect(point.us).toBeGreaterThanOrEqual(BILL_AXIS_MIN);
      expect(point.locator).toBeLessThanOrEqual(BILL_AXIS_MAX);
      expect(point.metered).toBeLessThanOrEqual(BILL_AXIS_MAX);
    }
  });

  it("agrees with the table beside it at every traffic level it shares", () => {
    for (const row of compareRows(PLAN.amount)) {
      const point = series.find((entry) => entry.views === row.views)!;
      const bar = (id: string) => row.bars.find((entry) => entry.id === id)!;

      expect(point.metered).toBeCloseTo(bar("metered").amount, 10);
      expect(point.locator).toBeCloseTo(bar("locator").amount, 10);
      expect(point.us).toBe(bar("us").amount);
    }
  });
});
