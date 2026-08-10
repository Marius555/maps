/**
 * Just enough colour maths to move a colour's lightness and leave its hue alone.
 *
 * Hand-rolled rather than a library because this ships inside the embed bundle,
 * where every kilobyte is spent against a budget (CLAUDE.md §4) and a dependency
 * here would be a dependency in every visitor's download. Culori and friends are
 * far larger than the ~40 lines actually needed.
 *
 * OKLab rather than HSL: HSL's "lightness" is not perceptual, so inverting it
 * turns a mid-blue and a mid-yellow into two very differently readable greys.
 * OKLab's L is perceptual, which is the whole point — a style's existing
 * typographic hierarchy survives being inverted through it.
 *
 * @see https://bottosson.github.io/posts/oklab/
 */

export type Rgba = { r: number; g: number; b: number; a: number };

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i;
const FUNCTIONAL = /^(rgba?|hsla?)\(([^)]+)\)$/i;

/**
 * Parses the colour notations that appear in real MapLibre styles: `#abc`,
 * `#aabbcc`, with or without an alpha pair, plus `rgb()`, `rgba()`, `hsl()` and
 * `hsla()`. Anything else — a named colour, a gradient, an expression — returns
 * null and is left untouched by the caller, which is the safe default.
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim();

  const short = HEX_SHORT.exec(value);
  if (short) {
    const [, r, g, b, a] = short;
    return {
      r: Number.parseInt(r + r, 16) / 255,
      g: Number.parseInt(g + g, 16) / 255,
      b: Number.parseInt(b + b, 16) / 255,
      a: a === undefined ? 1 : Number.parseInt(a + a, 16) / 255,
    };
  }

  const long = HEX_LONG.exec(value);
  if (long) {
    const [, r, g, b, a] = long;
    return {
      r: Number.parseInt(r, 16) / 255,
      g: Number.parseInt(g, 16) / 255,
      b: Number.parseInt(b, 16) / 255,
      a: a === undefined ? 1 : Number.parseInt(a, 16) / 255,
    };
  }

  const fn = FUNCTIONAL.exec(value);
  if (!fn) return null;

  const [, name, body] = fn;
  const parts = body.split(/[,\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;

  const alpha = parts[3] === undefined ? 1 : clamp01(number(parts[3]));

  if (name.toLowerCase().startsWith("hsl")) {
    const [r, g, b] = hslToRgb(
      number(parts[0]),
      number(parts[1]) / 100,
      number(parts[2]) / 100,
    );
    return { r, g, b, a: alpha };
  }

  return {
    r: channel(parts[0]),
    g: channel(parts[1]),
    b: channel(parts[2]),
    a: alpha,
  };
}

export function formatRgba({ r, g, b, a }: Rgba): string {
  const byte = (value: number) => Math.round(clamp01(value) * 255);

  return `rgba(${byte(r)}, ${byte(g)}, ${byte(b)}, ${round(clamp01(a), 3)})`;
}

/**
 * Perceptual lightness, 0 (black) to 1 (white). Also what the contrast tests
 * reason about.
 */
export function lightnessOf(color: Rgba): number {
  return rgbToOklab(color).l;
}

/**
 * Rebuilds a colour at a new perceptual lightness, optionally damping its
 * chroma. Hue is untouched, so a blue motorway shield stays blue.
 */
export function withLightness(
  color: Rgba,
  lightness: number,
  chromaScale = 1,
): Rgba {
  const { a: labA, b: labB } = rgbToOklab(color);

  return oklabToRgb({
    l: clamp01(lightness),
    a: labA * chromaScale,
    b: labB * chromaScale,
    alpha: color.a,
  });
}

/* -------------------------------------------------------------------------- */

type Oklab = { l: number; a: number; b: number };

function rgbToOklab({ r, g, b }: Rgba): Oklab {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb({ l, a, b, alpha }: Oklab & { alpha: number }): Rgba {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: clamp01(toSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_)),
    g: clamp01(toSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_)),
    b: clamp01(toSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)),
    a: alpha,
  };
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toSrgb(value: number): number {
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

function hslToRgb(
  hue: number,
  saturation: number,
  lightness: number,
): [number, number, number] {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lightness - 1)) * clamp01(saturation);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];

  return [r + m, g + m, b + m];
}

/** `255`, `100%` and `0.5` all appear in the wild. */
function channel(part: string): number {
  return part.includes("%") ? clamp01(number(part) / 100) : clamp01(number(part) / 255);
}

function number(part: string): number {
  const parsed = Number.parseFloat(part);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
