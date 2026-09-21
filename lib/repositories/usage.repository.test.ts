import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The allowance is the other half of the paywall, and the half that costs real
 * money when it regresses: every ceiling tested in `plan-limits.test.ts` bounds
 * something a customer *keeps*, and this one bounds what they *spend* against a
 * metered upstream.
 *
 * Tested at the repository, like the rest of §6's checks, and tested for the
 * behaviours that are easy to get backwards rather than for the arithmetic:
 * which of the two budgets refused, whether a failed lookup is billed, and what
 * happens when the meter itself is unreadable.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

const listRows = vi.fn();
const createRow = vi.fn();
const updateRow = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: {
      listRows: (...args: unknown[]) => listRows(...args),
      createRow: (...args: unknown[]) => createRow(...args),
      updateRow: (...args: unknown[]) => updateRow(...args),
    },
  },
}));

const USER_ID = "user-1";

/** Counts the fake table answers with, keyed `${userId}:${period}`. */
let counts: Record<string, number> = {};
/** The subscription row `getUserPlan` reads. Empty means the free plan. */
let subscriptionRows: { plan?: string; status?: string }[] = [];

function queryValues(queries: unknown): string[] {
  /*
   * Appwrite's Query helpers serialise to JSON strings. The fake reads the values
   * back out rather than matching on shape, so a change to their internals shows
   * up as a failing test here instead of as a silently always-empty table.
   */
  return (Array.isArray(queries) ? queries : []).flatMap((query) => {
    try {
      const parsed = JSON.parse(String(query)) as { values?: unknown[] };
      return (parsed.values ?? []).map(String);
    } catch {
      return [];
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  counts = {};
  subscriptionRows = [];

  listRows.mockImplementation(async ({ tableId, queries }: { tableId: string; queries: unknown }) => {
    if (tableId === "subscriptions") {
      return { total: subscriptionRows.length, rows: subscriptionRows };
    }

    const [userId, period] = queryValues(queries);
    const key = `${String(userId)}:${String(period)}`;

    return key in counts
      ? { total: 1, rows: [{ $id: key, userId, period, lookups: counts[key] }] }
      : { total: 0, rows: [] };
  });

  createRow.mockImplementation(async ({ data }: { data: { userId: string; period: string; lookups: number } }) => {
    counts[`${data.userId}:${data.period}`] = data.lookups;
    return { $id: "new" };
  });

  updateRow.mockImplementation(async ({ rowId, data }: { rowId: string; data: { lookups: number } }) => {
    counts[rowId] = data.lookups;
    return { $id: rowId };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function usage() {
  return import("./usage.repository");
}

/** The pooled daily row's key, as the repository writes it. */
async function poolKey(): Promise<string> {
  const { usageDay } = await usage();
  return `*:${usageDay()}`;
}

async function monthKey(): Promise<string> {
  const { usageMonth } = await usage();
  return `${USER_ID}:${usageMonth()}`;
}

describe("the account's monthly allowance", () => {
  it("lets a lookup through below the free plan's allowance", async () => {
    const { assertLookupHeadroom } = await usage();

    await expect(
      assertLookupHeadroom(USER_ID, 1, "interactive"),
    ).resolves.toBeUndefined();
  });

  it("refuses the batch that would cross the allowance, not the one after it", async () => {
    const { LOOKUP_LIMITS } = await import("./plan-limits");
    const { assertLookupHeadroom } = await usage();

    counts[await monthKey()] = LOOKUP_LIMITS.free.perMonth - 5;

    // Five still fit exactly; six do not, and the refusal lands before any of
    // the six are spent rather than after five of them.
    await expect(
      assertLookupHeadroom(USER_ID, 5, "interactive"),
    ).resolves.toBeUndefined();

    await expect(
      assertLookupHeadroom(USER_ID, 6, "interactive"),
    ).rejects.toMatchObject({ code: "plan_limit_reached", status: 403 });
  });

  it("gives a paid plan the paid plan's allowance", async () => {
    const { LOOKUP_LIMITS } = await import("./plan-limits");
    subscriptionRows = [{ plan: "starter", status: "active" }];

    const { assertLookupHeadroom } = await usage();
    counts[await monthKey()] = LOOKUP_LIMITS.free.perMonth + 1;

    await expect(
      assertLookupHeadroom(USER_ID, 1, "interactive"),
    ).resolves.toBeUndefined();
  });

  it("names the allowance and both ways out", async () => {
    const { lookupLimitMessage } = await import("./errors");

    expect(lookupLimitMessage(4000, "starter")).toBe(
      "You've used all 4,000 address lookups included on the starter plan this month. " +
        "They reset on the 1st, or upgrade for more now.",
    );
  });
});

describe("the app's daily budget", () => {
  /*
   * The distinction this pair protects: a monthly refusal is about the caller and
   * says so, a daily one is about everybody and must not. Getting them the wrong
   * way round tells a customer their plan is full when it is not — a claim they
   * can check, and one that would send them to a pricing page for nothing.
   */

  it("stands background work aside at the reserve while a person still gets through", async () => {
    const { DAILY_LOOKUP_BUDGET, assertLookupHeadroom } = await usage();
    subscriptionRows = [{ plan: "pro", status: "active" }];

    counts[await poolKey()] = Math.floor(DAILY_LOOKUP_BUDGET * 0.9);

    await expect(
      assertLookupHeadroom(USER_ID, 1, "background"),
    ).rejects.toMatchObject({ code: "rate_limited", status: 503 });

    await expect(
      assertLookupHeadroom(USER_ID, 1, "interactive"),
    ).resolves.toBeUndefined();
  });

  it("stops even a person once the whole day is gone", async () => {
    const { DAILY_LOOKUP_BUDGET, assertLookupHeadroom } = await usage();
    subscriptionRows = [{ plan: "pro", status: "active" }];

    counts[await poolKey()] = DAILY_LOOKUP_BUDGET;

    await expect(
      assertLookupHeadroom(USER_ID, 1, "interactive"),
    ).rejects.toMatchObject({ code: "rate_limited", status: 503 });
  });

  it("blames nobody, because the spender is usually not the person refused", async () => {
    const { DailyBudgetError } = await import("./errors");
    const message = new DailyBudgetError().message;

    expect(message).not.toMatch(/plan|upgrade/i);
    expect(message).toContain("Try again");
  });
});

describe("recording what was spent", () => {
  it("writes the account's month and the app's day together", async () => {
    const { recordLookups } = await usage();

    await recordLookups(USER_ID, 3);

    expect(counts[await monthKey()]).toBe(3);
    expect(counts[await poolKey()]).toBe(3);
  });

  it("adds to a row that already exists rather than replacing it", async () => {
    const { recordLookups } = await usage();

    counts[await monthKey()] = 10;
    counts[await poolKey()] = 40;

    await recordLookups(USER_ID, 5);

    expect(counts[await monthKey()]).toBe(15);
    expect(counts[await poolKey()]).toBe(45);
  });

  it("writes nothing for a call that spent nothing", async () => {
    const { recordLookups } = await usage();

    await recordLookups(USER_ID, 0);

    expect(createRow).not.toHaveBeenCalled();
    expect(updateRow).not.toHaveBeenCalled();
  });

  /*
   * Called after the upstream has already answered, so throwing here would turn a
   * successful geocode into a failed request — losing the answer the customer
   * waited for, in order to report that we failed to write down that they got it.
   */
  it("never throws, even when the table refuses the write", async () => {
    createRow.mockRejectedValue(new Error("appwrite is down"));
    const { recordLookups } = await usage();

    await expect(recordLookups(USER_ID, 1)).resolves.toBeUndefined();
  });
});

describe("when the meter itself cannot be read", () => {
  /*
   * Fails open, the same call `lib/email/mx.ts` makes about an uncertain DNS
   * answer. An Appwrite wobble must not become an outage of the thing customers
   * pay for, and the exposure is bounded anyway: the upstream has its own hard
   * quota, and it refusing us is a worse error message rather than a worse bill.
   */
  it("lets the lookup through", async () => {
    const { assertLookupHeadroom } = await usage();

    listRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
      if (tableId === "subscriptions") return { total: 0, rows: [] };
      throw new Error("appwrite is down");
    });

    await expect(
      assertLookupHeadroom(USER_ID, 25, "interactive"),
    ).resolves.toBeUndefined();
  });
});

describe("DISABLE_ALL_PLAN", () => {
  /*
   * The flag reads every account as pro, so it has to switch this off too. A
   * tester who turned the paywall off and was then refused by an allowance they
   * had just disabled would read the flag as broken.
   */
  it("switches the allowance off with the rest of the paywall", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("DISABLE_ALL_PLAN", "1");

    const { assertLookupHeadroom, recordLookups } = await usage();
    counts[await monthKey()] = 1_000_000;

    await expect(
      assertLookupHeadroom(USER_ID, 1_000, "background"),
    ).resolves.toBeUndefined();

    await recordLookups(USER_ID, 5);
    expect(createRow).not.toHaveBeenCalled();
  });

  it("stays shut when it is not set", async () => {
    const { LOOKUP_LIMITS } = await import("./plan-limits");
    const { assertLookupHeadroom } = await usage();

    counts[await monthKey()] = LOOKUP_LIMITS.free.perMonth;

    await expect(
      assertLookupHeadroom(USER_ID, 1, "interactive"),
    ).rejects.toMatchObject({ code: "plan_limit_reached" });
  });

  /*
   * The guarantee that matters. This is a switch that hands the paid product to
   * everybody, set by an environment variable, on a platform where setting one is
   * a form field — so "remember not to set it in production" is a plan, not a
   * guarantee. There is no value anybody can set there that opens it.
   */
  it("is inert in a production build whatever it is set to", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISABLE_ALL_PLAN", "1");

    const { LOOKUP_LIMITS } = await import("./plan-limits");
    const { assertLookupHeadroom } = await usage();

    counts[await monthKey()] = LOOKUP_LIMITS.free.perMonth;

    await expect(
      assertLookupHeadroom(USER_ID, 1, "interactive"),
    ).rejects.toMatchObject({ code: "plan_limit_reached" });
  });
});
