import type { ApiErrorCode } from "@/lib/api/error-codes";
import type { PlanId } from "./plan-limits";

/**
 * Errors repositories throw. Each carries the HTTP status and API code it should
 * become, so the route layer maps them without a switch statement full of guesses.
 *
 * `message` is user-facing and follows CLAUDE.md §8: say what happened and how to
 * fix it. The client renders it verbatim and never composes error copy itself.
 */
export class RepositoryError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends RepositoryError {
  constructor(message = "Log in to continue.") {
    super("unauthorized", message, 401);
  }
}

export class ForbiddenError extends RepositoryError {
  constructor(message = "You don't have access to that.") {
    super("forbidden", message, 403);
  }
}

export class NotFoundError extends RepositoryError {
  constructor(message = "We couldn't find that.") {
    super("not_found", message, 404);
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super("conflict", message, 409);
  }
}

/**
 * Thrown when a plan limit is hit. Carries the structured facts so the message
 * is composed in exactly one place.
 */
export type LimitedResource = "maps" | "places" | "shapes";

export class PlanLimitError extends RepositoryError {
  constructor(
    readonly resource: LimitedResource,
    readonly limit: number,
    readonly plan: PlanId,
  ) {
    super("plan_limit_reached", planLimitMessage(resource, limit, plan), 403);
  }
}

/**
 * Thrown when a plan does not include a feature at all, as opposed to having
 * used up an allowance of it.
 *
 * Its own error rather than a `PlanLimitError` with a different noun, because
 * the two sentences are not the same shape. A limit says "you've used all ten,
 * delete one or upgrade" — it offers a way out that costs nothing. There is
 * nothing to delete here: the only way out is the plan, so the copy carries one
 * remedy rather than two, and its own code lets the client offer an upgrade
 * where a limit would have pointed at a list.
 */
export type GatedFeature = "routes";

const FEATURES: Record<GatedFeature, { noun: string; verb: string }> = {
  routes: { noun: "Routes", verb: "draw them" },
};

export class PlanFeatureError extends RepositoryError {
  constructor(
    readonly feature: GatedFeature,
    readonly plan: PlanId,
  ) {
    super("plan_feature_required", planFeatureMessage(feature, plan), 403);
  }
}

/**
 * The fact on its own, for the menu that switches the tool off.
 *
 * Split from the full message for the reason `planLimitUsage` is: an inline note
 * sits beside the control it explains and earns its space by being short, while
 * a refusal that interrupts a gesture owes the way out as well. Client-safe on
 * the same terms as everything else here — this module's only imports are
 * `import type`, so no `server-only` module follows it into a browser bundle.
 */
export function planFeatureNote(feature: GatedFeature, plan: PlanId): string {
  return `${FEATURES[feature].noun} aren't included on the ${plan} plan.`;
}

export function planFeatureMessage(
  feature: GatedFeature,
  plan: PlanId,
): string {
  return `${planFeatureNote(feature, plan)} Upgrade to ${FEATURES[feature].verb}.`;
}

/** What each resource is called in a sentence, singular and plural. */
const NOUNS: Record<LimitedResource, [string, string]> = {
  maps: ["map", "maps"],
  places: ["location", "locations"],
  shapes: ["shape", "shapes"],
};

/**
 * What being at a limit means, in one clause: the count, the ceiling, the plan.
 *
 * Split out from the full message because the two places that say this are not
 * in the same situation. A toast fires after a refused gesture and has to say
 * what to do next; the warning under the pin grid is read *beside* the controls
 * it explains, in a menu the user opened on purpose, so "delete a location to
 * add another" is a sentence pointing at the list already on screen. Trimming it
 * there was asked for directly, and it is the right trim: an inline note earns
 * its space by being short.
 *
 * Exported for that warning, and safe to import into a client component. The
 * reason is worth stating because it is easy to break: this module's only
 * imports are `import type`, so nothing survives compilation and no
 * `server-only` module is dragged into a browser bundle. Adding a runtime import
 * here would change that silently — `plan-limits.ts` in particular is
 * `server-only` and is currently reached for its `PlanId` type alone.
 */
export function planLimitUsage(
  resource: LimitedResource,
  limit: number,
  plan: PlanId,
): string {
  const [noun, plural] = NOUNS[resource];
  const counted = limit === 1 ? `${limit} ${noun}` : `all ${limit} ${plural}`;

  return `You've used ${counted} included on the ${plan} plan.`;
}

/**
 * The same fact with the two ways out of it, which is what a refusal owes.
 *
 * This is the 403's own message and the toast renders it verbatim. It stays one
 * string built from one composer, so the inline warning and the error a create
 * would have earned can never describe the same ceiling differently — the
 * warning is this sentence's first half, not a second copy of it.
 */
export function planLimitMessage(
  resource: LimitedResource,
  limit: number,
  plan: PlanId,
): string {
  const [noun] = NOUNS[resource];

  return (
    `${planLimitUsage(resource, limit, plan)} ` +
    `Delete a ${noun} to add another, or upgrade for more.`
  );
}
