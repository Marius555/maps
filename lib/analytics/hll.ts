/**
 * How many different visitors, without keeping a list of them.
 *
 * A HyperLogLog sketch: 1,024 one-byte slots that together estimate how many
 * distinct keys were added, to within about 3%, in the same 1.4KB whether that
 * was ten visitors or ten million. It exists because of the two constraints the
 * whole Analytics page is built around (./fold.ts):
 *
 * - **A day's figures must merge.** Unique visitors do not add up — somebody who
 *   came on Monday and Thursday is one visitor for the week, not two — so a
 *   daily count cannot be summed into a weekly one. Two sketches *do* merge,
 *   slot by slot, by taking the larger value, and the result is exactly the
 *   sketch of the union.
 * - **A day's figures must be bounded.** A rollup is one JSON column, so the
 *   alternative — every visitor key a day saw — would grow with traffic.
 *
 * Small counts are near exact: below a few thousand the estimate is linear
 * counting over the empty slots, which for a handful of visitors lands on the
 * true number.
 *
 * Keys are the visitor keys from lib/analytics/collect/visitor-key.ts —
 * sixteen hex characters of SHA-256, so already uniformly distributed and used
 * as the hash directly. Anything else is ignored rather than guessed at.
 *
 * Pure and client-safe: no crypto, no Buffer, no environment.
 */

/** 2^10 slots. The standard error is 1.04 / √1024 ≈ 3.25%. */
const PRECISION = 10;
const SLOTS = 1 << PRECISION;

/** One byte per slot; the largest rank a 64-bit key can produce is 55. */
export type Sketch = Uint8Array;

const KEY = /^[0-9a-f]{16}$/;

export function emptySketch(): Sketch {
  return new Uint8Array(SLOTS);
}

/** Count one key into a sketch. Mutates, because it runs per session. */
export function addKey(sketch: Sketch, key: string): void {
  if (!KEY.test(key)) return;

  const high = parseInt(key.slice(0, 8), 16);
  const low = parseInt(key.slice(8, 16), 16);

  // The top ten bits choose the slot; the remaining 54 give the rank — the
  // position of the first set bit, counted from one.
  const slot = high >>> (32 - PRECISION);
  const rest = high & ((1 << (32 - PRECISION)) - 1);

  const rank =
    rest !== 0
      ? Math.clz32(rest) - PRECISION + 1
      : low !== 0
        ? 32 - PRECISION + Math.clz32(low) + 1
        : 64 - PRECISION + 1;

  if (rank > sketch[slot]) sketch[slot] = rank;
}

/** Fold `source` into `target` — the union of what each has seen. */
export function mergeSketch(target: Sketch, source: Sketch): void {
  const length = Math.min(target.length, source.length);

  for (let index = 0; index < length; index += 1) {
    if (source[index] > target[index]) target[index] = source[index];
  }
}

/** How many distinct keys the sketch has seen, estimated and rounded. */
export function estimate(sketch: Sketch): number {
  let harmonic = 0;
  let empty = 0;

  for (const rank of sketch) {
    harmonic += 2 ** -rank;
    if (rank === 0) empty += 1;
  }

  if (empty === SLOTS) return 0;

  const alpha = 0.7213 / (1 + 1.079 / SLOTS);
  const raw = (alpha * SLOTS * SLOTS) / harmonic;

  // Linear counting for the small range, which is where almost every map on
  // this product lives and where the raw estimator is badly biased.
  if (raw <= 2.5 * SLOTS && empty > 0) {
    return Math.round(SLOTS * Math.log(SLOTS / empty));
  }

  return Math.round(raw);
}

export function isEmptySketch(sketch: Sketch): boolean {
  return sketch.every((rank) => rank === 0);
}

/** For `mapDaily.totals`. Base64 of the slots, ~1.4KB. */
export function sketchToString(sketch: Sketch): string {
  let binary = "";
  for (const rank of sketch) binary += String.fromCharCode(rank);

  return btoa(binary);
}

/**
 * A stored sketch, read back.
 *
 * Never throws, like every reader in ./fold.ts: anything that is not a sketch
 * of the right size — a row from an older build, a hand edit — reads as empty.
 */
export function sketchFromString(value: unknown): Sketch {
  if (typeof value !== "string" || !value) return emptySketch();

  try {
    const binary = atob(value);
    if (binary.length !== SLOTS) return emptySketch();

    const sketch = emptySketch();
    for (let index = 0; index < SLOTS; index += 1) {
      sketch[index] = Math.min(binary.charCodeAt(index), 64);
    }

    return sketch;
  } catch {
    return emptySketch();
  }
}
