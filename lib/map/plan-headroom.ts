import { planLimitUsage, type LimitedResource } from "@/lib/repositories/errors";
import type { PlanId } from "@/lib/repositories/plan-limits";

/**
 * How much of a plan's allowance is left, for the controls that spend it.
 *
 * The map editor's toolbar switches its pin tiles and drawing tools off at the
 * ceiling and says why underneath them, rather than letting the gesture run and
 * explaining the 403 afterwards. Doing that needs three facts at once — the
 * count, the ceiling and the plan's name — so they travel together.
 *
 * The same shape as `ImportHeadroom` in components/places/import/import-wizard.tsx,
 * which asks the same question of the same numbers a few screens away. They are
 * not merged because that one is a wizard prop assembled on the server from
 * `PLAN_LIMITS` directly, and this one is derived on the client from live query
 * data; folding them together would put a `"use client"` boundary in the middle
 * of an import step for no gain.
 *
 * Client-safe. `PlanId` is a type import from a `server-only` module, which is
 * erased at compile time, and `planLimitMessage` lives in errors.ts precisely
 * because that module has no runtime imports of its own.
 */
export type PlanHeadroom = {
  plan: PlanId;
  limit: number;
  used: number;
};

/**
 * Whether there is no room left.
 *
 * `>=` rather than `===`, matching the repositories: an import, a second tab or
 * a plan that changed underneath the page can all leave a map holding more than
 * its ceiling, and a control that came back to life once it was *over* the limit
 * would be the one case nobody tests.
 */
export function isAtLimit(headroom: PlanHeadroom): boolean {
  return headroom.used >= headroom.limit;
}

/**
 * The sentence, straight from the server's own composer.
 *
 * Deliberately a pass-through rather than copy written here: this is the first
 * half of what a create would have been refused with, said before the click
 * instead of after, so the words in the menu cannot drift from the words in the
 * 403.
 *
 * `planLimitUsage` and not `planLimitMessage` — the statement without the
 * remedy. The full message ends "delete a location to add another, or upgrade
 * for more", which is advice a *toast* owes because it interrupts something and
 * then leaves. This line sits under the tiles inside a menu the user opened, one
 * pane away from the list they would delete from, so the remedy is scenery and
 * the count is the news.
 */
export function headroomMessage(
  resource: LimitedResource,
  headroom: PlanHeadroom,
): string {
  return planLimitUsage(resource, headroom.limit, headroom.plan);
}
