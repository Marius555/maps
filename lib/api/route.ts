import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType, z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { assertEmailVerified } from "@/lib/auth/email-gate";
import type { AuthUser } from "@/lib/auth/types";
import { repoContext, type RepoContext } from "@/lib/repositories/context";
import { RepositoryError } from "@/lib/repositories/errors";
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
 * reach. Nothing passes it today: everything of that kind (signup, login, logout,
 * resending the link) is `withoutAuth` and never arrives here. It exists so that
 * when self-service account deletion lands — which someone who mistyped their
 * address needs — the answer is a flag on one route rather than a hole in the
 * gate. See `lib/auth/email-gate.ts` for what the rule actually is.
 */
export function withAuth<Params = Record<string, never>>(
  handler: Handler<Params>,
  options: { allowUnverified?: boolean } = {},
) {
  return async (
    request: NextRequest,
    args?: RouteArgs<Params>,
  ): Promise<NextResponse> => {
    try {
      const user = await requireUser();
      if (!options.allowUnverified) assertEmailVerified(user, request.method);

      const params = ((await args?.params) ?? {}) as Params;

      return await handler({ request, params, user, ctx: repoContext(user.id) });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** For routes that must answer before there is a session (login, signup). */
export function withoutAuth(
  handler: (request: NextRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function toErrorResponse(error: unknown): NextResponse {
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
