import { ControlNote } from "@/components/ui/control-note";
import { headroomMessage, type PlanHeadroom } from "@/lib/map/plan-headroom";
import type { LimitedResource } from "@/lib/repositories/errors";

/**
 * Why the controls above this are switched off, when the reason is a plan limit.
 *
 * The markup and the rules that go with it live in `components/ui/control-note.tsx`
 * — an email address nobody confirmed switches controls off too, and the two
 * states have to look identical or they read as two different bugs. This is the
 * plan-shaped wrapper: it knows how to turn a headroom into a sentence, and
 * nothing else.
 *
 * It is rendered *inside* the popover, which is why both toolbar buttons still
 * open their menus at the limit. A button that refused to open would hide the
 * only copy of this sentence behind the very state it explains.
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
  return <ControlNote id={id}>{headroomMessage(resource, headroom)}</ControlNote>;
}
