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

/** What each resource is called in a sentence, singular and plural. */
const NOUNS: Record<LimitedResource, [string, string]> = {
  maps: ["map", "maps"],
  places: ["location", "locations"],
  shapes: ["shape", "shapes"],
};

function planLimitMessage(
  resource: LimitedResource,
  limit: number,
  plan: PlanId,
): string {
  const [noun, plural] = NOUNS[resource];
  const counted = limit === 1 ? `${limit} ${noun}` : `all ${limit} ${plural}`;

  return (
    `You've used ${counted} included on the ${plan} plan. ` +
    `Delete a ${noun} to add another, or upgrade for more.`
  );
}
