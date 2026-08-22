/**
 * Page sizes, resolutions, and the arithmetic between them.
 *
 * The export does not photograph the map on screen. It builds a second map off
 * screen at whatever size is asked for, so the page and the resolution are free
 * choices rather than whatever the browser window happened to be — which is the
 * only way an exported map is any use on paper. That freedom is why this file
 * exists: something has to turn "A4 landscape, print quality" into a container
 * size in CSS pixels, a device pixel ratio, and a page box in PostScript points,
 * and all three have to agree or the PDF comes out the wrong scale.
 *
 * Pure and testable, with no MapLibre and no DOM: every number below is one a
 * test can check without a GPU.
 */

/**
 * CSS pixels per inch, by definition. The whole conversion hangs off this: a CSS
 * pixel is 1/96 inch, so a page 210mm wide is 794 CSS pixels, and asking MapLibre
 * for a device pixel ratio of `dpi / 96` is what turns those into real ones.
 */
const CSS_DPI = 96;
const MM_PER_INCH = 25.4;
/** PostScript points per inch. A PDF page box is measured in these. */
const PT_PER_INCH = 72;

export type PaperId =
  | "view"
  | "a4-landscape"
  | "a4-portrait"
  | "letter-landscape"
  | "letter-portrait"
  | "a3-landscape";

export type Paper = {
  id: PaperId;
  label: string;
  /** Null for "whatever shape the map is on screen right now". */
  widthMm: number | null;
  heightMm: number | null;
};

export const PAPERS: readonly Paper[] = [
  { id: "view", label: "Same shape as the map", widthMm: null, heightMm: null },
  { id: "a4-landscape", label: "A4 landscape", widthMm: 297, heightMm: 210 },
  { id: "a4-portrait", label: "A4 portrait", widthMm: 210, heightMm: 297 },
  { id: "letter-landscape", label: "Letter landscape", widthMm: 279.4, heightMm: 215.9 },
  { id: "letter-portrait", label: "Letter portrait", widthMm: 215.9, heightMm: 279.4 },
  { id: "a3-landscape", label: "A3 landscape", widthMm: 420, heightMm: 297 },
];

export type QualityId = "screen" | "good" | "print";

export type Quality = { id: QualityId; label: string; hint: string; dpi: number };

/**
 * Resolution, named by what it is for rather than by its number.
 *
 * "300 DPI" means nothing to the person this product is built for (§1), and the
 * number is in the hint for the person it does mean something to.
 */
export const QUALITIES: readonly Quality[] = [
  { id: "screen", label: "Screen", hint: "For a slide or a web page", dpi: 96 },
  { id: "good", label: "Good", hint: "Sharp on a retina display", dpi: 150 },
  { id: "print", label: "Print", hint: "Full detail, for paper", dpi: 300 },
];

export const DEFAULT_PAPER: PaperId = "view";
export const DEFAULT_QUALITY: QualityId = "good";

/**
 * What a browser will actually allocate.
 *
 * Both limits are real and they bite differently: Chrome refuses a single side
 * past 65,535 but gives up on *area* well before that, and Safari's ceiling is
 * lower still. Thirty megapixels comfortably clears A3 at 300 DPI (17.4) and
 * stops the combinations that would fail — and failing here, before a map is
 * built, is the difference between a sentence and a blank image.
 */
export const MAX_PIXELS = 30_000_000;
export const MAX_SIDE = 16_384;

export type Viewport = { width: number; height: number };

export type Layout = {
  /** The hidden container's size, in CSS pixels. What MapLibre lays out against. */
  cssWidth: number;
  cssHeight: number;
  /** The canvas that comes out, in real pixels. What lands in the file. */
  width: number;
  height: number;
  /** How much bigger the second is than the first. MapLibre's `pixelRatio`. */
  pixelRatio: number;
  /** The PDF page box. Zero for "view", which is not a paper size. */
  widthPt: number;
  heightPt: number;
};

/**
 * Page and quality → every size the renderer and the PDF writer need.
 *
 * `view` takes its shape from the map on screen and its resolution from the
 * quality alone, so "same shape, print quality" is the live view at 3.125× — the
 * option for someone who has framed something carefully and wants exactly that,
 * larger.
 */
export function layoutFor(paper: Paper, dpi: number, view: Viewport): Layout {
  const pixelRatio = dpi / CSS_DPI;

  const cssWidth =
    paper.widthMm === null ? view.width : (paper.widthMm / MM_PER_INCH) * CSS_DPI;
  const cssHeight =
    paper.heightMm === null ? view.height : (paper.heightMm / MM_PER_INCH) * CSS_DPI;

  /*
   * The container's size is rounded first and the canvas is derived from *that*,
   * not from the exact millimetres.
   *
   * `clientWidth` is an integer, so a container asked for 1122.52px lays out at
   * 1123 and MapLibre's canvas comes out 1123 × the ratio however the page box
   * was calculated. Deriving the two independently puts them a pixel apart, and
   * a pixel apart is a PDF whose `/Width` disagrees with its own image — which
   * a reader resolves by stretching. So A4 at 300 DPI is 3509 rather than the
   * printer's 3508: half a thousandth of an inch, and consistent.
   */
  const width = Math.round(cssWidth);
  const height = Math.round(cssHeight);

  return {
    cssWidth: width,
    cssHeight: height,
    width: Math.round(width * pixelRatio),
    height: Math.round(height * pixelRatio),
    pixelRatio,
    // A "view" export has no paper size, so a PDF of it is sized at 96 DPI —
    // the page is then the same number of points as it is CSS pixels, which is
    // the only self-consistent answer when nobody named a physical size.
    widthPt: mmToPt(paper.widthMm) || (cssWidth * PT_PER_INCH) / CSS_DPI,
    heightPt: mmToPt(paper.heightMm) || (cssHeight * PT_PER_INCH) / CSS_DPI,
  };
}

export function mmToPt(mm: number | null): number {
  return mm === null ? 0 : (mm / MM_PER_INCH) * PT_PER_INCH;
}

/**
 * Why this combination cannot be rendered, or null when it can.
 *
 * A sentence rather than a boolean, because "too big" is only useful next to
 * what to do instead — and the thing to do is always to drop the quality, which
 * is the one choice the reader can make without changing what they get.
 */
export function budgetError(layout: Layout): string | null {
  if (layout.width > MAX_SIDE || layout.height > MAX_SIDE) {
    return "That page is too wide for the browser to draw in one go. Choose a smaller quality.";
  }

  if (layout.width * layout.height > MAX_PIXELS) {
    return "That page and quality together are more than the browser will draw. Choose a smaller quality.";
  }

  return null;
}

/**
 * The zoom the export should use so nothing on screen falls off the page.
 *
 * A page is rarely the shape of the window, and keeping the same zoom would
 * silently crop: a portrait A4 taken from a landscape map loses the ends of what
 * the user was looking at, with nothing to say so. Matching the *tighter* of the
 * two axes instead means the export always contains everything visible, and
 * shows a little extra along whichever axis had room.
 *
 * The scale is read in CSS pixels, not device ones, because that is what
 * MapLibre's zoom is measured against — a pixel ratio changes the sharpness of
 * the render and not the area it covers.
 */
export function zoomFor(zoom: number, view: Viewport, layout: Layout): number {
  if (view.width <= 0 || view.height <= 0) return zoom;

  const ratio = Math.min(layout.cssWidth / view.width, layout.cssHeight / view.height);
  if (!Number.isFinite(ratio) || ratio <= 0) return zoom;

  return zoom + Math.log2(ratio);
}

export function paperById(id: PaperId): Paper {
  return PAPERS.find((paper) => paper.id === id) ?? PAPERS[0];
}

export function qualityById(id: QualityId): Quality {
  return QUALITIES.find((quality) => quality.id === id) ?? QUALITIES[1];
}
