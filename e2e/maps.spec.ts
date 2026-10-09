import { deleteMap, listMaps, uniqueMapName } from "./support/api";
import { expect, test } from "./support/fixtures";

test("create, rename and delete a map", { tag: "@smoke" }, async ({ page, request }, testInfo) => {
  const name = uniqueMapName(`${testInfo.project.name}-ui`);
  const renamed = `${name}-renamed`;

  try {
    // Create
    await page.goto("/maps");
    await page.getByRole("button", { name: "Create map" }).first().click();
    const createDialog = page.getByRole("dialog").filter({ hasText: "Map name" });
    await createDialog.getByLabel("Map name").fill(name);
    await createDialog.getByRole("button", { name: "Create map" }).click();

    await expect(page).toHaveURL(/\/maps\/[^/]+$/);
    await expect(page).toHaveTitle(new RegExp(name));

    // Rename
    await page.goto("/maps");
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const renameDialog = page.getByRole("dialog").filter({ hasText: "Rename map" });
    await renameDialog.getByLabel("Map name").fill(renamed);
    await renameDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(renameDialog).toBeHidden();
    await expect(page.getByRole("button", { name: `Actions for ${renamed}` })).toBeVisible();

    // Delete
    await page.getByRole("button", { name: `Actions for ${renamed}` }).click();
    await page.getByRole("menuitem", { name: "Delete map" }).click();
    await page
      .getByRole("dialog")
      .filter({ hasText: `Delete ${renamed}?` })
      .getByRole("button", { name: "Delete map" })
      .click();
    await expect(page.getByRole("button", { name: `Actions for ${renamed}` })).toHaveCount(0);
  } finally {
    // If a step above failed, the map is still there under one of its names.
    for (const map of await listMaps(request)) {
      if (map.name === name || map.name === renamed) await deleteMap(request, map.id);
    }
  }
});
