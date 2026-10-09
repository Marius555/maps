import { expect, test } from "./support/fixtures";

/**
 * Settings that change the account itself. Each puts back what it changed: the
 * test account is shared by every spec. Password changes and account deletion
 * are left out on purpose — either would sign out or destroy the account the
 * rest of the run is using.
 */

test("a new display name is saved and put back", async ({ page, request }) => {
  const me = (await (await request.get("/api/auth/me")).json()) as { data: { user: { name: string } } };
  const original = me.data.user.name;
  const changed = `${original} e2e`;

  try {
    await page.goto("/settings/general");
    const name = page.getByRole("textbox", { name: "Full name" });
    await expect(name).toHaveValue(original);
    await name.fill(changed);

    // Wait for the write itself: the button is disabled while it is pending as
    // well as once it is done, so its state cannot say which.
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" && response.url().endsWith("/api/account/profile"),
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    expect((await saved).ok()).toBe(true);

    await page.reload();
    await expect(page.getByRole("textbox", { name: "Full name" })).toHaveValue(changed);
  } finally {
    const restore = await request.patch("/api/account/profile", { data: { name: original } });
    expect(restore.ok(), await restore.text()).toBe(true);
  }
});

test("the colour mode applies at once and survives a reload", async ({ page }) => {
  await page.goto("/settings/general");
  const html = page.locator("html");
  const modes = page.getByRole("radiogroup", { name: "Colour mode" });

  // Kept in this browser only, so it leaves nothing behind on the account.
  await modes.getByText("Dark", { exact: true }).click();
  await expect(modes.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);

  await page.reload();
  await expect(html).toHaveClass(/(^|\s)dark(\s|$)/);
  await expect(page.getByRole("radiogroup", { name: "Colour mode" }).getByRole("radio", { name: "Dark" })).toBeChecked();

  await page.getByRole("radiogroup", { name: "Colour mode" }).getByText("Light", { exact: true }).click();
  await expect(html).not.toHaveClass(/(^|\s)dark(\s|$)/);
});

test("this browser is listed among the signed-in devices", async ({ page }) => {
  await page.goto("/settings/account");
  await expect(page.getByRole("heading", { level: 2, name: "Signed-in devices" })).toBeVisible();
  await expect(page.getByText("This device")).toBeVisible();
});
