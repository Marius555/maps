/**
 * @vitest-environment jsdom
 *
 * End to end over the pure half of the import: bytes in, drafts out.
 *
 * The unit tests around this one each hold a single stage honest. This one holds
 * the *seams* honest, on files shaped like the ones customers actually have —
 * which is where a pipeline of individually-correct stages usually goes wrong.
 */

import { describe, expect, it } from "vitest";

import { detectColumns } from "./detect/score";
import { buildDraftPlaces, importableDrafts } from "./draft-places";
import { planGeocode } from "./geocode-plan";
import { hasBlockingIssue, type RowIssue } from "./issues";
import { draftToCreateInput } from "./draft-to-place";
import { preflightProblem } from "./preflight";
import { readCsvText } from "./sources/csv";
import { readXmlText } from "./sources/xml";
import { buildTable } from "./table";
import type { SourceTable } from "./sources/types";

function run(source: SourceTable) {
  const table = buildTable(source);
  const detection = detectColumns(table.headers, table.rows);
  const { drafts } = buildDraftPlaces(table.rows, detection.mapping);

  return { table, mapping: detection.mapping, detail: detection.detail, drafts };
}

const csv = (text: string) => run(readCsvText(text, "stockists.csv"));

/** The messages, joined, for the field under test. */
function messagesOn(issues: RowIssue[], field: RowIssue["field"]): string {
  return issues
    .filter((issue) => issue.field === field)
    .map((issue) => issue.message)
    .join(" ");
}

describe("a tidy CSV", () => {
  it("maps, drafts and places every row", () => {
    const { mapping, drafts } = csv(
      "Name,Address,City,Postcode,Country,Category\n" +
        "Alpha,Torstr. 1,Berlin,10119,Germany,Flagship\n" +
        "Beta,Hafenweg 9,Hamburg,20457,Germany,Outlet\n" +
        "Gamma,Domplatz 4,Köln,50667,Germany,Flagship\n",
    );

    expect(mapping).toMatchObject({
      name: "Name",
      address: "Address",
      city: "City",
      postcode: "Postcode",
      country: "Country",
      category: "Category",
    });

    expect(drafts).toHaveLength(3);
    // Address parts are composed in ADDRESS_PARTS order for the geocoder.
    expect(drafts[0].address).toBe("Torstr. 1, Berlin, 10119, Germany");
    expect(drafts[0].categoryLabel).toBe("Flagship");
    // No coordinates in the file, so every row is queued for geocoding.
    expect(drafts.every((draft) => draft.status === "pending")).toBe(true);
  });
});

describe("a spreadsheet with a title row and German headers", () => {
  it("finds the header two rows down and reads the German names", () => {
    const { table, mapping, drafts } = csv(
      "Unsere Händler — Stand März 2026,,,\n" +
        ",,,\n" +
        "Bezeichnung,Straße,PLZ,Stadt\n" +
        "Alpha,Torstr. 1,10119,Berlin\n" +
        "Beta,Hafenweg 9,20457,Hamburg\n" +
        "Gamma,Domplatz 4,50667,Köln\n",
    );

    expect(table.headers).toEqual(["Bezeichnung", "Straße", "PLZ", "Stadt"]);
    expect(table.skippedLeadingRows).toBe(1);

    expect(mapping).toMatchObject({
      name: "Bezeichnung",
      address: "Straße",
      postcode: "PLZ",
      city: "Stadt",
    });

    expect(drafts[0].name).toBe("Alpha");
    expect(drafts[0].address).toBe("Torstr. 1, Berlin, 10119");
  });
});

describe("a file with no usable column names", () => {
  it("names the columns itself and maps them on their contents alone", () => {
    const { table, mapping, detail, drafts } = csv(
      "Alpha,52.5200,113.4050,a@example.com,Flagship\n" +
        "Beta,53.5511,109.9937,b@example.com,Outlet\n" +
        "Gamma,50.9375,106.9603,c@example.com,Flagship\n" +
        "Delta,48.1351,111.5820,d@example.com,Outlet\n" +
        "Epsilon,51.2277,106.7735,e@example.com,Flagship\n",
    );

    expect(table.headersAreSynthetic).toBe(true);

    // Column C leaves ±90, so it can only be a longitude — and that settles
    // Column B as the latitude.
    expect(mapping.lng).toBe("Column C");
    expect(mapping.lat).toBe("Column B");
    expect(mapping.email).toBe("Column D");
    expect(mapping.category).toBe("Column E");

    // The name is genuinely unknowable here: "unique short text" describes a
    // shop name and a sales rep equally well. So we don't guess — we ask.
    expect(mapping.name).toBeUndefined();
    expect(detail.name?.alternatives).toContain("Column A");

    // Coordinates from the file count as deliberate, so no geocoding is needed.
    expect(drafts[0].status).toBe("manual");
    expect(drafts[0].lat).toBe(52.52);
  });
});

describe("a file with one combined coordinate column", () => {
  it("splits the pair back out", () => {
    const { mapping, drafts } = csv(
      "Name,Position\n" +
        'Alpha,"52.5200, 13.4050"\n' +
        'Beta,"53.5511, 9.9937"\n' +
        'Gamma,"50.9375, 6.9603"\n',
    );

    expect(mapping.latlng).toBe("Position");
    expect(drafts[0]).toMatchObject({ lat: 52.52, lng: 13.405, status: "manual" });
    expect(importableDrafts(drafts)).toHaveLength(3);
  });

  it("reads a column of map links", () => {
    // Quoted, because the URL contains the delimiter — which is how a real
    // export writes it.
    const { drafts } = csv(
      "Name,Link\n" +
        'Alpha,"https://www.google.com/maps/@52.5200,13.4050,15z"\n' +
        'Beta,"https://www.google.com/maps/@53.5511,9.9937,15z"\n' +
        'Gamma,"https://www.google.com/maps/@50.9375,6.9603,15z"\n',
    );

    expect(drafts[0]).toMatchObject({ lat: 52.52, lng: 13.405 });
  });
});

describe("a European export", () => {
  it("reads semicolons and decimal commas together", () => {
    // The combination that breaks naive importers: a semicolon delimiter exists
    // precisely *because* the comma is the decimal separator.
    const { drafts } = csv(
      "Name;Latitude;Longitude\n" +
        "Alpha;52,5200;13,4050\n" +
        "Beta;53,5511;9,9937\n" +
        "Gamma;50,9375;6,9603\n",
    );

    expect(drafts[0]).toMatchObject({ lat: 52.52, lng: 13.405 });
    expect(importableDrafts(drafts)).toHaveLength(3);
  });
});

describe("a store-locator XML feed", () => {
  it("becomes the same table a CSV would have", () => {
    const { mapping, drafts } = run(
      readXmlText(
        `<?xml version="1.0" encoding="UTF-8"?>
         <locations>
           <location id="1">
             <title><![CDATA[Alpha & Co]]></title>
             <address><street>Torstr. 1</street><city>Berlin</city><zip>10119</zip></address>
             <contact><email>a@example.com</email><phone>+49 30 1234567</phone></contact>
           </location>
           <location id="2">
             <title>Beta</title>
             <address><street>Hafenweg 9</street><city>Hamburg</city><zip>20457</zip></address>
             <contact><email>b@example.com</email><phone>+49 40 7654321</phone></contact>
           </location>
         </locations>`,
        "stores.xml",
      ),
    );

    expect(mapping).toMatchObject({
      name: "title",
      address: "address.street",
      city: "address.city",
      email: "contact.email",
      phone: "contact.phone",
    });

    expect(drafts[0].name).toBe("Alpha & Co");
    expect(drafts[0].address).toBe("Torstr. 1, Berlin, 10119");
  });
});

describe("rows that can't be imported", () => {
  it("flags them individually instead of failing the file", () => {
    const { drafts } = csv(
      "Name,Address\n" +
        "Alpha,Torstr. 1\n" +
        ",Hafenweg 9\n" +
        "Gamma,\n" +
        ",\n" +
        "Epsilon,Domplatz 4\n",
    );

    // The all-blank row is dropped; the other two are kept and explained, so the
    // user fixes them in the review step rather than re-exporting.
    expect(drafts).toHaveLength(4);
    expect(messagesOn(drafts[1].issues, "name")).toContain("no name");
    expect(messagesOn(drafts[2].issues, "address")).toContain("no address");
    // Alpha has an address and no coordinates, so its only issue is the one
    // every un-geocoded row carries — and the geocode step clears it.
    expect(messagesOn(drafts[0].issues, "name")).toBe("");
  });
});

describe("a spreadsheet with placeholder column names above the real ones", () => {
  it("uses the real header and places every location", () => {
    // The reported failure, reduced to its shape: an export tool wrote
    // Column1..Column7 above the names it later filled in. Both rows read as
    // column names, so header-likeness alone cannot separate them — taking the
    // placeholder row made "lat_coord" a data row with no address and no
    // coordinates, and the import died on "Row 1 can't be placed".
    const { table, mapping, drafts } = csv(
      "Column1,Column2,Column3,Column4,Column5,Column6,Column7\n" +
        "Business Name,Type,Street_Location,lat_coord,long_coord,Tel Number,URL\n" +
        "Equinox Gym,Fitness,897 Broadway New York NY 10003,40.7388,-73.9904,(212) 555-0101,www.equinox.com\n" +
        "Blink Fitness,Fitness,180 Livingston St Brooklyn NY 11201,40.6892,-73.9873,(718) 555-0102,www.blinkfitness.com\n" +
        "Crunch,Fitness,162 W 83rd St New York NY 10024,40.7845,-73.9772,(212) 555-0103,www.crunch.com\n" +
        "Planet Fitness,Fitness,125 E 14th St New York NY 10003,40.7331,-73.9876,(212) 555-0104,www.planetfitness.com\n" +
        "Gold's Gym,Fitness,250 W 54th St New York NY 10019,40.7645,-73.9832,(212) 555-0105,www.goldsgym.com\n",
    );

    expect(table.headers).toEqual([
      "Business Name",
      "Type",
      "Street_Location",
      "lat_coord",
      "long_coord",
      "Tel Number",
      "URL",
    ]);
    expect(table.skippedLeadingRows).toBe(1);

    expect(mapping).toMatchObject({
      name: "Business Name",
      category: "Type",
      address: "Street_Location",
      lat: "lat_coord",
      lng: "long_coord",
      phone: "Tel Number",
      url: "URL",
    });

    // Five locations, all with usable coordinates and none reporting a problem.
    expect(drafts).toHaveLength(5);
    expect(drafts.map((draft) => draft.name)).toEqual([
      "Equinox Gym",
      "Blink Fitness",
      "Crunch",
      "Planet Fitness",
      "Gold's Gym",
    ]);
    expect(drafts.every((draft) => !hasBlockingIssue(draft.issues))).toBe(true);
    // Coordinates came from the file, so nothing is queued for geocoding.
    expect(drafts.every((draft) => draft.status === "manual")).toBe(true);
    expect(importableDrafts(drafts)).toHaveLength(5);
    expect(drafts[0].lat).toBeCloseTo(40.7388, 4);
    expect(drafts[0].lng).toBeCloseTo(-73.9904, 4);

    // The bare domains in this file's URL column are what the server's z.url()
    // rejected, failing the whole 200-row chunk with "Check the highlighted
    // fields and try again." and no indication of which row or field.
    expect(drafts.map((draft) => draft.url)).toEqual([
      "https://www.equinox.com",
      "https://www.blinkfitness.com",
      "https://www.crunch.com",
      "https://www.planetfitness.com",
      "https://www.goldsgym.com",
    ]);

    // The end of the line: every row survives the schema the API applies.
    expect(
      preflightProblem(
        drafts.map((draft) => ({
          rowNumber: draft.rowNumber,
          input: draftToCreateInput(draft),
        })),
      ),
    ).toBeNull();
  });
});

describe("a file where the column names say nothing and the values are a mess", () => {
  // The shape of a real customer file (hardCSV.xlsx), reduced to CSV. Every
  // column name is either a placeholder or an in-joke, one coordinate cell is
  // unreadable, one is space-separated, one address is a landmark description
  // and one is a whole country. Nothing here is exotic; it is what a locations
  // sheet looks like after three people have edited it.
  const text =
    "Column1,Column2,Column3,Column4,Column5\n" +
    "col_1,cat,where_is_it,GPS,details\n" +
    'Central Park Cafe,Cafe,"Central Park, Near Bethesda Fountain",,Phone: 212-555-9999\n' +
    "Joe's Pizza,,7 Wall St,\"40.7075, -74.0089\",Closed Mondays\n" +
    "Mystery Shop,Retail,USA,invalid_geo,No street address provided\n" +
    "Guggenheim Museum,Museum,1071 5th Ave,,Requires geocode fallback\n" +
    '"Old Tavern, LLC",Bar,"123 Main St, Springfield",40.7128 -74.0060,Missing comma between coordinates\n';

  it("takes the second row as the header, not the placeholder row above it", () => {
    const { table } = csv(text);

    expect(table.headers).toEqual([
      "col_1",
      "cat",
      "where_is_it",
      "GPS",
      "details",
    ]);
    expect(table.skippedLeadingRows).toBe(1);
  });

  it("declines to guess name, category or address from names this vague", () => {
    // Not a shortcoming — the rule in detect/score.ts. "col_1" and "cat" match no
    // synonym, and their values are short text, which describes a shop name, a
    // sales rep and an internal reference equally well. Guessing here is how a
    // whole file imports under the wrong labels, so these arrive unmapped and the
    // picker asks.
    const { mapping } = csv(text);

    expect(mapping.name).toBeUndefined();
    expect(mapping.category).toBeUndefined();
    expect(mapping.address).toBeUndefined();
  });

  it("records the unreadable coordinate cell instead of discarding it", () => {
    // The mapping the user would come back with, having answered the pickers.
    const { table } = csv(text);
    const { drafts } = buildDraftPlaces(table.rows, {
      name: "col_1",
      category: "cat",
      address: "where_is_it",
      latlng: "GPS",
      description: "details",
    });

    expect(drafts).toHaveLength(5);

    const byName = (name: string) =>
      drafts.find((draft) => draft.name === name)!;

    // Read as a pair despite the comma being the decimal-looking separator.
    expect(byName("Joe's Pizza").lat).toBeCloseTo(40.7075, 4);
    expect(byName("Joe's Pizza").lng).toBeCloseTo(-74.0089, 4);
    expect(byName("Joe's Pizza").status).toBe("manual");
    expect(byName("Joe's Pizza").issues).toEqual([]);

    // No comma at all, which is the one a stricter parser drops silently.
    expect(byName("Old Tavern, LLC").lat).toBeCloseTo(40.7128, 4);
    expect(byName("Old Tavern, LLC").lng).toBeCloseTo(-74.006, 4);

    // The row this whole change exists for: the cell had content, we couldn't
    // use it, and before now that fact left no trace anywhere in the UI.
    const mystery = byName("Mystery Shop");
    expect(mystery.lat).toBeNull();
    expect(messagesOn(mystery.issues, "coordinates")).toContain("invalid_geo");
    expect(mystery.status).toBe("pending");

    // An empty coordinate cell is not a problem, it is just an address to look up.
    expect(messagesOn(byName("Guggenheim Museum").issues, "coordinates")).toBe("");
    expect(byName("Guggenheim Museum").status).toBe("pending");
  });

  it("keeps the empty category as empty rather than inventing one", () => {
    const { table } = csv(text);
    const { drafts } = buildDraftPlaces(table.rows, {
      name: "col_1",
      category: "cat",
      address: "where_is_it",
      latlng: "GPS",
    });

    expect(drafts.map((draft) => draft.categoryLabel)).toEqual([
      "Cafe",
      "",
      "Retail",
      "Museum",
      "Bar",
    ]);
  });
});

/*
 * The seam between drafting and spending money.
 *
 * Every stage above this one is judged on whether a row came out right. This one
 * is judged on how many requests the file will cost, which is the number that
 * decides whether a three-thousand-row import fits inside a day's quota.
 */
describe("a file that names the same address more than once", () => {
  it("costs one lookup per building, not one per row", () => {
    // A retail park: four tenants, one postal address, written four slightly
    // different ways by four different people.
    const { drafts } = csv(
      "Name,Address,City,Postcode,Country\n" +
        "Alpha,Torstr. 1,Berlin,10119,Germany\n" +
        "Beta,torstr. 1,Berlin,10119,Germany\n" +
        "Gamma,Torstr.  1 ,Berlin,10119,Germany\n" +
        "Delta,Hafenweg 9,Hamburg,20457,Germany\n",
    );

    const plan = planGeocode(drafts);

    expect(plan.rowCount).toBe(4);
    expect(plan.lookupCount).toBe(2);
    expect(plan.savedCount).toBe(2);

    // And every row still gets an answer: the keys are carried, not dropped.
    expect(plan.lookups.flatMap((lookup) => lookup.keys)).toHaveLength(4);
    expect(plan.lookups[0].keys).toEqual(
      drafts.slice(0, 3).map((draft) => draft.key),
    );
  });

  it("leaves out the rows that already came with coordinates", () => {
    // Half the file is placed already and half is not. Only the half that is
    // not costs anything, however many times it repeats itself.
    const { drafts } = csv(
      "Name,Address,City,Latitude,Longitude\n" +
        "Alpha,Torstr. 1,Berlin,52.5296,13.4064\n" +
        "Beta,Torstr. 1,Berlin,,\n" +
        "Gamma,Torstr. 1,Berlin,,\n",
    );

    const plan = planGeocode(drafts);

    expect(plan.rowCount).toBe(2);
    expect(plan.lookupCount).toBe(1);
  });
});
