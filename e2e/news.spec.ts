import { expect, test } from "./support/fixtures";

/**
 * A post published from the operator console is on the public newsroom, and
 * gone again afterwards. Needs the console (`E2E_ADMIN_PASSWORD`); skips
 * without it.
 */
test("a published post appears in the newsroom", async ({ page, admin }) => {
  const stamp = Date.now();
  const title = `E2E post ${stamp}`;
  const slug = `e2e-post-${stamp}`;

  const created = await admin.post("/api/admin/news", {
    data: {
      title,
      slug,
      summary: "Written by the end-to-end tests and deleted when they finish.",
      body: "This post exists for a few seconds.",
      category: "product",
      coverAlt: "",
      status: "published",
      publishedAt: "",
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const { data: post } = (await created.json()) as { data: { id: string } };

  try {
    // Signed out: the newsroom is public.
    await page.context().clearCookies();
    const response = await page.goto(`/news/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    await page.goto("/news");
    await expect(page.getByText(title).first()).toBeVisible();
  } finally {
    const removed = await admin.delete(`/api/admin/news/${post.id}`);
    expect([200, 204, 404]).toContain(removed.status());
  }
});
