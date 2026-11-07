/**
 * What the Publish footer's two steppers share — "Your store" inside the
 * Shopify admin (`lib/shopify/storefront-step.ts`) and "Your website"
 * everywhere else (`lib/publish/website-step.ts`).
 *
 * **Three steps, always the same three, always in the same order** (the
 * owner's call, 2026-11-07): get the map out, put it on the site, keep it
 * current. The third is a status step — "Up to date", or Redeploy when there
 * are edits — and nothing is ever added, removed or renumbered.
 *
 * It replaced an ordered list numbered by position, where a Redeploy step
 * appeared at ② whenever there were edits and vanished once pressed, so the
 * step after it slid up into its number. The owner read that as the flow
 * going nowhere: press ②, and you are on ② again with ③ gone.
 *
 * A stepper's state is therefore one number, how far along it is
 * (`statesAt`): every step before it done, that one current, every step after
 * it upcoming. Progress cannot skip ahead or leave a gap, by construction.
 */
export type StepState = "done" | "current" | "upcoming";

export type StepStates<Id extends string> = Record<Id, StepState>;

/**
 * The states for a stepper `at` steps along: `0` is the first step current,
 * `order.length` is every step done.
 */
export function statesAt<Id extends string>(order: readonly Id[], at: number): StepStates<Id> {
  return Object.fromEntries(
    order.map((id, index) => [id, index < at ? "done" : index === at ? "current" : "upcoming"]),
  ) as StepStates<Id>;
}

/** How far along `steps` is — the index of the current step, or `order.length` when all are done. */
export function progressOf<Id extends string>(order: readonly Id[], steps: StepStates<Id>): number {
  const at = order.findIndex((id) => steps[id] !== "done");
  return at === -1 ? order.length : at;
}

/** The live map is behind the editor, or the map has never been published. */
export function needsPublish({
  hasPendingChanges,
  published,
}: {
  hasPendingChanges: boolean;
  published: boolean;
}): boolean {
  return hasPendingChanges || !published;
}
