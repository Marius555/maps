import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIEWS,
  MAX_VIEWS,
  MIN_VIEWS,
  SLIDER_STEPS,
  VIEW_TICKS,
  costVerdict,
  crossoverViews,
  meteredMonthly,
  positionOf,
  verdictOf,
  verdictSizers,
  viewsAt,
  viewsLabel,
} from "./cost";
import type { VerdictBranch } from "./cost";

describe("viewsAt", () => {
  it("runs from the minimum to the maximum across the track", () => {
    expect(viewsAt(0)).toBe(MIN_VIEWS);
    expect(viewsAt(SLIDER_STEPS)).toBe(MAX_VIEWS);
  });

  // Log scale: the middle of three decades is the middle decade's start.
  it("puts the geometric middle at the middle of the track", () => {
    expect(viewsAt(SLIDER_STEPS / 2)).toBe(32_000);
  });

  it("rounds to two significant figures", () => {
    for (let position = 0; position <= SLIDER_STEPS; position += 37) {
      const views = viewsAt(position);
      const digits = String(views).replace(/0+$/, "");

      expect(digits.length, String(views)).toBeLessThanOrEqual(2);
    }
  });

  it("never goes backwards as the slider moves right", () => {
    for (let position = 1; position <= SLIDER_STEPS; position += 1) {
      expect(viewsAt(position)).toBeGreaterThanOrEqual(viewsAt(position - 1));
    }
  });

  it("clamps positions off the track", () => {
    expect(viewsAt(-50)).toBe(MIN_VIEWS);
    expect(viewsAt(SLIDER_STEPS + 50)).toBe(MAX_VIEWS);
  });
});

describe("positionOf", () => {
  it("lands the default traffic back on itself", () => {
    expect(viewsAt(positionOf(DEFAULT_VIEWS))).toBe(DEFAULT_VIEWS);
  });

  it("round-trips the ends", () => {
    expect(positionOf(MIN_VIEWS)).toBe(0);
    expect(positionOf(MAX_VIEWS)).toBe(SLIDER_STEPS);
  });
});

describe("meteredMonthly", () => {
  it("bills $7 per thousand loads", () => {
    expect(meteredMonthly(1_000)).toBe(7);
    expect(meteredMonthly(50_000)).toBe(350);
    expect(meteredMonthly(1_000_000)).toBe(7_000);
  });
});

describe("crossoverViews", () => {
  it("is where a metered bill reaches the flat price", () => {
    expect(crossoverViews(19)).toBe(2_700);
    expect(meteredMonthly(crossoverViews(19))).toBeCloseTo(19, 0);
  });
});

describe("costVerdict", () => {
  it("says how many times more a metered map costs", () => {
    expect(costVerdict(50_000, 19)).toBe(
      "At 50,000 views a month, a metered map costs about 18× more.",
    );
  });

  it("keeps one decimal below ten, and drops a trailing zero", () => {
    expect(costVerdict(10_000, 19)).toContain("about 3.7× more");
    expect(costVerdict(8_000, 28)).toContain("about 2× more");
  });

  it("owns up when the metered bill is the smaller one", () => {
    expect(costVerdict(1_000, 19)).toBe(
      "At 1,000 views a month a metered map is the cheaper one — until about 2,700 views.",
    );
  });

  it("calls a near tie a tie", () => {
    expect(costVerdict(3_200, 19)).toContain("about the same");
  });
});

describe("verdictSizers", () => {
  /*
   * The height the page reserves for the verdict. Rendering it is a layout
   * concern, but *whether the reservation is big enough* is arithmetic, and it
   * is the part that silently stops being true when the copy is edited — so it
   * is a test rather than a note. See `verdictSizers` for the measurements.
   */
  it("covers every sentence the slider can produce", () => {
    for (let position = 0; position <= SLIDER_STEPS; position += 1) {
      const views = viewsAt(position);
      const { branch, text } = verdictOf(views, 19);
      const sizer = verdictSizers(19).find((held) => verdictBranchOf(held) === branch);

      expect(sizer, `${views} views`).toBeDefined();
      expect(text.length, `${views} views`).toBeLessThanOrEqual(sizer!.length);
    }
  });

  it("holds one sentence per branch, and all three are reachable", () => {
    const sizers = verdictSizers(19);

    expect(new Set(sizers.map(verdictBranchOf))).toEqual(
      new Set<VerdictBranch>(["cheaper", "level", "multiple"]),
    );
    expect(sizers).toHaveLength(3);
  });
});

/** Which branch a finished sentence came from, by the words only one of them uses. */
function verdictBranchOf(text: string): VerdictBranch {
  if (text.includes("the cheaper one")) return "cheaper";
  if (text.includes("about the same")) return "level";

  return "multiple";
}

describe("VIEW_TICKS", () => {
  it("spans the slider's own range, so the track is labelled end to end", () => {
    expect(VIEW_TICKS[0].views).toBe(MIN_VIEWS);
    expect(VIEW_TICKS[VIEW_TICKS.length - 1].views).toBe(MAX_VIEWS);
  });

  it("lands every tick on the track it labels", () => {
    for (const tick of VIEW_TICKS) {
      expect(viewsAt(positionOf(tick.views))).toBe(tick.views);
    }
  });

  it("writes the labels rather than formatting them", () => {
    // Node and Chrome's ICU disagree on `notation: "compact"` — Node says "1M",
    // Chrome says "1m" — so the server-rendered table and the client-rendered
    // axis printed different strings for the same number. These four are
    // literals for that reason; asserting them keeps the fix from being
    // "simplified" back into a formatter.
    expect(VIEW_TICKS.map((tick) => tick.label)).toEqual([
      "1k",
      "10k",
      "100k",
      "1M",
    ]);
  });

  it("names a decade and falls back to the plain number for anything else", () => {
    expect(viewsLabel(1_000_000)).toBe("1M");
    expect(viewsLabel(50_000)).toBe("50,000");
  });
});
