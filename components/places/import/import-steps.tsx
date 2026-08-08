import type { ImportStep } from "@/lib/stores/import-store";

const STEPS: { id: ImportStep; label: string }[] = [
  { id: "file", label: "File" },
  { id: "mapping", label: "Columns" },
  { id: "geocoding", label: "Addresses" },
  { id: "review", label: "Review" },
];

/**
 * Where you are in the import.
 *
 * A four-step flow with a slow middle step needs to say how much is left; the
 * ordered list is the accessible version of that, with the visual state layered
 * on top.
 */
export function ImportSteps({ current }: { current: ImportStep }) {
  const currentIndex =
    current === "done"
      ? STEPS.length
      : STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <li key={step.id} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted">
                →
              </span>
            ) : null}
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={
                isCurrent
                  ? "font-medium text-foreground"
                  : isDone
                    ? "text-muted"
                    : "text-muted/60"
              }
            >
              {step.label}
              {isDone ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
