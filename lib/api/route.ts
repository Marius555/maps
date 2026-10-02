import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType, z } from "zod";

import { requireAdmin } from "@/lib/admin/auth/guard";
import { requireUser } from "@/lib/auth/current-user";
import { assertEmailVerified } from "@/lib/auth/email-gate";
import type { AuthUser } from "@/lib/auth/types";
import { RATE_LIMITS, type RatePolicyName } from "@/lib/limits/rate";
import { clientIp } from "@/lib/rate-limit/ip";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { repoContext, type RepoContext } from "@/lib/repositories/context";
import { RateLimitError, RepositoryError } from "@/lib/repositories/errors";
import type { ApiFieldErrors } from "./error-codes";
import { fail } from "./responses";

export type Handler<Params> = (args: {
  request: NextRequest;
  params: Params;
  user: AuthUser;
  ctx: RepoContext;
}) => Promise<NextResponse>;

type RouteArgs<Params> = { params: Promise<Params> };

/**
 * Wraps a route handler with the five things every one of them does: resolve the
 * caller, refuse a write from an account that has not confirmed its address,
 * await the params promise, build a repo context, and map thrown errors onto the
 * JSON envelope.
 *
 * `requireUser()` here is the actual authorization check. proxy.ts only decides
 * whether to bother rendering — it authorizes nothing, and a forged cookie has to
 * be stopped at this line.
 *
 * **`assertEmailVerified` is the whole email gate, and it is here because this is
 * the only place it can be complete.** Every authenticated route in the app goes
 * through this wrapper, so a route added next month is covered by having been
 * written normally rather than by anyone remembering. The alternative — the
 * hand-written check the publish route used to carry — is one that holds for
 * exactly as long as somebody keeps copying it.
 *
 * `allowUnverified` is for a route an unconfirmed account must still be able to
 * reach. Most of that kind (signup, login, logout, resending the link) is
 * `withoutAuth` and never arrives here. The ones that pass it are account
 * deletion (someone who mistyped their address at signup can neither confirm it
 * nor, without this, delete the account) and signing other devices out, which
 * is a defence rather than a change to anything the account owns. A flag on
 * each of those routes, rather than a hole in the gate. See
 * `lib/auth/email-gate.ts` for what the rule actually is.
 */
export function withAuth<Params = Record<string, never>>(
  handler: Handler<Params>,
  options: { allowUnverified?: boolean; rateLimit?: PolicyPer<"user"> } = {},
) {
  return async (
    request: NextRequest,
    args?: RouteArgs<Params>,
  ): Promise<NextResponse> => {
    try {
      const user = await requireUser();

      rateLimit(options.rateLimit ?? defaultUserPolicy(request.method), user.id);

      if (!options.allowUnverified) assertEmailVerified(user, request.method);

      const params = ((await args?.params) ?? {}) as Params;

      return await handler({ request, params, user, ctx: repoContext(user.id) });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * For routes that must answer before there is a session (login, signup).
 *
 * `rateLimit` names an IP-keyed policy from `lib/limits/rate.ts`, counted before
 * the handler runs so a flood is refused without costing an Appwrite call. A
 * route that throttles by something only its body knows (an email address)
 * calls `rateLimit` itself as well.
 */
export function withoutAuth(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: { rateLimit?: PolicyPer<"ip"> } = {},
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      if (options.rateLimit) rateLimit(options.rateLimit, clientIp(request.headers));

      return await handler(request);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * For the operator console's routes (`/api/admin/**`). The admin is not an
 * Appwrite user, so there is no `user` or `ctx` to hand on — only the check,
 * which is the signed admin cookie (`lib/admin/auth/guard.ts`), never the
 * customer session — and the route's params, awaited as `withAuth` does.
 */
export function withAdmin<Params = Record<string, never>>(
  handler: (request: NextRequest, params: Params) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    args?: RouteArgs<Params>,
  ): Promise<NextResponse> => {
    try {
      await requireAdmin();

      const params = ((await args?.params) ?? {}) as Params;

      return await handler(request, params);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** The policies in `RATE_LIMITS` counted against `per` — so a route cannot key an IP policy by account. */
type PolicyPer<Per extends string> = {
  [Name in RatePolicyName]: (typeof RATE_LIMITS)[Name]["per"] extends Per ? Name : never;
}[RatePolicyName];

/**
 * What an authenticated route is limited by when it names nothing stricter.
 *
 * Applied to every `withAuth` route, which is the point: a route written next
 * month is limited by having been written normally, the same argument the email
 * gate makes above.
 */
function defaultUserPolicy(method: string): PolicyPer<"user"> {
  return method === "GET" || method === "HEAD" || method === "OPTIONS" ? "read" : "write";
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof RateLimitError) {
    return fail(error.code, error.message, error.status, undefined, error.retryAfterSeconds);
  }

  if (error instanceof RepositoryError) {
    return fail(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail(
      "validation_failed",
      "Check the highlighted fields and try again.",
      422,
      fieldErrors(error),
    );
  }

  // Anything unrecognised is a bug on our side. Log the real thing, show the
  // user something that doesn't leak an upstream error string.
  console.error("Unhandled API error:", error);
  return fail(
    "internal_error",
    "Something broke on our side. Try again in a moment.",
    500,
  );
}

export function fieldErrors(error: ZodError): ApiFieldErrors {
  const flattened = z.flattenError(error);
  const fields: ApiFieldErrors = { ...flattened.fieldErrors };

  if (flattened.formErrors.length > 0) fields._form = flattened.formErrors;

  return fields;
}

/**
 * Parse a JSON body, turning malformed JSON into a 422 rather than a 500.
 *
 * `parseAsync` rather than `parse`, for every schema whether it needs it or not:
 * a refinement that has to ask something — `signupServerSchema` asks a DNS
 * resolver whether a domain receives mail — is only expressible asynchronously,
 * and a sync `parse` throws on one rather than awaiting it. Both forms raise the
 * same `ZodError`, so nothing downstream changes, and every caller already
 * awaited this function.
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    raw = {};
  }

  return schema.parseAsync(raw);
}
