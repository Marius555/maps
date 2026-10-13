import { Label, ProgressBar } from "@heroui/react";
import { CircleAlert, CircleCheck, MapPin } from "lucide-react";

import { formatCount, formatRoughDuration } from "@/lib/format/number";

/**
 * The one progress indicator: a bar whose count moves per address found.
 *
 * Answers stream in one at a time (`lib/import/geocode-stream.ts`), so the
 * count itself is the sign of life — no spinner, no indeterminate sweep. There
 * was a version with all three, and it was three indicators saying "working"
 * while the only number on screen sat at 0. The count is the largest thing on
 * the step for the same reason, and the bar's own percentage is left off: it is
 * the count again, in a second unit.
 *
 * The time left sits opposite the count, where the eye already is. It used to
 * be the last clause of a paragraph of grey text, which is where nobody waiting
 * on it looked.
 *
 * Under the bar, one status line: the address being looked up right now, in the
 * user's own words, or how the run ended. It changes with every answer, which
 * shows the run moving without any animation, so it reads the same with reduced
 * motion on. Its icons are static for the same reason.
 */
export function GeocodeProgress({
  done,
  total,
  currentAddress,
  remainingMs,
  hasError,
}: {
  done: number;
  total: number;
  currentAddress: string | null;
  /** Measured once the first chunk has landed; null until then. */
  remainingMs: number | null;
  hasError: boolean;
}) {
  const percentage = total === 0 ? 100 : Math.round((done / total) * 100);
  const isFinished = !hasError && total > 0 && done >= total;

  return (
    <div className="space-y-3">
      <ProgressBar
        aria-label="Address lookup progress"
        className="w-full gap-2"
        size="lg"
        color={hasError ? "danger" : isFinished ? "success" : "accent"}
        value={percentage}
      >
        <Label className="flex items-baseline gap-1.5 font-normal">
          <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {formatCount(done)}
          </span>
          <span className="text-sm text-muted">
            of {formatCount(total)} {total === 1 ? "address" : "addresses"}
          </span>
        </Label>

        {/* In the slot `ProgressBar.Output` would take, so the bar's own grid
            keeps it on the count's line, opposite it. */}
        <span className="self-end text-xs text-muted tabular-nums [grid-area:output]">
          {remainingMs !== null && !hasError && !isFinished
            ? `About ${formatRoughDuration(remainingMs)} left`
            : null}
        </span>

        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      {/* Always rendered, so the line coming and going never moves the page. */}
      <p className="flex min-h-5 min-w-0 items-center gap-2 text-sm">
        <StatusLine
          hasError={hasError}
          isFinished={isFinished}
          currentAddress={currentAddress}
        />
      </p>
    </div>
  );
}

function StatusLine({
  hasError,
  isFinished,
  currentAddress,
}: {
  hasError: boolean;
  isFinished: boolean;
  currentAddress: string | null;
}) {
  if (hasError) {
    return (
      <>
        <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-danger" />
        <span className="text-danger">Lookup stopped</span>
      </>
    );
  }

  if (isFinished) {
    return (
      <>
        <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-success" />
        <span className="text-success">All addresses looked up</span>
      </>
    );
  }

  if (!currentAddress) return null;

  return (
    <>
      <MapPin aria-hidden="true" className="size-4 shrink-0 text-muted" />
      <span className="truncate text-foreground/80">
        <span className="sr-only">Looking up </span>
        {currentAddress}
      </span>
    </>
  );
}
