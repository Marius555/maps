import { describe, expect, it } from "vitest";

import {
  budgetError,
  layoutFor,
  MAX_PIXELS,
  paperById,
  PAPERS,
  qualityById,
  QUALITIES,
  zoomFor,
} from "./paper";

const view = { width: 900, height: 600 };

describe("layoutFor", () => {
  it("turns A4 landscape at print quality into the size a printer expects", () => {
    const layout = layoutFor(paperById("a4-landscape"), 300, view);

    // 297mm × 210mm at 300 DPI is 3508 × 2480 in a print shop's arithmetic. Ours
    // is within a pixel of it and consistent with the container it comes from —
    // see the note in `layoutFor` for why that trade is the right way round.
    expect(layout.width).toBeCloseTo(3508, -1);
    expect(layout.height).toBeCloseTo(2480, -1);
    expect(layout.pixelRatio).toBeCloseTo(3.125, 5);
  });

  it("lays the container out in CSS pixels and the canvas in real ones", () => {
    const layout = layoutFor(paperById("a4-landscape"), 300, view);

    // MapLibre measures its zoom against the first and its sharpness against the
    // ratio, which is the whole reason both are here.
    expect(layout.cssWidth).toBe(1123);
    expect(layout.width).toBe(Math.round(layout.cssWidth * layout.pixelRatio));
  });

  it("takes its shape from the map for the view size", () => {
    const layout = layoutFor(paperById("view"), 150, view);

    expect(layout.cssWidth).toBe(900);
    expect(layout.cssHeight).toBe(600);
    expect(layout.width).toBe(1406);
    expect(layout.height).toBe(938);
  });

  it("gives a page box in points that matches the paper", () => {
    const layout = layoutFor(paperById("a4-landscape"), 96, view);

    // 297mm and 210mm in PostScript points, which is what the PDF page is in.
    expect(layout.widthPt).toBeCloseTo(841.89, 1);
    expect(layout.heightPt).toBeCloseTo(595.28, 1);
  });

  it("sizes a view export's page from its own pixels", () => {
    // No physical size was named, so 96 DPI is the only self-consistent answer.
    const layout = layoutFor(paperById("view"), 300, view);

    expect(layout.widthPt).toBeCloseTo(675, 0);
    expect(layout.heightPt).toBeCloseTo(450, 0);
  });

  it("scales with quality and not with anything else", () => {
    const a = layoutFor(paperById("a4-portrait"), 96, view);
    const b = layoutFor(paperById("a4-portrait"), 300, view);

    expect(a.cssWidth).toBe(b.cssWidth);
    expect(b.width / a.width).toBeCloseTo(300 / 96, 1);
  });
});

describe("budgetError", () => {
  it("allows the largest page at the highest quality", () => {
    // A3 at 300 DPI is 17.4 megapixels. If this ever starts failing, the option
    // is no longer offerable and the menu is lying.
    expect(budgetError(layoutFor(paperById("a3-landscape"), 300, view))).toBeNull();
  });

  it("allows every combination the menu offers", () => {
    for (const paper of PAPERS) {
      for (const quality of QUALITIES) {
        expect(budgetError(layoutFor(paper, quality.dpi, view))).toBeNull();
      }
    }
  });

  it("refuses a view so large the browser would not draw it", () => {
    const huge = layoutFor(paperById("view"), 300, { width: 6000, height: 4000 });

    expect(huge.width * huge.height).toBeGreaterThan(MAX_PIXELS);
    expect(budgetError(huge)).toContain("quality");
  });
});

describe("zoomFor", () => {
  it("leaves a page the same shape and size alone", () => {
    const layout = layoutFor(paperById("view"), 96, view);

    expect(zoomFor(12, view, layout)).toBeCloseTo(12, 6);
  });

  it("keeps everything visible when the page is a different shape", () => {
    const layout = layoutFor(paperById("a4-portrait"), 96, view);

    /*
     * A portrait page from a landscape map. Holding the zoom would crop the ends
     * off what the user was looking at with nothing to say so, which is the
     * failure this exists to prevent — so the zoom follows the tighter axis.
     */
    const zoom = zoomFor(12, view, layout);
    const ratio = 2 ** (zoom - 12);

    expect(layout.cssWidth / ratio).toBeGreaterThanOrEqual(view.width - 0.001);
    expect(layout.cssHeight / ratio).toBeGreaterThanOrEqual(view.height - 0.001);
  });

  it("holds the zoom rather than dividing by nothing", () => {
    const layout = layoutFor(paperById("a4-landscape"), 96, view);

    // A frame with no size yet is what the first render looks like.
    expect(zoomFor(9, { width: 0, height: 0 }, layout)).toBe(9);
  });
});

describe("lookups", () => {
  it("falls back rather than returning undefined for an unknown id", () => {
    // The ids are stored in component state and could survive a rename.
    expect(paperById("nonsense" as never).id).toBe(PAPERS[0].id);
    expect(qualityById("nonsense" as never).id).toBe(QUALITIES[1].id);
  });
});
