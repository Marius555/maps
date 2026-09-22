import type { ApiErrorCode } from "@/lib/api/error-codes";
import { formatCount } from "@/lib/format/number";
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

/**
 * Thrown when an account has not confirmed its email address and is trying to
 * change something.
 *
 * Its own error and its own code rather than a `ForbiddenError`, because the two
 * sentences ask for different things. "You don't have access to that" is the end
 * of a conversation; this one is a door with a key already in the user's inbox,
 * and the client has to be able to tell them apart to offer the button that
 * resends it.
 *
 * The address is carried rather than looked up again: `withAuth` has just
 * resolved a real Appwrite user, and naming the inbox is most of what makes the
 * refusal actionable — plenty of people do not remember which address they
 * signed up with.
 */
export class EmailUnverifiedError extends RepositoryError {
  constructor(readonly email: string) {
    super("email_unverified", emailUnverifiedMessage(email), 403);
  }
}

/**
 * The fact on its own, for the line that sits under a control this has switched
 * off.
 *
 * Split from the full message for the reason `planLimitUsage` and
 * `planFeatureNote` are: a note is read *beside* the greyed button it explains
 * and earns its space by being short, while a refusal that interrupts a gesture
 * owes the way out as well. Client-safe on the same terms as the rest of this
 * file — nothing here is imported for anything but its type.
 */
export function emailUnverifiedNote(email: string): string {
  return `Confirm your email first — we sent a link to ${email}.`;
}

/** The same fact with what to do about it, which is what a 403 owes. */
export function emailUnverifiedMessage(email: string): string {
  return `${emailUnverifiedNote(email)} Open it, then try again.`;
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
export type GatedFeature = "routes" | "sheetSync" | "analytics";

const FEATURES: Record<GatedFeature, { noun: string; verb: string }> = {
  routes: { noun: "Routes", verb: "draw them" },
  sheetSync: {
    noun: "Linked Google Sheets",
    verb: "keep this map in sync with a sheet",
  },
  analytics: { noun: "Analytics", verb: "see what visitors do" },
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

/**
 * Thrown when an account has spent its month's address lookups.
 *
 * **A third error rather than a fourth `LimitedResource`, and the copy is why.**
 * `planLimitMessage` ends "Delete a location to add another, or upgrade for more",
 * and there is nothing to delete here — a lookup is spent, not held. The other
 * half of the difference is that this one comes back on its own: a plan limit is
 * permanent until the user acts, an allowance refills when the month turns, so the
 * remedy this sentence owes is *two* ways out where a feature gate owes one and a
 * quantity limit owes a different two.
 *
 * It reuses the `plan_limit_reached` code rather than minting one. The client's
 * only use for the code is `isPlanLimit` deciding to toast, and the toast renders
 * `error.message` verbatim — a new code would mean a new branch in every place
 * that already handles this one, to say the same thing.
 */
export class LookupLimitError extends RepositoryError {
  constructor(
    readonly limit: number,
    readonly plan: PlanId,
  ) {
    super("plan_limit_reached", lookupLimitMessage(limit, plan), 403);
  }
}

/**
 * The fact on its own, for a note beside the control it has switched off.
 *
 * `formatCount` rather than a private grouper, and rather than a bare
 * `toLocaleString`: this sentence is composed on both sides of the wire — the
 * server builds the one in a 403, the browser builds the one in an inline note —
 * and a pinned locale is what stops one allowance being spelled two ways on one
 * screen. See `lib/format/number.ts`.
 */
export function lookupLimitNote(limit: number, plan: PlanId): string {
  return `You've used all ${formatCount(limit)} address lookups included on the ${plan} plan this month.`;
}

/** The same fact with the two ways out, which is what a refusal owes. */
export function lookupLimitMessage(limit: number, plan: PlanId): string {
  return (
    `${lookupLimitNote(limit, plan)} ` +
    "They reset on the 1st, or upgrade for more now."
  );
}

/**
 * Thrown when the app as a whole has spent its day's upstream budget.
 *
 * **Deliberately says nothing about the caller's plan, and that is the point.**
 * The geocoder sells one daily quota shared by every account, so the person this
 * stops is usually not the person who spent it — telling them to upgrade would be
 * both wrong and insulting, and telling them their plan is full would be a lie
 * they could check. It is a 503 rather than a 403 for the same reason: nothing
 * about the request was refused, the service was.
 *
 * `rate_limited` is the closest existing code and the client already treats it as
 * "not your fault, try again", which is exactly right here.
 */
export class DailyBudgetError extends RepositoryError {
  constructor() {
    super(
      "rate_limited",
      "Address lookups are busy right now. Try again in a few minutes — nothing was lost.",
      503,
    );
  }
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
