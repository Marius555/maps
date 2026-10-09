import { expect, test } from "./support/fixtures";

const SECTIONS = [
  { link: "General", headings: ["Profile", "Appearance"] },
  { link: "Account", headings: ["Password", "Signed-in devices", "Delete account"] },
  // Payment and Invoices appear only with a subscription; the test account has none.
  { link: "Billing", headings: ["Plan"] },
  { link: "Usage", headings: ["Usage"] },
];

test("every settings page renders", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings\/general$/);

  const nav = page.getByRole("navigation", { name: "Settings" });
  for (const { link, headings } of SECTIONS) {
    await nav.getByRole("link", { name: link }).click();
    for (const heading of headings) {
      // Exact: Billing has both "Plan" and "Plans".
      await expect(
        page.getByRole("heading", { level: 2, name: heading, exact: true }),
      ).toBeVisible();
    }
  }
});
