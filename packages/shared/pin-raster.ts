import type { Map as MapLibreMap } from "maplibre-gl";

import {
  DEFAULT_PIN_SHAPE,
  DEFAULT_PIN_SIZE,
  DEFAULT_RING_WIDTH,
  GLYPH_SOURCE_BOX,
  GLYPH_STROKE_WIDTH,
  PIN_BOX,
  PIN_RING_WIDTHS,
  PIN_SHAPES,
  PIN_SIZES,
  glyphBoxFor,
  imageBoxFor,
  imageCircleFor,
  resolvePin,
  type CustomPinIcon,
  type ResolvedPin,
} from "./pin-icons";

/**
 * Pins with icons, drawn into map images.
 *
 * A place drawn from a GeoJSON source has to be a symbol layer, and a symbol
 * layer needs a registered image. Two renderers need that now — the published
 * embed, and the editor's image export, which builds a second map off screen and
 * therefore has no DOM markers to photograph. So this sits in the one directory
 * both build targets read (CLAUDE.md §4): it is vanilla TS over `Path2D` and
 * Canvas2D with no dependency of its own, and a second copy in /lib would be a
 * copy that slowly stopped matching the pins it is a picture of.
 *
 * Three ways to get the image, and only the third survives contact with a
 * stranger's website:
 *
 * - An external sprite is a second request in the visitor's path (§2), and one
 *   more thing to keep in sync with the CDN.
 * - An SVG in a `data:` URI decodes asynchronously and is blocked outright by any
 *   host page whose CSP restricts `img-src` — a failure we would never see and
 *   the customer could not diagnose.
 * - Canvas2D with `Path2D` draws the same path strings the editor renders as SVG,
 *   synchronously, from code the page already loaded. No fetch, no CSP surface.
 *
 * A customer's uploaded logo cannot be path data, so it takes the nearest thing
 * that keeps those properties: the base64 travels *inside* the snapshot, and is
 * decoded through a Blob and `createImageBitmap`. That loads no URL — so still no
 * request and still nothing for a host CSP to block — at the cost of being async,
 * which is why registration comes in two passes rather than one.
 *
 * The geometry comes from packages/shared/pin-icons.ts, the same module the
 * editor's markers and drag ghost draw from, so the pin a customer arranges in
 * the dashboard is the pin their visitors get.
 */

/**
 * Rendered pin size in CSS pixels, before the pin's own `scale`. Drawn at twice
 * this and registered with `pixelRatio: 2`, so it stays crisp on the retina
 * screens most visitors have.
 */
const PIN_SIZE = 36;
const PIXEL_RATIO = 2;

/**
 * What is drawn over the fill when the pin has no opinion.
 *
 * The editor's equivalent is `var(--accent-foreground)` in
 * `.map-pin__shape .pin-svg__body` — white in the light theme, which is the one
 * a snapshot's own `theme` field selects for. A pin that names its own ring or
 * icon colour overrides this in both renderers.
 */
const PIN_STROKE = "#ffffff";

/**
 * The image id for one pin. Shared by the registration pass and the feature
 * builder, so neither can drift from the other's naming.
 */
export function pinImageId(icon: string, color: string): string {
  return `pin:${icon}:${color}`;
}

/**
 * Every pin we have drawn, by the id above.
 *
 * The map registers its pins once, on load, and throws the canvas away — but the
 * results list draws the same pins on every keystroke, up to a hundred rows at a
 * time. Redrawing a path per row per character is work nobody asked for when a
 * map has three distinct pins on it, so the pixels are kept and each row copies
 * them.
 *
 * `null` is cached too: a canvas the browser refused is a permanent answer, and
 * retrying it once per row per keystroke is the cost this map exists to avoid.
 */
const drawn = new Map<string, HTMLCanvasElement | null>();

/**
 * The pin, as pixels a caller can put in the page.
 *
 * A canvas rather than an `<img>` with a data URI, on the same rule this file's
 * header sets out: a host page whose CSP restricts `img-src` blocks a data URI
 * outright and invisibly, and a canvas is not a fetch at all.
 *
 * An uploaded logo cannot be drawn synchronously — decoding one is a promise —
 * so a pin carrying an image comes back as its body alone until
 * `registerPinImageBitmaps` has filled the cache in, at which point the next
 * redraw picks the finished pin up. The alternative is an async list, which is a
 * hundred promises per keystroke for a handful of logos.
 */
export function pinCanvas(
  icon: string,
  color: string,
  custom?: readonly CustomPinIcon[],
): HTMLCanvasElement | null {
  const id = pinImageId(icon, color);
  const hit = drawn.get(id);

  if (hit !== undefined) return hit;

  // A place with no icon is a dot on the map, and the plain body is what a dot
  // is a picture of — so a row still gets a pin in the location's own colour
  // rather than an empty gap where the others have one.
  const pin = resolvePin(icon, custom) ?? PLAIN_PIN;
  const canvas = drawPin(pin, color);

  drawn.set(id, canvas);

  return canvas;
}

/**
 * What a location with no icon of its own draws in a list row.
 *
 * Deliberately not `resolvePin("")`, which answers null — the map draws those
 * places through a circle layer instead, and there is nothing there to reuse.
 */
const PLAIN_PIN: ResolvedPin = {
  key: "plain",
  paths: [],
  image: "",
  color: null,
  ring: null,
  ringWidth: PIN_RING_WIDTHS[DEFAULT_RING_WIDTH],
  iconColor: null,
  scale: PIN_SIZES[DEFAULT_PIN_SIZE],
  shape: DEFAULT_PIN_SHAPE,
};

/**
 * Register an image for every glyph pin the snapshot uses. Synchronous.
 *
 * Bounded and small: a map has at most 24 categories and 8 custom pins, and only
 * places carrying an icon appear here at all. Registration happens once, on load,
 * because `setPlaces` only ever filters an existing set — it can hide a pin but
 * never invent a combination that was not in the snapshot.
 *
 * Returns the ids it registered so the caller can tell a pin it can draw from one
 * it cannot; naming an image that does not exist makes MapLibre warn once per
 * feature, every frame.
 */
export function registerPinImages(
  map: MapLibreMap,
  pairs: Iterable<{ icon: string; color: string }>,
  custom?: readonly CustomPinIcon[],
): Set<string> {
  const registered = new Set<string>();

  for (const [id, pin, color] of unique(pairs, map, custom)) {
    // Image pins are the other pass. Handled there because they cannot be drawn
    // without awaiting a decode, and this one must not block the first frame.
    if (pin.image) continue;

    const canvas = drawPin(pin, color);
    drawn.set(id, canvas);
    if (!canvas) continue;

    const image = imageDataOf(canvas);
    if (!image) continue;

    map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
    registered.add(id);
  }

  return registered;
}

/**
 * The same for pins carrying an uploaded logo, which cannot be done in time for
 * the first frame.
 *
 * `createImageBitmap` is a promise however small the image is, so the choice is
 * between delaying every place on the map until the logos decode, and letting
 * those few places spend a frame or two as dots. The second is obviously right:
 * the rest of the map is not waiting on one customer's PNG, and a decode that
 * somehow never resolves costs a pin rather than the whole embed.
 *
 * Resolves with the ids it added, so the caller can widen its set and re-feed the
 * source once — the only reason a place's shape ever changes after load.
 */
export async function registerPinImageBitmaps(
  map: MapLibreMap,
  pairs: Iterable<{ icon: string; color: string }>,
  custom?: readonly CustomPinIcon[],
): Promise<Set<string>> {
  const registered = new Set<string>();

  const jobs = [...unique(pairs, map, custom)]
    .filter(([, pin]) => Boolean(pin.image))
    .map(async ([id, pin, color]) => {
      const bitmap = await decode(pin.image);
      if (!bitmap) return;

      const canvas = drawPin(pin, color, bitmap);
      bitmap.close();
      if (!canvas) return;

      // Overwrites whatever the list drew for this pin while the logo was still
      // decoding — its own attempt is the body alone, because it cannot wait.
      // The next redraw (any keystroke, any filter) picks the finished pin up.
      drawn.set(id, canvas);

      const image = imageDataOf(canvas);
      if (!image) return;

      // Between the decode starting and finishing the map may have been removed
      // from the page, and addImage on a torn-down map throws.
      if (!map.getCanvas()) return;

      map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
      registered.add(id);
    });

  await Promise.allSettled(jobs);

  return registered;
}

/**
 * Pairs → the distinct images that actually need drawing, resolved and keyed.
 *
 * Shared by both passes so neither can disagree with the other about which id
 * belongs to which pin — and so a pin the map already has is skipped once rather
 * than in two places.
 */
function* unique(
  pairs: Iterable<{ icon: string; color: string }>,
  map: MapLibreMap,
  custom?: readonly CustomPinIcon[],
): Generator<[string, ResolvedPin, string]> {
  const seen = new Set<string>();

  for (const { icon, color } of pairs) {
    const pin = resolvePin(icon, custom);
    if (!pin) continue;

    const id = pinImageId(icon, color);
    if (seen.has(id) || map.hasImage(id)) continue;

    seen.add(id);
    yield [id, pin, color];
  }
}

/**
 * One pin as pixels.
 *
 * The whole box, square. This used to be cropped at the teardrop's tip so that a
 * layer anchored `bottom` would put the point on the coordinate — a ball has no
 * tip, so the image is the pin's own square and the layer anchors `center`
 * (./map.ts). One less number shared between a canvas and a layer spec.
 */
function drawPin(
  pin: ResolvedPin,
  color: string,
  bitmap?: ImageBitmap,
): HTMLCanvasElement | null {
  // The pin's own size multiplies the raster rather than the geometry: one more
  // pixel per unit, not a different pin. The symbol layer keeps `icon-size: 1`
  // and the image is still the pin's own square, so nothing downstream changes.
  const scale = (PIN_SIZE / PIN_BOX) * PIXEL_RATIO * pin.scale;
  const width = Math.ceil(PIN_BOX * scale);
  const height = width;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  // Canvas is unavailable often enough to be worth surviving: a blocked or
  // headless renderer should cost the icon, not the map.
  if (!context) return null;

  context.scale(scale, scale);
  // The diamond's corners, matching `stroke-linejoin: round` in the editor's CSS.
  // Mitred, a thick ring spikes well past the shape it is outlining.
  context.lineJoin = "round";
  context.lineCap = "round";

  // The same path string the editor drops into its markup — `Path2D` reads SVG
  // path data, which is why the shape table can hold one description of a
  // diamond instead of an arc here and a `d` there.
  const body = new Path2D(PIN_SHAPES[pin.shape].path);

  context.fillStyle = color;
  context.fill(body);

  if (pin.ringWidth > 0) {
    context.strokeStyle = pin.ring ?? PIN_STROKE;
    context.lineWidth = pin.ringWidth;
    context.stroke(body);
  }

  if (bitmap) drawImageHead(context, bitmap, pin);
  else drawGlyphHead(context, pin);

  return canvas;
}

/**
 * The same pixels, in the form `addImage` takes.
 *
 * Split out when the list started wanting the canvas itself: MapLibre needs the
 * bytes and a results row needs something it can put in the page, and drawing
 * the pin twice to serve both is how the two would end up different pictures of
 * one pin.
 */
function imageDataOf(canvas: HTMLCanvasElement): ImageData | null {
  // Same context as `drawPin` used — `getContext` returns the one it made.
  return (
    canvas
      .getContext("2d")
      ?.getImageData(0, 0, canvas.width, canvas.height) ?? null
  );
}

/*
 * The glyph is drawn in its own 24-unit box and mapped into the pin, so the
 * numbers here are lucide's own and stay comparable with the SVG the editor
 * emits. The stroke width is set before the scale is applied and therefore
 * shrinks with it — which is why GLYPH_STROKE_WIDTH is thicker than lucide's 2 to
 * begin with.
 */
function drawGlyphHead(context: CanvasRenderingContext2D, pin: ResolvedPin): void {
  const box = glyphBoxFor(pin.shape);
  const glyphScale = box.size / GLYPH_SOURCE_BOX;

  context.translate(box.x, box.y);
  context.scale(glyphScale, glyphScale);
  context.lineWidth = GLYPH_STROKE_WIDTH;
  // Set outright rather than inherited from the body's stroke above. It used to
  // be inherited, which was invisible while both were white and would have bled
  // a custom ring colour into the glyph the moment they could differ.
  context.strokeStyle = pin.iconColor ?? PIN_STROKE;

  for (const path of pin.paths) context.stroke(new Path2D(path));
}

/**
 * The logo, clipped to the circle the editor's CSS clips it to.
 *
 * `arc` + `clip` here against `clip-path: circle(50%)` there — two mechanisms for
 * one shape, which is exactly why both read `imageCircleFor` rather than each
 * having its own radius. It takes the shape because a diamond holds a smaller
 * circle than a ball does. The image arrives square and pre-fitted from
 * lib/map/normalise-pin-image.ts, so the contain-fit below is belt and braces
 * against a snapshot published by some other version.
 */
function drawImageHead(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  pin: ResolvedPin,
): void {
  const circle = imageCircleFor(pin.shape);
  const box = imageBoxFor(pin.shape);

  context.save();
  context.beginPath();
  context.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
  context.clip();

  const fit = Math.min(box.size / bitmap.width, box.size / bitmap.height);
  const width = bitmap.width * fit;
  const height = bitmap.height * fit;

  context.drawImage(bitmap, circle.cx - width / 2, circle.cy - height / 2, width, height);
  context.restore();
}

/**
 * A data URI → an ImageBitmap, without ever handing a URL to the browser.
 *
 * The base64 is turned into bytes here and passed as a Blob, so nothing is
 * fetched and there is no `img-src` for a host page's CSP to refuse. Setting the
 * data URI on an `<img>` would be shorter and is exactly what this file exists to
 * avoid.
 *
 * Null on anything malformed. A snapshot is a static file on a CDN and a
 * half-written one is a real possibility (lib/snapshot/storage.ts); a pin that
 * fails to decode should cost that pin its shape, not throw inside a load handler
 * on a customer's site.
 */
async function decode(dataUri: string): Promise<ImageBitmap | null> {
  const comma = dataUri.indexOf(",");
  if (comma < 0) return null;

  try {
    const type = dataUri.slice("data:".length, comma).split(";")[0];
    const binary = atob(dataUri.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return await createImageBitmap(new Blob([bytes], { type }));
  } catch {
    return null;
  }
}
