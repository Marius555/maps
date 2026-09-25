import { DOT_MAX_LANES, dotInsetSize } from "@/packages/shared/dot-line";
import {
  strokeWidthOf,
  type ShapeGeometry,
  type ShapeStrokeStyle,
} from "@/packages/shared/shapes";

/**
 * Where dotted or dashed routes share a road, and how to draw them there as one
 * stream.
 *
 * Two dotted routes along the same street each placed their own dots from their
 * own start, so the stretch they share drew twice the dots, out of phase — noise
 * rather than two routes. Dashed routes did the same with dashes. This splits
 * every such line into runs: its own stretches, drawn as they always were, and
 * shared stretches, where every route on it is handed **the same coordinate
 * array** and a lane. The renderers then draw a shared stretch as one stream
 * with the routes taking turns — see `DOT_MAX_LANES` in
 * packages/shared/dot-line.ts for the mechanism.
 *
 * Dotted merges with dotted and dashed with dashed, never across: a stretch
 * alternating dots with dashes would be a third marking nobody chose.
 *
 * Dashboard-side only. The editor calls it on every redraw and the snapshot
 * builder once per publish, so the embed receives the runs already worked out
 * and carries none of the geometry below.
 *
 * **The rule that keeps it consistent is that every decision is made once, from
 * the later route's side.** A segment of a later route that lies along an
 * earlier one is *covered*: it stops drawing itself, and becomes an interval
 * along its leader (the earliest route it lies on). The leader then splits its
 * own uncovered geometry at every interval's ends and draws each piece with
 * everyone whose interval covers it. Deciding "shared" separately from both
 * sides would disagree at the ends, and a disagreement is either a gap in a
 * route or a stretch drawn twice — the very thing this exists to remove.
 */

/** The two markings that share a road by taking turns. */
export type LaneStroke = "dotted" | "dashed";

export type DotLine = {
  id: string;
  stroke: LaneStroke;
  points: readonly (readonly [number, number])[];
  /** The resolved stroke width, in pixels. */
  width: number;
};

export type DotRun = {
  id: string;
  stroke: LaneStroke;
  /** Shared by reference between every member of one stretch. */
  points: [number, number][];
  /** The widest member's, so every dot on a stretch is one size. */
  width: number;
  lane: number;
  lanes: number;
  /**
   * The run starts where its route was cut, not at the route's own start — so
   * its first dot is held back, clear of the last dot of the run before. The
   * `text-size` that does it; see `dotInsetSize`. Only on a dotted run drawn
   * alone: a shared stretch places its own dots (`dotStream`), and a dash
   * needs no room.
   */
  inset?: number;
};

/** How far from another route a point may sit and still be on it, in metres. */
export const DOT_LANE_TOLERANCE_M = 6;

/**
 * The shortest stretch worth merging. Below it two routes are crossing or
 * touching at a junction, not sharing a road, and a two-dot corridor would only
 * break both rhythms for nothing.
 */
export const DOT_LANE_MIN_SHARED_M = 30;

/** Two segments further apart than this in heading are not the same road. */
const MAX_ANGLE_SIN = Math.sin((25 * Math.PI) / 180);

/** How often a long segment is sampled when testing it lies along another. */
const SAMPLE_STEP_M = 20;

const EARTH_M_PER_DEG = 111_320;

/**
 * Every line, as runs. A line nothing overlaps comes back as one run of its own
 * points, `lanes: 1`; callers can check `lanes > 1` on any run to know whether
 * anything was merged at all.
 *
 * `lines` is in drawing order — the first route on a stretch is its leader,
 * whose geometry everyone draws and whose dots take lane 0.
 */
export function dotLanes(lines: readonly DotLine[]): DotRun[] {
  return [
    ...strokeLanes(lines.filter((line) => line.stroke === "dotted")),
    ...strokeLanes(lines.filter((line) => line.stroke === "dashed")),
  ];
}

/** `dotLanes` for lines that all wear the same marking. */
function strokeLanes(lines: readonly DotLine[]): DotRun[] {
  const usable = lines.filter((line) => line.points.length >= 2);
  if (usable.length < 2) return usable.map(solo);

  const projection = projector(usable);
  const tracks = usable.map((line) => track(line, projection));

  /*
   * Per line: which earlier line each segment rides on (-1 for none), and the
   * intervals other lines hand it as their leader.
   */
  const leaderOf = tracks.map((line, index) => segmentLeaders(line, tracks, index));
  const intervals: { from: number; to: number; rider: number }[][] = tracks.map(() => []);

  for (let index = 0; index < tracks.length; index += 1) {
    for (const range of ranges(leaderOf[index])) {
      if (range.value < 0) continue;

      const line = tracks[index];
      const leader = tracks[range.value];
      const length = line.arc[range.end + 1] - line.arc[range.start];

      // Too short to be a shared road: this line draws it itself after all.
      if (length < DOT_LANE_MIN_SHARED_M) {
        leaderOf[index].fill(-1, range.start, range.end + 1);
        continue;
      }

      const a = project(leader, line.xy[range.start]);
      const b = project(leader, line.xy[range.end + 1]);
      intervals[range.value].push({
        from: Math.min(a, b),
        to: Math.max(a, b),
        rider: index,
      });
    }
  }

  const runs: DotRun[] = [];

  tracks.forEach((line, index) => {
    for (const range of ranges(leaderOf[index])) {
      if (range.value >= 0) continue;
      runs.push(
        ...ledRuns(
          line,
          index,
          line.arc[range.start],
          line.arc[range.end + 1],
          intervals[index],
          tracks,
        ),
      );
    }
  });

  return runs;
}

type Track = {
  line: DotLine;
  /** Projected metres, one per point. */
  xy: [number, number][];
  /** Distance along the line at each point. */
  arc: number[];
  /** Segment index by grid cell, for nearest-segment queries. */
  grid: Map<string, number[]>;
  box: [number, number, number, number];
};

function solo(line: DotLine): DotRun {
  return {
    id: line.id,
    stroke: line.stroke,
    points: line.points.map(([lng, lat]) => [lng, lat]),
    width: line.width,
    lane: 0,
    lanes: 1,
  };
}

/** Equirectangular about the lines' mean latitude — metres, near enough. */
function projector(lines: readonly DotLine[]) {
  let sum = 0;
  let count = 0;

  for (const line of lines) {
    for (const [, lat] of line.points) {
      sum += lat;
      count += 1;
    }
  }

  const kx = EARTH_M_PER_DEG * Math.cos(((sum / count) * Math.PI) / 180);

  return ([lng, lat]: readonly [number, number]): [number, number] => [
    lng * kx,
    lat * EARTH_M_PER_DEG,
  ];
}

const CELL_M = 50;

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / CELL_M)}:${Math.floor(y / CELL_M)}`;
}

function track(
  line: DotLine,
  projection: (point: readonly [number, number]) => [number, number],
): Track {
  const xy = line.points.map(projection);
  const arc = [0];
  const grid = new Map<string, number[]>();
  const box: [number, number, number, number] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
  ];

  for (let segment = 0; segment < xy.length - 1; segment += 1) {
    const [ax, ay] = xy[segment];
    const [bx, by] = xy[segment + 1];

    arc.push(arc[segment] + Math.hypot(bx - ax, by - ay));

    // Every cell the segment's padded box touches: a query then only has to
    // look in the one cell its point falls in.
    const x0 = Math.floor((Math.min(ax, bx) - DOT_LANE_TOLERANCE_M) / CELL_M);
    const x1 = Math.floor((Math.max(ax, bx) + DOT_LANE_TOLERANCE_M) / CELL_M);
    const y0 = Math.floor((Math.min(ay, by) - DOT_LANE_TOLERANCE_M) / CELL_M);
    const y1 = Math.floor((Math.max(ay, by) + DOT_LANE_TOLERANCE_M) / CELL_M);

    for (let cx = x0; cx <= x1; cx += 1) {
      for (let cy = y0; cy <= y1; cy += 1) {
        const key = `${cx}:${cy}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(segment);
        else grid.set(key, [segment]);
      }
    }

    box[0] = Math.min(box[0], ax, bx);
    box[1] = Math.min(box[1], ay, by);
    box[2] = Math.max(box[2], ax, bx);
    box[3] = Math.max(box[3], ay, by);
  }

  return { line, xy, arc, grid, box };
}

/** The nearest point of `on` to `point`: its distance, arc position and segment. */
function nearest(
  on: Track,
  [px, py]: readonly [number, number],
): { distance: number; at: number; segment: number } | null {
  const candidates = on.grid.get(cellKey(px, py));
  if (!candidates) return null;

  let best: { distance: number; at: number; segment: number } | null = null;

  for (const segment of candidates) {
    const [ax, ay] = on.xy[segment];
    const [bx, by] = on.xy[segment + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const length2 = dx * dx + dy * dy;
    const t =
      length2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length2));
    const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));

    if (!best || distance < best.distance) {
      best = {
        distance,
        at: on.arc[segment] + t * Math.sqrt(length2),
        segment,
      };
    }
  }

  return best;
}

/** Where along `on` a point lands, in metres from its start. */
function project(on: Track, point: readonly [number, number]): number {
  return nearest(on, point)?.at ?? 0;
}

/**
 * Whether one segment of `line` runs along `on`: sampled end to end, every
 * sample within tolerance, and heading the same way (or the opposite way — a
 * route back along the road it came is still sharing it).
 */
function liesAlong(line: Track, segment: number, on: Track): boolean {
  const [ax, ay] = line.xy[segment];
  const [bx, by] = line.xy[segment + 1];
  const length = line.arc[segment + 1] - line.arc[segment];
  const steps = Math.min(20, Math.max(1, Math.ceil(length / SAMPLE_STEP_M)));

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const hit = nearest(on, [ax + t * (bx - ax), ay + t * (by - ay)]);
    if (!hit || hit.distance > DOT_LANE_TOLERANCE_M) return false;
  }

  // Heading, at the middle, and only where the segment is long enough to have a
  // meaningful one — a crossing street passes the distance test at the junction.
  if (length <= 2 * DOT_LANE_TOLERANCE_M) return true;

  const middle = nearest(on, [(ax + bx) / 2, (ay + by) / 2]);
  if (!middle) return false;

  const onLength = on.arc[middle.segment + 1] - on.arc[middle.segment];
  if (onLength === 0) return true;

  const [cx, cy] = on.xy[middle.segment];
  const [dx, dy] = on.xy[middle.segment + 1];
  const cross =
    ((bx - ax) * (dy - cy) - (by - ay) * (dx - cx)) / (length * onLength);

  return Math.abs(cross) <= MAX_ANGLE_SIN;
}

function overlaps(a: Track["box"], b: Track["box"]): boolean {
  const pad = DOT_LANE_TOLERANCE_M;
  return (
    a[0] - pad <= b[2] && b[0] - pad <= a[2] && a[1] - pad <= b[3] && b[1] - pad <= a[3]
  );
}

/** Per segment of line `index`: the earliest line it runs along, or -1. */
function segmentLeaders(line: Track, tracks: readonly Track[], index: number): number[] {
  const leaders = new Array<number>(line.xy.length - 1).fill(-1);
  const earlier = tracks
    .slice(0, index)
    .map((other, at) => (overlaps(line.box, other.box) ? at : -1))
    .filter((at) => at >= 0);

  if (earlier.length === 0) return leaders;

  for (let segment = 0; segment < leaders.length; segment += 1) {
    leaders[segment] =
      earlier.find((at) => liesAlong(line, segment, tracks[at])) ?? -1;
  }

  return leaders;
}

/** Consecutive equal values, as inclusive index ranges. */
function ranges(values: readonly number[]): { start: number; end: number; value: number }[] {
  const out: { start: number; end: number; value: number }[] = [];

  for (let at = 0; at < values.length; at += 1) {
    const last = out.at(-1);
    if (last && last.value === values[at] && last.end === at - 1) last.end = at;
    else out.push({ start: at, end: at, value: values[at] });
  }

  return out;
}

/**
 * The runs a leader draws over one stretch of its own geometry: cut at every
 * interval's ends, each piece drawn by the leader and every rider covering it.
 */
function ledRuns(
  leader: Track,
  index: number,
  from: number,
  to: number,
  intervals: readonly { from: number; to: number; rider: number }[],
  tracks: readonly Track[],
): DotRun[] {
  const cuts = new Set([from, to]);
  for (const interval of intervals) {
    if (interval.from > from && interval.from < to) cuts.add(interval.from);
    if (interval.to > from && interval.to < to) cuts.add(interval.to);
  }

  const sorted = [...cuts].sort((a, b) => a - b);
  const runs: DotRun[] = [];

  for (let at = 0; at < sorted.length - 1; at += 1) {
    const start = sorted[at];
    const end = sorted[at + 1];
    if (end - start <= 0) continue;

    const middle = (start + end) / 2;
    const riders = [
      ...new Set(
        intervals
          .filter((interval) => interval.from <= middle && interval.to >= middle)
          .map((interval) => interval.rider),
      ),
    ].sort((a, b) => a - b);

    const points = slice(leader, start, end);
    if (points.length < 2) continue;

    const members = [index, ...riders];
    const lanes = Math.min(members.length, DOT_MAX_LANES);
    const width = Math.max(...members.map((member) => tracks[member].line.width));

    members.forEach((member, rank) => {
      const runWidth = lanes > 1 ? width : tracks[member].line.width;
      const stroke = tracks[member].line.stroke;

      runs.push({
        id: tracks[member].line.id,
        stroke,
        points,
        width: runWidth,
        lane: rank % lanes,
        lanes,
        ...(start > 0 && lanes === 1 && stroke === "dotted"
          ? { inset: dotInsetSize(runWidth) }
          : {}),
      });
    });
  }

  return runs;
}

/** The leader's own coordinates between two distances along it. */
function slice(on: Track, from: number, to: number): [number, number][] {
  const { arc } = on;
  const points = on.line.points;
  const out: [number, number][] = [pointAt(on, from)];

  for (let at = 0; at < points.length; at += 1) {
    if (arc[at] > from && arc[at] < to) out.push([points[at][0], points[at][1]]);
  }

  out.push(pointAt(on, to));
  return out;
}

function pointAt(on: Track, distance: number): [number, number] {
  const { arc } = on;
  const points = on.line.points;
  let segment = 0;

  while (segment < arc.length - 2 && arc[segment + 1] < distance) segment += 1;

  const length = arc[segment + 1] - arc[segment];
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, (distance - arc[segment]) / length));
  const [ax, ay] = points[segment];
  const [bx, by] = points[segment + 1];

  return [ax + t * (bx - ax), ay + t * (by - ay)];
}

/**
 * The dotted and dashed lines among some shapes, in the order both renderers
 * merge them.
 *
 * One function so the editor and the snapshot agree on *which* route leads a
 * stretch: sorted by `sortOrder`, then id, rather than trusting whatever order
 * each caller happens to hold its array in. A different leader is a different
 * geometry and a different colour on lane 0 — the preview panel beside the
 * editor would show it.
 */
export function dotLinesOf(
  shapes: readonly {
    id: string;
    geometry: ShapeGeometry;
    strokeStyle: ShapeStrokeStyle;
    strokeWidth: number | null;
    sortOrder: number;
  }[],
): DotLine[] {
  return shapes
    .filter(
      (shape) =>
        (shape.strokeStyle === "dotted" || shape.strokeStyle === "dashed") &&
        shape.geometry.kind === "line",
    )
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((shape) => ({
      id: shape.id,
      stroke: shape.strokeStyle === "dashed" ? ("dashed" as const) : ("dotted" as const),
      points: shape.geometry.kind === "line" ? shape.geometry.points : [],
      width: strokeWidthOf(true, shape.strokeWidth),
    }));
}
