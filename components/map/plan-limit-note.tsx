import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { headroomMessage, type PlanHeadroom } from "@/lib/map/plan-headroom";
import type { LimitedResource } from "@/lib/repositories/errors";

/**
 * Why the controls above this are switched off.
 *
 * The one line that makes greying a control acceptable. Disabling the pin tiles
 * and the drawing tools at the plan limit was tried once before and reverted —
 * see lib/query/plan-limit-toast.ts — because what the user got was a grey
 * button and nothing else, and a control that only goes quiet is
 * indistinguishable from a broken one. The grey is back because this is beside
 * it: the reason arrives with the refusal instead of a gesture later.
 *
 * It is rendered *inside* the popover, which is why both toolbar buttons still
 * open their menus at the limit. A button that refused to open would hide the
 * only copy of this sentence behind the very state it explains.
 *
 * `id` comes from the caller rather than a `useId()` here, because the tiles
 * above point at it with `aria-describedby` and the two have to agree. The
 * caller owns both.
 *
 * Amber from `--warning-ink`, not `--warning`. The latter is a fill token with
 * a `--warning-foreground` partner and lands near 2:1 as a text colour; this one
 * carries its own contrast, which is the distinction components/places/import/
 * mapping-step/confidence-mark.tsx sets out.
 */
export function PlanLimitNote({
  id,
  resource,
  headroom,
}: {
  id: string;
  /** Which allowance is spent — picks the nouns in the sentence. */
  resource: LimitedResource;
  headroom: PlanHeadroom;
}) {
  return <PlanNote id={id}>{headroomMessage(resource, headroom)}</PlanNote>;
}

/**
 * The same line, for a plan that does not include a feature at all.
 *
 * Split out rather than given a second set of props because the two differ only
 * in where the sentence comes from: a limit composes one from a count and a
 * ceiling, a gate has nothing to count and its sentence arrives whole from
 * `planFeatureNote`. What must not differ is how it looks or how it is
 * announced — a second amber line built by hand would drift from this one.
 */
export function PlanNote({
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
