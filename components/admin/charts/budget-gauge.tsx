import { formatCount } from "@/lib/format/number";

const CX = 100;
const CY = 100;
const R = 80;

/** A point on the half circle, `t` from 0 (left end) to 1 (right end). */
function at(t: number, radius: number): { x: number; y: number } {
  const angle = Math.PI * (1 - t);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

/**
 * Today's pooled lookups against the day's budget, as a half-circle gauge with
 * a tick where background work stands aside.
 *
 * Plain SVG rather than recharts: one arc needs no library, and drawn on the
 * server it is on screen with the page. The state is told in words under it as
 * well as in the arc's colour (status colours, which is what they are for),
 * and the figure is printed in the middle.
 */
export function BudgetGauge({
  used,
  budget,
  reserve,
}: {
  used: number;
  budget: number;
  /** Where background work stops, in lookups. */
  reserve: number;
}) {
  const safeBudget = Math.max(1, budget);
  const share = Math.min(1, used / safeBudget);
  const color =
    used >= budget ? "var(--danger)" : used >= reserve ? "var(--warning)" : "var(--success)";
  const state =
    used >= budget
      ? "Budget spent — lookups are refused until midnight UTC."
      : used >= reserve
        ? "Past the reserve — background work (syncs, sweeps) is paused."
        : "Under the reserve — everything runs.";

  const reserveAt = Math.min(1, reserve / safeBudget);
  const inner = at(reserveAt, R - 13);
  const outer = at(reserveAt, R + 13);
  const arc = `M${CX - R},${CY} A${R},${R} 0 0 1 ${CX + R},${CY}`;

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 200 112"
        className="mx-auto block w-full max-w-64"
        role="img"
        aria-label={`${formatCount(used)} of ${formatCount(budget)} lookups used today. ${state}`}
      >
        <path d={arc} fill="none" stroke="var(--default)" strokeWidth={14} strokeLinecap="round" />
        {share > 0 ? (
          <path
            d={arc}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${String(share * 100)} 100`}
          />
        ) : null}
        <line
          x1={inner.x}
          y1={inner.y}
          x2={outer.x}
          y2={outer.y}
          stroke="var(--foreground)"
          strokeOpacity={0.6}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <text
          x={CX}
          y={CY - 14}
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize={28}
          fontWeight={600}
        >
          {formatCount(used)}
        </text>
        <text x={CX} y={CY + 6} textAnchor="middle" fill="var(--muted)" fontSize={11}>
          of {formatCount(budget)} today
        </text>
      </svg>
      <p className="text-center text-xs text-pretty text-muted">{state}</p>
    </div>
  );
}
