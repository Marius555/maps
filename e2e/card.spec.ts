import type { APIRequestContext } from "@playwright/test";
import { defaultCardLayout, isSavedCardLayout } from "../packages/shared/card-layout";
import { addPlace } from "./support/api";
import { expect, test } from "./support/fixtures";

/**
 * The card designer (one design per account) and a single location's override
 * of it (`places.cardBlocks`).
 *
 * The design belongs to the account rather than to a test map, so the first
 * test puts it back exactly as it found it — through the same route the
 * designer saves with.
 *
 * Reduced motion: the per-card edit targets animate, and Playwright waits for an
 * element to stop moving before it clicks. CLAUDE.md requires every animation
 * to have a static form, and that form is what these tests press.
 */
test.use({ contextOptions: { reducedMotion: "reduce" } });

type CardLayout = Record<string, unknown>;

async function readDesign(request: APIRequestContext): Promise<CardLayout> {
  const response = await request.get("/api/account/card-design");
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { data: { cardLayout: CardLayout } }).data.cardLayout;
}

test("a change in the card designer is saved for the account", async ({ page, request, testMap }) => {
  await addPlace(request, testMap.id, {
    name: "E2E Card",
    lat: 54.6872,
    lng: 25.2797,
    address: "Gedimino pr. 9",
  });
  const before = await readDesign(request);

  try {
    await page.goto(`/maps/${testMap.id}/card`);
    await page.getByRole("button", { name: "Address", exact: true }).click();
    await page.getByRole("tab", { name: "Modify" }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();

    const bold = page.getByRole("checkbox", { name: "Bold" });
    const wasBold = await bold.isChecked();
    await page.getByText("Bold", { exact: true }).click();
    await expect(bold).toBeChecked({ checked: !wasBold });

    await page.getByRole("tab", { name: "Blocks" }).click();
    const save = page.getByRole("button", { name: "Save changes" });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();

    expect(await readDesign(request)).not.toEqual(before);

    await page.reload();
    await page.getByRole("button", { name: "Address", exact: true }).click();
    await page.getByRole("tab", { name: "Modify" }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Bold" })).toBeChecked({ checked: !wasBold });
  } finally {
    // Put the account back. One that had never saved a design read as `{}`; the
    // shipped default is what it was drawing. Not "Reset card": that is the
    // designer's blank canvas, a card with no blocks at all.
    const cardLayout = isSavedCardLayout(before) ? before : defaultCardLayout();
    const restore = await request.patch("/api/account/card-design", { data: { cardLayout } });
    expect(restore.ok(), await restore.text()).toBe(true);
  }
});

test("one location's card can differ without changing the others", async ({
  page,
  request,
  testMap,
}) => {
  const changed = await addPlace(request, testMap.id, {
    name: "E2E Special",
    lat: 54.6872,
    lng: 25.2797,
    address: "Gedimino pr. 9",
  });
  const plain = await addPlace(request, testMap.id, {
    name: "E2E Ordinary",
    lat: 54.69,
    lng: 25.29,
    address: "Pilies g. 1",
  });

  await page.goto(`/maps/${testMap.id}`);
  await page.getByRole("button", { name: "E2E Special", exact: true }).first().click();
  const card = page.getByRole("dialog", { name: "E2E Special" });
  await card.getByRole("button", { name: "Edit this card" }).click();
  await card.getByRole("button", { name: "Edit address on this card" }).click();

  const override = page.getByRole("dialog", { name: "Address on this card" });
  await override.getByRole("button", { name: "Text", exact: true }).click();
  await override.getByText("Bold", { exact: true }).click();

  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && response.url().includes(`/places/${changed.id}`),
  );
  await override.getByRole("button", { name: "Done" }).click();
  expect((await saved).ok()).toBe(true);

  const blocksOf = async (placeId: string) => {
    const response = await request.get(`/api/maps/${testMap.id}/places/${placeId}`);
    const { data } = (await response.json()) as { data: { place: { cardBlocks?: Record<string, unknown> | null } } };
    return Object.keys(data.place.cardBlocks ?? {});
  };
  expect(await blocksOf(changed.id)).toHaveLength(1);
  expect(await blocksOf(plain.id)).toHaveLength(0);
});
