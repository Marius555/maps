import { addPlace, listPlaces } from "./support/api";
import { mockReverseGeocode } from "./support/geocode-mock";
import { expect, test } from "./support/fixtures";

type GroupedPlace = { name: string; groupId?: string; icon?: string; color?: string };

async function placesNamed(request: Parameters<typeof listPlaces>[0], mapId: string) {
  const places = (await listPlaces(request, mapId)) as unknown as GroupedPlace[];
  return Object.fromEntries(places.map((place) => [place.name, place]));
}

test("select several pins, group them, and give the group one pin", async ({
  page,
  request,
  testMap,
}) => {
  // Should a stray click land on the basemap, it must not spend a lookup.
  await mockReverseGeocode(page);
  // Close together, so the map's opening view frames both well inside the canvas.
  await addPlace(request, testMap.id, { name: "E2E North", lat: 54.69, lng: 25.29 });
  await addPlace(request, testMap.id, { name: "E2E South", lat: 54.6872, lng: 25.2797 });

  await page.goto(`/maps/${testMap.id}`);
  const canvas = page.locator(".maplibregl-canvas");
  await expect(page.locator(".map-pin")).toHaveCount(2);

  // Marquee across the middle of the map. Not from its top-left corner: the
  // toolbar floats there, and a press on "Add location" is a drag-to-add.
  await page.getByRole("button", { name: "Select several" }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 120, { steps: 5 });
  await page.mouse.up();

  await expect(page.getByRole("status").filter({ hasText: "2 selected" })).toBeVisible();
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await expect(page.getByRole("button", { name: "Actions for Group 1" })).toBeVisible();

  await expect
    .poll(async () => {
      const places = await placesNamed(request, testMap.id);
      const north = places["E2E North"]?.groupId;
      return Boolean(north) && north === places["E2E South"]?.groupId;
    })
    .toBe(true);

  // One pin for the whole group, from the group's own menu.
  await page.getByRole("button", { name: "Actions for Group 1" }).click();
  await page.getByRole("menuitem", { name: "Change pins" }).click();
  const dialog = page.getByRole("dialog", { name: "Pin for Group 1" });
  await dialog.getByRole("button", { name: /Pin$/ }).click();
  await page.getByRole("option", { name: "Café" }).click();
  await dialog.getByRole("button", { name: "Change pins" }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () => {
      const places = await placesNamed(request, testMap.id);
      return [places["E2E North"]?.icon, places["E2E South"]?.icon];
    })
    .toEqual(["coffee", "coffee"]);

  await page.reload();
  await expect(page.getByRole("button", { name: "Actions for Group 1" })).toBeVisible();
});

test("joining a group clears a location's own pin colour", async ({ page, request, testMap }) => {
  await addPlace(request, testMap.id, { name: "E2E Coloured", lat: 54.6872, lng: 25.2797 });
  await page.goto(`/maps/${testMap.id}`);

  await page.getByRole("button", { name: "Actions for E2E Coloured" }).click();
  await page.getByRole("menuitem", { name: "Pin colour" }).click();
  await page.getByRole("listbox", { name: "Pin colour for E2E Coloured" }).getByRole("option", { name: "Pink" }).click();
  await page.keyboard.press("Escape");

  await expect
    .poll(async () => (await placesNamed(request, testMap.id))["E2E Coloured"]?.color ?? "")
    .not.toBe("");

  await page.getByRole("button", { name: "Actions for E2E Coloured" }).click();
  await page.getByRole("menuitem", { name: "Create group" }).click();
  await expect(page.getByRole("button", { name: "Actions for Group 1" })).toBeVisible();

  // The group's colour takes over; the location's own is cleared, not kept underneath.
  await expect
    .poll(async () => {
      const place = (await placesNamed(request, testMap.id))["E2E Coloured"];
      return { grouped: Boolean(place?.groupId), color: place?.color ?? "" };
    })
    .toEqual({ grouped: true, color: "" });
});
