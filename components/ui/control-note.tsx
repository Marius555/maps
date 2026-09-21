import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Why the control above this is switched off.
 *
 * The one line that makes greying a control acceptable. Disabling the pin tiles
 * and the drawing tools at the plan limit was tried once before and reverted —
 * see lib/query/plan-limit-toast.ts — because what the user got was a grey
 * button and nothing else, and a control that only goes quiet is
 * indistinguishable from a broken one. The grey is back because this is beside
 * it: the reason arrives with the refusal instead of a gesture later.
 *
 * Generic on purpose, and it lives in `components/ui` rather than beside the
 * plan limits it was written for because there are now three unrelated reasons a
 * control can be unavailable — an allowance spent, a feature the plan does not
 * include, and an email address nobody has confirmed. A second amber line built
 * by hand for the third one would drift from this one, and drift is what makes
 * two disabled states look like one bug.
 *
 * `id` comes from the caller rather than a `useId()` here, because the controls
 * above point at it with `aria-describedby` and the two have to agree. The
 * caller owns both.
 *
 * `role="status"`, not `alert`: this is the standing explanation of a state the
 * user is looking at, not an interruption.
 *
 * Amber from `--warning-ink`, not `--warning`. The latter is a fill token with
 * a `--warning-foreground` partner and lands near 2:1 as a text colour; this one
 * carries its own contrast, which is the distinction components/places/import/
 * mapping-step/confidence-mark.tsx sets out.
 */
export function ControlNote({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="status"
      className="flex items-start gap-1.5 text-xs text-warning-ink"
    >
      <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
