import { strToU8, zipSync } from "fflate";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./support/fixtures";

// Relative to the project root, which is where Playwright runs from.
const CSV = path.resolve("e2e", "fixtures", "stores.csv");
const NAMES = ["E2E Vilnius Store", "E2E Kaunas Store", "E2E Klaipėda Store"];

/**
 * Hand the wizard a file once it will keep it.
 *
 * The picker stays disabled until the import run persisted in IndexedDB has
 * loaded and been claimed for this map; a file chosen before that is thrown
 * away by the claim. `exact`, because the hidden native input is also a
 * "Choose File" button.
 */
async function chooseFile(page: Page, files: Parameters<Page["setInputFiles"]>[1]) {
  await expect(page.getByRole("button", { name: "Choose file", exact: true })).toBeEnabled();
  await page.locator('input[type="file"]').setInputFiles(files);
}

// The file carries lat/lng, so no row needs a lookup and the geocoder is never
// called: the wizard goes from columns straight to review.
test("import locations from a CSV", { tag: "@smoke" }, async ({ page, testMap }) => {
  await page.goto(`/maps/${testMap.id}/places/import`);

  await chooseFile(page, CSV);
  await page.getByRole("button", { name: "Continue" }).click();

  const importButton = page.getByRole("button", { name: "Import 3 locations" });
  await expect(importButton).toBeVisible();
  await importButton.click();

  await expect(page.getByText("Imported", { exact: true }).first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/maps/${testMap.id}$`));

  for (const name of NAMES) {
    await expect(page.getByRole("button", { name: `Actions for ${name}` })).toBeVisible();
  }
});

/**
 * A workbook built the way Excel builds one — text in the shared string table,
 * numbers inline — at test time rather than committed as a binary, the same
 * reason lib/import/sources/xlsx.test.ts gives: the layout is the thing a
 * fixture would hide.
 */
function workbook(rows: (string | number)[][]): Buffer {
  const strings: string[] = [];
  const cell = (value: string | number, ref: string) => {
    if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
    strings.push(value);
    return `<c r="${ref}" t="s"><v>${strings.length - 1}</v></c>`;
  };
  const sheet = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row.map((value, c) => cell(value, `${String.fromCharCode(65 + c)}${r + 1}`)).join("")}</row>`,
    )
    .join("");

  return Buffer.from(
    zipSync({
      "xl/workbook.xml": strToU8(
        `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Stores" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        `<?xml version="1.0"?><worksheet><sheetData>${sheet}</sheetData></worksheet>`,
      ),
      "xl/sharedStrings.xml": strToU8(
        `<?xml version="1.0"?><sst>${strings.map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`,
      ),
    }),
  );
}

test("import locations from an Excel workbook", async ({ page, testMap }) => {
  await page.goto(`/maps/${testMap.id}/places/import`);

  await chooseFile(page, {
    name: "stores.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook([
      ["name", "address", "lat", "lng"],
      ["E2E Excel Vilnius", "Gedimino pr. 9 Vilnius", 54.6872, 25.2797],
      ["E2E Excel Kaunas", "Laisvės al. 60 Kaunas", 54.8985, 23.9036],
    ]),
  });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Import 2 locations" }).click();

  await expect(page.getByText("Imported", { exact: true }).first()).toBeVisible();
  for (const name of ["E2E Excel Vilnius", "E2E Excel Kaunas"]) {
    await expect(page.getByRole("button", { name: `Actions for ${name}` })).toBeVisible();
  }
});

test("a column the importer can't place is assigned by hand", async ({ page, testMap }) => {
  await page.goto(`/maps/${testMap.id}/places/import`);

  // "Outlet" means nothing to the detector, so there is no name column.
  await chooseFile(page, {
    name: "outlets.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Outlet,Northing,Easting\nE2E Odd One,54.6872,25.2797\nE2E Odd Two,54.8985,23.9036\n",
    ),
  });

  const proceed = page.getByRole("button", { name: "Continue" });
  await expect(page.getByText("Choose which column holds the location name.")).toBeVisible();
  await expect(proceed).toBeDisabled();

  await page.getByRole("button", { name: "Column “Outlet”, currently not assigned" }).click();
  // Each option leads with how sure the detector is ("Guessed. Name …"), so
  // match the field itself.
  await page.getByRole("option", { name: /(^|\. )Name( |$)/ }).click();
  await expect(page.getByRole("button", { name: "Column “Outlet”, currently Name" })).toBeVisible();

  await expect(proceed).toBeEnabled();
  await proceed.click();
  await page.getByRole("button", { name: "Import 2 locations" }).click();

  await expect(page.getByText("Imported", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for E2E Odd One" })).toBeVisible();
});
