import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType, z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
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
 * Wraps a route handler with the four things every one of them does: resolve the
 * caller, await the params promise, build a repo context, and map thrown errors
 * onto the JSON envelope.
 *
 * `requireUser()` here is the actual authorization check. proxy.ts only decides
 * whether to bother rendering — it authorizes nothing, and a forged cookie has to
 * be stopped at this line.
 */
export function withAuth<Params = Record<string, never>>(handler: Handler<Params>) {
  return async (
    request: NextRequest,
    args?: RouteArgs<Params>,
  ): Promise<NextResponse> => {
    try {
      const user = await requireUser();
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

/** Parse a JSON body, turning malformed JSON into a 422 rather than a 500. */
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

  return schema.parse(raw);
}
