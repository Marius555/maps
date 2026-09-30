import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who sees a notification is decided by the query alone — no row carries a
 * permission — so the query is what is tested: that it asks for the three
 * audiences this account belongs to and nobody else's, and that what comes back
 * is filtered for expiry and stripped of an unsafe link.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

const listRows = vi.fn();
const createRow = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: {
      listRows: (...args: unknown[]) => listRows(...args),
      createRow: (...args: unknown[]) => createRow(...args),
    },
  },
}));

const { createNotification, listNotificationsFor } = await import(
  "./notifications.repository"
);

function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    $id: id,
    title: id,
    body: "body",
    kind: "info",
    audience: "all",
    publishedAt: "2026-09-01T00:00:00.000+00:00",
    expiresAt: null,
    linkUrl: null,
    linkLabel: null,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listNotificationsFor", () => {
  it("asks for everyone's, this plan's and this account's — nobody else's", async () => {
    listRows.mockResolvedValue({ rows: [] });

    await listNotificationsFor({ userId: "user-1" }, "starter");

    const queries = (listRows.mock.calls[0][0] as { queries: string[] }).queries.join(" ");
    expect(queries).toContain('"all"');
    expect(queries).toContain('"user-1"');
    expect(queries).toContain('"starter"');
    expect(queries).toContain("publishedAt");
  });

  it("drops what has expired and a link that is not safe to draw", async () => {
    listRows.mockResolvedValue({
      rows: [
        row("live"),
        row("expired", { expiresAt: "2020-01-01T00:00:00.000+00:00" }),
        row("scripted", { linkUrl: "javascript:alert(1)", linkLabel: "Go" }),
        row("odd-kind", { kind: "confetti" }),
      ],
    });

    const items = await listNotificationsFor({ userId: "user-1" }, "free");

    expect(items.map((item) => item.id)).toEqual(["live", "scripted", "odd-kind"]);
    expect(items[1]).toMatchObject({ linkUrl: null, linkLabel: null });
    expect(items[2].kind).toBe("info");
  });
});

describe("createNotification", () => {
  it("writes only the audience field the audience uses, with no permissions", async () => {
    createRow.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      row("n1", data),
    );

    await createNotification({
      title: "Hi",
      body: "There",
      kind: "info",
      audience: "all",
      audienceUserId: "someone",
      audiencePlans: ["pro"],
    });

    const call = createRow.mock.calls[0][0] as {
      data: Record<string, unknown>;
      permissions: string[];
    };
    expect(call.data.audienceUserId).toBeNull();
    expect(call.data.audiencePlans).toEqual([]);
    expect(call.permissions).toEqual([]);
  });
});
