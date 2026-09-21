import type { NextRequest, NextResponse } from "next/server";

import type { Handler } from "./route";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `lib/env.ts` calls `required()` at module load, so importing anything that
 * reaches it throws under vitest. Same three placeholders `resend.test.ts` and
 * `disposable.test.ts` set, for the same reason.
 */
process.env.APPWRITE_API_KEY ||= "test-key";
process.env.DATABASE_ID ||= "test-database";
process.env.STORAGE_ID ||= "test-storage";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ requireUser }));

const ORIGINAL_RESEND_KEY = process.env.RESEND_API_KEY;

type User = { id: string; email: string; name: string; emailVerified: boolean };

const VERIFIED: User = {
  id: "u1",
  email: "ada@example.com",
  name: "Ada",
  emailVerified: true,
};
const UNVERIFIED: User = { ...VERIFIED, emailVerified: false };

/**
 * The gate reads `env.resendApiKey`, which `lib/env.ts` captures at module load
 * — so the "no key" case needs the whole graph re-imported, not just a variable
 * reassigned. Same `resetModules` + dynamic import shape `disposable.test.ts`
 * uses for its allowlist.
 */
async function loadWithAuth(resendKey: string | undefined) {
  vi.resetModules();

  if (resendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = resendKey;

  return (await import("./route")).withAuth;
}

/** Only `.method` is ever read by the gate, so this is the whole surface. */
function request(method: string): NextRequest {
  return new Request("http://localhost/api/anything", {
    method,
  }) as unknown as NextRequest;
}

async function body(response: NextResponse): Promise<{
  error?: { code: string; message: string };
}> {
  return response.json();
}

/** A handler that records the fact it ran and nothing else. */
const respond: Handler<Record<string, never>> = async () =>
  new Response(null, { status: 204 }) as unknown as NextResponse;

/**
 * The email gate is one `if` in one wrapper, and that is exactly why it is worth
 * testing: it is the only thing standing between an unconfirmed account and
 * every write in the app, and the failure modes are both silent. Too strict and
 * `GET /api/auth/me` stops answering, so the banner that tells the user to
 * confirm cannot name their address. Too loose and the gate is decoration.
 */
describe("withAuth — the confirmed-address gate", () => {
  let withAuth: Awaited<ReturnType<typeof loadWithAuth>>;
  let handler: ReturnType<typeof vi.fn<typeof respond>>;

  beforeEach(async () => {
    requireUser.mockReset();
    handler = vi.fn(respond);
    withAuth = await loadWithAuth("re_test_key");
  });

  it("lets a confirmed account write", async () => {
    requireUser.mockResolvedValue(VERIFIED);

    const response = await withAuth(handler)(request("POST"));

    expect(handler).toHaveBeenCalledOnce();
    expect(response.status).toBe(204);
  });

  it("refuses every unsafe method from an unconfirmed account", async () => {
    requireUser.mockResolvedValue(UNVERIFIED);

    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      const response = await withAuth(handler)(request(method));

      expect(response.status).toBe(403);
      expect((await body(response)).error?.code).toBe("email_unverified");
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it("names the address in the refusal, because most people do not remember it", async () => {
    requireUser.mockResolvedValue(UNVERIFIED);

    const response = await withAuth(handler)(request("POST"));

    expect((await body(response)).error?.message).toContain("ada@example.com");
  });

  it("lets an unconfirmed account read", async () => {
    requireUser.mockResolvedValue(UNVERIFIED);

    // GET above all: the banner that explains the gate asks /api/auth/me for the
    // address to put in it. Gating this makes the product go quiet instead.
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const response = await withAuth(handler)(request(method));
      expect(response.status).toBe(204);
    }

    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("still refuses before the handler runs, so nothing partial happens", async () => {
    requireUser.mockResolvedValue(UNVERIFIED);

    await withAuth(handler)(request("POST"));

    expect(handler).not.toHaveBeenCalled();
  });

  it("lets a route opt out with allowUnverified", async () => {
    requireUser.mockResolvedValue(UNVERIFIED);

    const response = await withAuth(handler, { allowUnverified: true })(
      request("POST"),
    );

    expect(response.status).toBe(204);
  });

  it("is inert with no RESEND_API_KEY, because the link could never arrive", async () => {
    withAuth = await loadWithAuth(undefined);
    requireUser.mockResolvedValue(UNVERIFIED);

    const response = await withAuth(handler)(request("POST"));

    expect(response.status).toBe(204);
  });

  it("still refuses a signed-out caller, gate or no gate", async () => {
    const { UnauthorizedError } = await import("@/lib/repositories/errors");
    requireUser.mockRejectedValue(new UnauthorizedError());

    const response = await withAuth(handler)(request("GET"));

    expect(response.status).toBe(401);
  });
});

afterAll(() => {
  if (ORIGINAL_RESEND_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = ORIGINAL_RESEND_KEY;
});
