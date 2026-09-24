import { ProgressBar } from "@heroui/react";

/**
 * How far a deletion has got, counted in maps, the unit the owner knows they
 * have. A deletion is minutes on a large account, and a spinner with no number
 * is what makes somebody close the tab.
 *
 * Indeterminate for an account with no maps, where the only work left is the
 * few rows and the login, and a bar would go from nothing to done in one step.
 */
export function DeletionProgress({ total, left }: { total: number; left: number }) {
  const done = Math.max(0, total - left);

  return (
    <div className="space-y-2" aria-live="polite">
      <ProgressBar
        aria-label="Deleting your account"
        isIndeterminate={total === 0}
        value={done}
        minValue={0}
        maxValue={Math.max(1, total)}
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <p className="text-sm text-muted tabular-nums">
        {total === 0
          ? "Deleting your account…"
          : left === 0
            ? "Maps deleted. Finishing up…"
            : `Deleting maps… ${String(left)} of ${String(total)} left.`}{" "}
        Keep this tab open.
      </p>
    </div>
  );
}
