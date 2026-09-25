import { dotSpacingFor } from "./dot-line";

/**
 * The dots of a stretch several dotted routes share, worked out here rather
 * than by MapLibre's symbol layout.
 *
 * The routes take turns, A·B·A·B, at the density one route draws alone. Doing
 * that with symbols fails at every tile edge (see `DOT_MAX_LANES` for why), so
 * on a shared stretch the positions are computed for the map's current whole
 * zoom level and drawn as a `circle` layer. Circles are sized in pixels and
 * round at every zoom, like the symbol dots.
 *
 * **Computed at the whole zoom level, on purpose.** MapLibre lays a tile's
 * symbols out at its integer zoom and scales them until the next one, so a
 * solo dotted route's spacing opens up to 2× between levels. Placing these
 * dots at `floor(zoom)` and leaving them where they are until the level
 * changes gives the stream exactly the same swing, so a stretch and the solo
 * parts either side of it open up together.
 *
 * Here because the editor and the embed must place identical dots, and the
 * publish preview draws both side by side. Zero dependencies, vanilla TS.
 */

/** MapLibre's tile size: one world is `TILE_SIZE × 2^zoom` pixels across. */
const TILE_SIZE = 512;

/** An area in Web Mercator pixels at one zoom level: min x, min y, max x, max y. */
export type DotBox = [number, number, number, number];

/** Where dots were last worked out for: a whole zoom level and an area. */
export type DotView = { level: number; box: DotBox };

/** West, south, east, north, in degrees. */
export type DotBounds = [number, number, number, number];

function worldSize(level: number): number {
  return TILE_SIZE * 2 ** level;
}

function toPixels(
  [lng, lat]: readonly [number, number],
  world: number,
): [number, number] {
  // Clamped to Web Mercator's own limit: a pole is infinitely far down.
  const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);

  return [
    ((lng + 180) / 360) * world,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
  ];
}

function toLngLat(x: number, y: number, world: number): [number, number] {
  return [
    (x / world) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world))) * 180) / Math.PI,
  ];
}

function inside(box: DotBox, x: number, y: number): boolean {
  return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
}

/**
 * One lane's dots along a shared stretch, as `[lng, lat]`.
 *
 * The stretch is cut into as many whole pitches as fit, and the leftover is
 * split evenly between its ends. So the first and last dots sit at least half a
 * pitch in from the cuts where routes meet or part, clear of the dots on the
 * other side. Dot `i` belongs to lane `i % lanes`. Every lane on a stretch gets
 * the same `points` and `width`, so the lanes interleave exactly.
 *
 * `box` limits the answer to one area, which keeps a long stretch at a high
 * zoom from being hundreds of thousands of dots nobody can see. A dot's number,
 * and so its lane, is counted from the start of the stretch whatever the box
 * is. A pan never recolours a dot.
 */
export function dotStream(
  points: readonly (readonly [number, number])[],
  width: number,
  lane: number,
  lanes: number,
  zoom: number,
  box?: DotBox,
): [number, number][] {
  const world = worldSize(Math.floor(zoom));
  const pitch = dotSpacingFor(width);
  const xy = points.map((point) => toPixels(point, world));

  const arc = [0];
  for (let at = 1; at < xy.length; at += 1) {
    arc.push(
      arc[at - 1] +
        Math.hypot(xy[at][0] - xy[at - 1][0], xy[at][1] - xy[at - 1][1]),
    );
  }

  const length = arc[arc.length - 1];
  const count = Math.floor(length / pitch);
  const start = (length - (count - 1) * pitch) / 2;
  const out: [number, number][] = [];

  for (let segment = 0; segment < xy.length - 1; segment += 1) {
    const [ax, ay] = xy[segment];
    const [bx, by] = xy[segment + 1];
    const from = arc[segment];
    const to = arc[segment + 1];

    if (to === from) continue;
    // A segment entirely outside the box: skip it without walking its dots.
    if (
      box &&
      (Math.max(ax, bx) < box[0] ||
        Math.min(ax, bx) > box[2] ||
        Math.max(ay, by) < box[1] ||
        Math.min(ay, by) > box[3])
    ) {
      continue;
    }

    // The first dot at or past this segment's start, then on to this lane's.
    let index = Math.max(0, Math.ceil((from - start) / pitch));
    index += (((lane - index) % lanes) + lanes) % lanes;

    for (; index < count; index += lanes) {
      const at = start + index * pitch;
      if (at >= to) break;

      const t = (at - from) / (to - from);
      const x = ax + t * (bx - ax);
      const y = ay + t * (by - ay);

      if (!box || inside(box, x, y)) out.push(toLngLat(x, y, world));
    }
  }

  return out;
}

/**
 * The view to work dots out for: the current whole zoom level, and what is on
 * screen padded by its own size on every side, so a pan has room to run before
 * anything is recomputed.
 */
export function dotView(bounds: DotBounds, zoom: number): DotView {
  const level = Math.floor(zoom);
  const [x0, y0, x1, y1] = viewBox(bounds, level);
  const padX = x1 - x0;
  const padY = y1 - y0;

  return { level, box: [x0 - padX, y0 - padY, x1 + padX, y1 + padY] };
}

/**
 * Whether dots worked out for `view` still serve the map as it is now: the
 * same whole zoom level, and the screen still inside the area they cover.
 */
export function dotViewHolds(
  view: DotView | null,
  bounds: DotBounds,
  zoom: number,
): boolean {
  if (!view || view.level !== Math.floor(zoom)) return false;

  const [x0, y0, x1, y1] = viewBox(bounds, view.level);
  return inside(view.box, x0, y0) && inside(view.box, x1, y1);
}

function viewBox([west, south, east, north]: DotBounds, level: number): DotBox {
  const world = worldSize(level);
  const [x0, y0] = toPixels([west, north], world);
  const [x1, y1] = toPixels([east, south], world);

  return [x0, y0, x1, y1];
}
