import path from "node:path";
import { addPlace, listPlaces, updateMap } from "./support/api";
import { mockReverseGeocode } from "./support/geocode-mock";
import { expect, test } from "./support/fixtures";

const PHOTO = path.resolve("e2e", "fixtures", "photo.png");

test("drop a pin on the map, rename it, and it survives a reload", { tag: "@smoke" }, async ({ page, testMap }) => {
  await mockReverseGeocode(page);
  await page.goto(`/maps/${testMap.id}`);

  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();

  // Pick a plain pin, then click the middle of the map to drop it there.
  await page.getByRole("button", { name: "Add location" }).click();
  await page.getByRole("dialog", { name: "Choose a pin" }).getByRole("button", { name: "Plain" }).click();

  // The row appears at once under a temporary id; wait for the real one before
  // editing, or the rename is sent to an id the server has never heard of.
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/maps/${testMap.id}/places`),
  );
  await canvas.click();
  expect((await created).status()).toBe(201);

  // For a moment there are two rows: the temporary one animating out while the
  // real one comes in. Wait for the swap to finish.
  const pinRow = page.getByRole("button", { name: "Actions for Location 1" });
  await expect(pinRow).toHaveCount(1);
  await expect(pinRow).toBeVisible();

  // Rename it through the edit dialog.
  await pinRow.click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog").filter({ hasText: "Edit location" });
  await editDialog.getByLabel("Name", { exact: true }).fill("E2E Flagship");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Actions for E2E Flagship" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Actions for E2E Flagship" })).toBeVisible();
});

test("contact details and a description survive a reload", async ({ page, request, testMap }) => {
  const place = await addPlace(request, testMap.id, { name: "E2E Details", lat: 54.6872, lng: 25.2797 });
  await page.goto(`/maps/${testMap.id}`);

  await page.getByRole("button", { name: "Actions for E2E Details" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit location" });

  await dialog.getByRole("button", { name: /^Contact/ }).click();
  await dialog.getByRole("textbox", { name: "Phone" }).fill("+370 600 00000");
  await dialog.getByRole("textbox", { name: "Email" }).fill("shop@example.com");
  await dialog.getByRole("textbox", { name: "Website" }).fill("example.com");

  // Folds open one at a time (CLAUDE.md §8), so opening this one shuts Contact.
  await dialog.getByRole("button", { name: /^Description, logo and photos/ }).click();
  await dialog.getByRole("textbox", { name: "Description" }).fill("Open late on Fridays.");

  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  // What the server holds, not what the form remembers.
  const saved = (await (await request.get(`/api/maps/${testMap.id}/places/${place.id}`)).json()) as {
    data: { place: { phone: string; email: string; url: string; description: string } };
  };
  expect(saved.data.place).toMatchObject({
    phone: "+370 600 00000",
    email: "shop@example.com",
    url: "https://example.com",
    description: "Open late on Fridays.",
  });

  // And the card a visitor sees reads them back after a reload.
  await page.reload();
  await page.getByRole("button", { name: "E2E Details", exact: true }).first().click();
  const card = page.getByRole("dialog", { name: "E2E Details" });
  await expect(card.getByText("Open late on Fridays.")).toBeVisible();
});

test("delete a location from its row menu", async ({ page, request, testMap }) => {
  await addPlace(request, testMap.id, { name: "E2E Keep", lat: 54.6872, lng: 25.2797 });
  await addPlace(request, testMap.id, { name: "E2E Doomed", lat: 54.8985, lng: 23.9036 });
  await page.goto(`/maps/${testMap.id}`);

  await page.getByRole("button", { name: "Actions for E2E Doomed" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page
    .getByRole("dialog", { name: "Delete E2E Doomed?" })
    .getByRole("button", { name: "Delete location" })
    .click();
  await expect(page.getByRole("button", { name: "Actions for E2E Doomed" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Actions for E2E Keep" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for E2E Doomed" })).toHaveCount(0);
  expect((await listPlaces(request, testMap.id)).map((p) => p.name)).toEqual(["E2E Keep"]);
});

test("the Locations page narrows by search and by tag", async ({ page, request, testMap }) => {
  await updateMap(request, testMap.id, {
    tagGroups: [{ id: "kind", label: "Kind", tags: [{ id: "shop", label: "Shop", color: "#e11d48" }] }],
  });
  await addPlace(request, testMap.id, { name: "E2E Harbour Shop", lat: 54.6872, lng: 25.2797, tags: ["shop"] });
  await addPlace(request, testMap.id, { name: "E2E Hill Cafe", lat: 54.8985, lng: 23.9036 });
  await addPlace(request, testMap.id, { name: "E2E Harbour Cafe", lat: 55.7033, lng: 21.1443 });

  await page.goto(`/maps/${testMap.id}/places`);
  const rows = page.getByRole("table").getByRole("row").filter({ hasText: "E2E" });
  await expect(rows).toHaveCount(3);

  await page.getByRole("searchbox", { name: "Search locations" }).fill("harbour");
  await expect(rows).toHaveCount(2);

  await page.getByRole("searchbox", { name: "Search locations" }).fill("");
  await expect(rows).toHaveCount(3);

  await page.getByRole("button", { name: "Tags", exact: true }).click();
  // The checkbox is visually hidden under its chip; press the chip, as a person would.
  await page.getByRole("dialog", { name: "Filter locations by tag" }).getByText("Shop", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("E2E Harbour Shop");
});

test("a photo uploads with the location and survives a reload", async ({ page, request, testMap }) => {
  const place = await addPlace(request, testMap.id, { name: "E2E Photo", lat: 54.6872, lng: 25.2797 });
  await page.goto(`/maps/${testMap.id}`);

  await page.getByRole("button", { name: "Actions for E2E Photo" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit location" });
  await dialog.getByRole("button", { name: /^Description, logo and photos/ }).click();

  // Two file inputs in this fold: the logo's, then the photos'.
  await dialog.locator('input[type="file"]').last().setInputFiles(PHOTO);
  await expect(dialog.getByRole("img", { name: "Photo 1" })).toBeVisible();

  const uploaded = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().includes(`/places/${place.id}/photos`),
  );
  await dialog.getByRole("button", { name: "Save changes" }).click();
  expect((await uploaded).ok()).toBe(true);
  await expect(dialog).toBeHidden();

  const saved = (await (await request.get(`/api/maps/${testMap.id}/places/${place.id}`)).json()) as {
    data: { place: { photoIds?: string[] } };
  };
  expect(saved.data.place.photoIds).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "E2E Photo", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "E2E Photo" }).locator("img").first()).toBeVisible();
});
