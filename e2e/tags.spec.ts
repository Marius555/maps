import type { Locator, Page } from "@playwright/test";
import { addPlace, listPlaces, publishMap, readSnapshot, updateMap } from "./support/api";
import { expect, test } from "./support/fixtures";

type TagGroups = { id: string; label: string; tags: { id: string; label: string; color: string }[] }[];

/**
 * The pin on the canvas, not the row of the same name in the sidebar. Pins are
 * MapLibre markers, which sit beside the map region rather than inside it.
 */
function pinOnMap(page: Page, name: string): Locator {
  return page.locator(".map-pin").and(page.getByRole("button", { name, exact: true }));
}

/** `--pin-color` as written on the marker (use-place-markers.ts `setPinVars`). */
async function pinColor(pin: Locator): Promise<string> {
  return pin.evaluate((element) =>
    (element as HTMLElement).style.getPropertyValue("--pin-color").trim().toLowerCase(),
  );
}

test("a new tag, given to a location, colours its pin", async ({ page, request, testMap }) => {
  await addPlace(request, testMap.id, { name: "E2E Tagged", lat: 54.6872, lng: 25.2797 });

  // Make the tag where an owner makes it: Locations → Tags & fields.
  await page.goto(`/maps/${testMap.id}/places`);
  await page.getByRole("button", { name: "Tags & fields" }).click();
  const manager = page.getByRole("dialog", { name: "Tags & fields" });
  await manager.getByRole("button", { name: "Add tag" }).click();
  await manager.getByRole("textbox", { name: "Tag name" }).last().fill("Outlet");
  await manager.getByRole("button", { name: "Save changes" }).click();
  await expect(manager).toBeHidden();

  const map = (await (await request.get(`/api/maps/${testMap.id}`)).json()) as {
    data: { map: { tagGroups: TagGroups } };
  };
  const outlet = map.data.map.tagGroups.flatMap((group) => group.tags).find((tag) => tag.label === "Outlet");
  expect(outlet, "the new tag was not saved").toBeDefined();

  // Give it to the location in the editor.
  await page.goto(`/maps/${testMap.id}`);
  const pin = pinOnMap(page, "E2E Tagged");
  await expect(pin).toBeVisible();
  const untagged = await pinColor(pin);

  await page.getByRole("button", { name: "Actions for E2E Tagged" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit location" });
  await dialog.getByRole("button", { name: "Tags", exact: true }).click();
  await page.getByRole("dialog", { name: "Tags for this location" }).getByText("Outlet", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Remove Outlet" })).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(() => pinColor(pin)).toBe(outlet!.color.toLowerCase());
  expect(untagged).not.toBe(outlet!.color.toLowerCase());

  await page.reload();
  await expect.poll(() => pinColor(pinOnMap(page, "E2E Tagged"))).toBe(outlet!.color.toLowerCase());
});

test("a location's tag order is kept, in storage and in the snapshot", async ({
  page,
  request,
  testMap,
}) => {
  // Ids that sort the other way from their order, so any sort shows.
  await updateMap(request, testMap.id, {
    tagGroups: [
      {
        id: "kind",
        label: "Kind",
        tags: [
          { id: "zz-retail", label: "Retail", color: "#e11d48" },
          { id: "aa-repair", label: "Repair", color: "#2563eb" },
        ],
      },
    ],
  });
  const place = await addPlace(request, testMap.id, {
    name: "E2E Ordered",
    lat: 54.6872,
    lng: 25.2797,
    tags: ["zz-retail", "aa-repair"],
  });

  expect((await listPlaces(request, testMap.id))[0].tags).toEqual(["zz-retail", "aa-repair"]);

  // Swap them with the keyboard in the edit dialog: the first tag colours the pin.
  await page.goto(`/maps/${testMap.id}`);
  await page.getByRole("button", { name: "Actions for E2E Ordered" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit location" });
  const chips = dialog.getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Remove / }) });
  await expect(chips).toHaveText([/Retail/, /Repair/]);

  await chips.filter({ hasText: "Repair" }).focus();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(chips).toHaveText([/Repair/, /Retail/]);

  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () => (await listPlaces(request, testMap.id))[0].tags)
    .toEqual(["aa-repair", "zz-retail"]);
  await expect.poll(() => pinColor(pinOnMap(page, "E2E Ordered"))).toBe("#2563eb");

  // And nothing between storage and a published map sorts them.
  const snapshot = await readSnapshot(request, await publishMap(request, testMap.id));
  expect(snapshot.places.find((p) => p.id === place.id)?.tags).toEqual(["aa-repair", "zz-retail"]);
});
