import { expect, test } from "./support/fixtures";

/**
 * A notification sent from the operator console reaches the account it was
 * addressed to, counts as unread until seen, and is deleted afterwards. Needs
 * the console (`E2E_ADMIN_PASSWORD`); skips without it.
 */

type Feed = { items: { id: string; title: string; isUnread: boolean }[]; unreadCount: number };

test("a notification sent to this account is shown, then marked seen", async ({
  page,
  request,
  admin,
}) => {
  const title = `e2e-notice-${Date.now()}`;
  const sent = await admin.post("/api/admin/notifications", {
    data: {
      title,
      body: "Sent by the end-to-end tests. Deleted when they finish.",
      kind: "info",
      audience: "user",
      audienceEmail: process.env.E2E_EMAIL,
      audiencePlans: [],
      linkUrl: "",
      linkLabel: "",
      publishedAt: "",
      expiresAt: "",
    },
  });
  expect(sent.status(), await sent.text()).toBe(201);
  const { data: notice } = (await sent.json()) as { data: { id: string } };

  try {
    const feed = async () => ((await (await request.get("/api/notifications")).json()) as { data: Feed }).data;

    const before = await feed();
    const mine = before.items.find((item) => item.id === notice.id);
    expect(mine?.isUnread).toBe(true);
    expect(before.unreadCount).toBeGreaterThan(0);

    await page.goto("/notifications");
    await expect(page.getByText(title)).toBeVisible();

    const seen = await request.post("/api/notifications/seen");
    expect(seen.status()).toBe(204);
    const after = await feed();
    expect(after.items.find((item) => item.id === notice.id)?.isUnread).toBe(false);
    expect(after.unreadCount).toBe(0);
  } finally {
    const removed = await admin.delete(`/api/admin/notifications/${notice.id}`);
    expect([200, 204, 404]).toContain(removed.status());
  }
});
