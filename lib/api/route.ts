import "server-only";

import type { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType, z } from "zod";

import { requireAdmin } from "@/lib/admin/auth/guard";
import { requireUser } from "@/lib/auth/current-user";
import { assertEmailVerified } from "@/lib/auth/email-gate";
import type { AuthUser } from "@/lib/auth/types";
import { env } from "@/lib/env";
import { RATE_LIMITS, type RatePolicyName } from "@/lib/limits/rate";
import { clientIp } from "@/lib/rate-limit/ip";
import { rateLimit } from "@/lib/rate-limit/limiter";
import { ownerContext, type RepoContext } from "@/lib/repositories/context";
import {
  NotFoundError,
  RateLimitError,
  RepositoryError,
  RoleRequiredError,
} from "@/lib/repositories/errors";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/team/active-cookie";
import { resolveActiveContext, resolveMapContext } from "@/lib/team/resolve";
import { can } from "@/lib/team/roles";
import type { ApiFieldErrors } from "./error-codes";
import { fail } from "./responses";
import { assertSameOrigin } from "./same-origin";

export type Handler<Params> = (args: {
  request: NextRequest;
  params: Params;
  user: AuthUser;
  ctx: RepoContext;
}) => Promise<NextResponse>;

type RouteArgs<Params> = { params: Promise<Params> };

/**
 * Which workspace a route works in — lib/team/resolve.ts has the three answers.
 *
 * - `"map"`: the workspace that owns `params.id`. Every `/api/maps/[id]/**`
 *   route, and `lib/api/route-scopes.test.ts` holds them to it.
 * - `"active"` (the default): the one the dashboard is switched to.
 * - `"none"`: the person's own — account, billing, notifications, and the
 *   team routes that act on the person rather than a workspace (accepting an
 *   invite, leaving, switching).
 *
 * The default is the one that fails closed. A map-scoped route left on
 * `"active"` resolves the wrong workspace and `getMap` answers 404; it can
 * never reach a map the caller is not in.
 */
export type WorkspaceScope = "active" | "map" | "none";

/**
 * Wraps a route handler with the seven things every one of them does: refuse a
 * write another website made the browser send (`./same-origin.ts`), resolve the
 * caller, refuse a write from an account that has not confirmed its address,
 * await the params promise, resolve which workspace the request is about and the
 * caller's role in it (`options.workspace`), refuse a viewer's write, and map
 * thrown errors onto the JSON envelope.
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
  options: AuthOptions = {},
) {
  return async (
    request: NextRequest,
    args?: RouteArgs<Params>,
  ): Promise<NextResponse> => {
    try {
      assertSameOrigin(request, env.appUrl);

      const user = await requireUser();

      rateLimit(options.rateLimit ?? defaultUserPolicy(request.method), user.id);

      if (!options.allowUnverified) assertEmailVerified(user, request.method);

      const params = ((await args?.params) ?? {}) as Params;
      const scope = options.workspace ?? "active";
      const ctx = await contextFor(scope, request, user.id, params);

      assertRoleAllows(ctx, scope, request.method);

      return await handler({ request, params, user, ctx });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

type AuthOptions = {
  allowUnverified?: boolean;
  rateLimit?: PolicyPer<"user">;
  workspace?: WorkspaceScope;
};

/**
 * `withAuth` for every route under `/api/maps/[id]`: the workspace is whoever
 * owns that map, and the caller's role there decides what they may do. The
 * `id` param is required by the type, so a route that has none cannot use it.
 * `lib/api/route-scopes.test.ts` holds every map route to this wrapper.
 */
export function withMapAuth<Params extends { id: string }>(
  handler: Handler<Params>,
  options: Omit<AuthOptions, "workspace"> = {},
) {
  return withAuth<Params>(handler, { ...options, workspace: "map" });
}

/**
 * `withAuth` for routes about the person rather than a workspace's data — the
 * account, billing, notifications, accepting an invite, leaving a team. The
 * context is their own workspace and the viewer gate does not apply.
 */
export function withPersonalAuth<Params = Record<string, never>>(
  handler: Handler<Params>,
  options: Omit<AuthOptions, "workspace"> = {},
) {
  return withAuth<Params>(handler, { ...options, workspace: "none" });
}

async function contextFor(
  scope: WorkspaceScope,
  request: NextRequest,
  userId: string,
  params: unknown,
): Promise<RepoContext> {
  if (scope === "none") return ownerContext(userId);

  if (scope === "map") {
    const mapId = (params as { id?: unknown } | null)?.id;

    if (typeof mapId !== "string" || !mapId) {
      throw new NotFoundError("That map doesn't exist.");
    }

    return (await resolveMapContext(userId, mapId)).ctx;
  }

  // `cookies` is always there on a real NextRequest; the optional chain is for
  // the plain `Request` the wrapper's own tests hand it.
  return resolveActiveContext(userId, request.cookies?.get(ACTIVE_WORKSPACE_COOKIE)?.value);
}

/**
 * **The viewer gate: a viewer changes nothing in a workspace, and this one check
 * is why.** It sits beside the email gate for the reason that one does — every
 * authenticated route passes through here, so a route written next month is
 * covered by having been written normally. Finer rules (only an admin deletes a
 * map, only the owner manages admins) are `can`/`canManage` calls inside the
 * repositories; this is the floor under them.
 *
 * `"none"` routes are exempt because they act on the person, never on a
 * workspace's data — and a viewer must still be able to leave, switch teams
 * and accept an invite.
 */
function assertRoleAllows(ctx: RepoContext, scope: WorkspaceScope, method: string): void {
  if (scope === "none" || isReadMethod(method)) return;

  if (!can(ctx.role, "edit")) throw new RoleRequiredError();
}

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
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
      assertSameOrigin(request, env.appUrl);

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
      assertSameOrigin(request, env.appUrl);

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
  return isReadMethod(method) ? "read" : "write";
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
