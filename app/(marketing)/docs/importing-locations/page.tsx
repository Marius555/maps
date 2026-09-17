import type { Metadata } from "next";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("importing-locations");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The import guide.
 *
 * Every control is named here exactly as it is drawn on screen — “Choose file”,
 * “Read sheet”, “Split into Latitude and Longitude”, “Show only rows that need
 * attention”. A guide that paraphrases its own interface is a guide somebody
 * reads while looking at a button that says something else. If a label changes
 * in `components/places/import/`, it changes here in the same commit.
 *
 * Apostrophes and quotes in the copy are the typographic ones. The straight
 * versions are what `react/no-unescaped-entities` exists to catch in JSX text,
 * and `&apos;` scattered through nine paragraphs is unreadable in the source.
 */
export default function ImportingLocationsPage() {
  return (
    <DocsArticle
      title="Importing locations"
      summary="Bring your locations in from a spreadsheet, an XML feed or a Google Sheet, and check where they landed before anything is saved."
    >
      <DocsSection id="before-you-start" title="Before you start">
        <p>
          Your file needs one row per location. Every row needs a name, and
          something to put it on the map with — a street address, a town, a
          postcode, or latitude and longitude if you already have them.
        </p>

        <p>
          Everything else is optional. You can import a phone number, a website, a
          description and your own tags in the same pass, or add them later.
        </p>

        <DocsCallout>
          <p>
            Nothing is saved to your map until you press Import on the last step.
            You can go back, change your mind, or close the tab at any point
            before that.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="formats" title="Files we can read">
        <DocsTable
          caption="Accepted file formats"
          head={["Format", "Notes"]}
          rows={[
            [
              "CSV",
              "Files ending .csv, .tsv or .txt. Commas, semicolons and tabs all work — we work out which one your file uses.",
            ],
            [
              "Excel",
              "Files ending .xlsx or .xlsm. If the workbook has several sheets, you pick the one to use.",
            ],
            [
              "XML",
              "Files ending .xml or .kml. We find the repeating record in the file ourselves, so there is no schema to match.",
            ],
            [
              "Google Sheets",
              "Paste a link instead of downloading anything. The sheet has to be readable by anyone with the link.",
            ],
          ]}
        />

        <DocsCallout tone="warning">
          <p>
            We cannot read <code>.xls</code>, <code>.numbers</code> or{" "}
            <code>.ods</code>. Open the file in Excel or Numbers and save it again
            as <code>.xlsx</code> or CSV.
          </p>
        </DocsCallout>

        <p>
          GeoJSON and TopoJSON files hold areas, lines and circles rather than
          locations. Those go through Import shapes in the map editor, not this
          wizard.
        </p>
      </DocsSection>

      <DocsSection id="columns" title="Getting your columns ready">
        <p>
          You do not have to rename anything first. We read both what a column is
          called and what is actually in it, in English, German, French, Spanish,
          Italian, Dutch and Polish, and accents make no difference. A file whose
          columns are called <code>Column1</code> to <code>Column9</code> still
          imports — we go by the values instead.
        </p>

        <p>These are the fields a column can be mapped to:</p>

        <DocsTable
          caption="Fields a column can be mapped to"
          head={["Field", "What it holds"]}
          rows={[
            [
              "Name",
              "What the location is called. The only field every row must have.",
            ],
            [
              "Street address",
              "The street and number. Joined with the four fields below into one address.",
            ],
            ["City", "Town or city."],
            ["Postcode", "Postal or ZIP code."],
            ["State or region", "County, state, province or region."],
            ["Country", "Country name or code."],
            [
              "Latitude",
              "Between -90 and 90. Has to be mapped together with Longitude.",
            ],
            ["Longitude", "Between -180 and 180."],
            [
              "Latitude and longitude together",
              "One column holding both, like 52.5200, 13.4050 — or a map link.",
            ],
            [
              "Main tag",
              "One per row. It goes first, which is what colours the pin on the map.",
            ],
            [
              "Tags",
              "Extra filters for your visitors. One column, several tags per row, separated by a comma, a semicolon or a pipe.",
            ],
            ["Description", "A sentence or two shown on the location’s card."],
            [
              "Phone",
              "Shown on the card as a number people can tap.",
            ],
            [
              "Email",
              "Shown on the card. Anything that is not an email is left out.",
            ],
            [
              "Website",
              "Shown on the card. Anything that is not a web address is left out.",
            ],
          ]}
        />

        <p>
          The five address fields are joined in the order above into the single
          address we look up and store, so you can spread your addresses across as
          many columns as your export happens to use. Each column can only feed
          one field.
        </p>
      </DocsSection>

      <DocsSection id="source" title="Step 1 — Source">
        <DocsSteps>
          <DocsStep title="Open the wizard">
            <p>
              Go to Locations in your map and press{" "}
              <strong>Import locations</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Upload a file, or point us at a sheet">
            <p>
              On the <strong>Upload a file</strong> tab, press{" "}
              <strong>Choose file</strong> or drag the file onto the page. It is
              read in your browser — no copy of it is sent anywhere.
            </p>
            <p>
              On the <strong>Google Sheet</strong> tab, paste the link into{" "}
              <strong>Google Sheets link</strong> and press{" "}
              <strong>Read sheet</strong>. The sheet has to be shared first: in
              Google Sheets, Share → General access → Anyone with the link →
              Viewer. We read it once, then, and never again.
            </p>
          </DocsStep>

          <DocsStep title="Pick a sheet, if there are several">
            <p>
              A workbook with more than one sheet shows a <strong>Sheet</strong>{" "}
              picker. Changing it re-reads the file you already chose.
            </p>
          </DocsStep>
        </DocsSteps>
      </DocsSection>

      <DocsSection id="mapping" title="Step 2 — Columns">
        <p>
          Your file is shown as a table with our reading of each column written
          above it. Check that reading, correct anything we got wrong, and move
          on.
        </p>

        <DocsSteps>
          <DocsStep title="Check the header row">
            <p>
              We do not assume your column names are on the first row — exports
              often start with a title or a blank line. The step says{" "}
              <strong>Using row N as your column names</strong>, or{" "}
              <strong>
                No header row found — we named the columns ourselves
              </strong>
              . If it picked the wrong one, press <strong>Change</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Check each column">
            <p>
              Every column carries a mark saying how sure we are:{" "}
              <strong>Detected</strong>, <strong>Likely</strong>,{" "}
              <strong>Guessed</strong> or <strong>No match</strong>. Open a
              column’s picker to change it — the fields that actually fit that
              column come first, under{" "}
              <strong>Likely for this column</strong>, and{" "}
              <strong>Don’t import</strong> is at the top for columns you want
              left out.
            </p>
            <p>
              You can edit any cell in place, and rename a column from the chevron
              beside its name.
            </p>
          </DocsStep>

          <DocsStep title="Clear anything we flag">
            <p>
              A banner reading <strong>One thing to sort out</strong> lists what
              is still missing — usually a name column, or an address. Latitude
              and longitude have to be mapped together, and each column can only
              be used once.
            </p>
          </DocsStep>

          <DocsStep title="Press Continue">
            <p>
              <strong>Continue</strong> sits above the table rather than below it,
              so you are never scrolling three thousand rows to find it. It stays
              disabled until the flagged problems are cleared.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout tone="warning">
          <p>
            If you see <strong>These columns look swapped</strong>, take it
            seriously — it means your latitude column holds values past 90, which
            only a longitude can. Left alone, every location lands in the wrong
            place. Press <strong>Swap them</strong>.
          </p>
        </DocsCallout>

        <p>
          If one column holds both coordinates, we offer{" "}
          <strong>Split into Latitude and Longitude</strong> and do it for you.
        </p>
      </DocsSection>

      <DocsSection id="addresses" title="Step 3 — Addresses">
        <p>
          Addresses are looked up once, here, and never again. That is why your
          published map costs nothing per view however many people open it — there
          is no lookup happening when a visitor loads the page.
        </p>

        <p>
          Rows that already carried latitude and longitude are not looked up at
          all, and rows sharing an identical address cost one lookup between them,
          so the number of lookups is usually well below your row count.
        </p>

        <p>
          The progress bar reads <strong>N of M addresses</strong>.{" "}
          <strong>Skip the rest</strong> stops the run and keeps everything found
          so far — you can place the remainder by hand on the next step.
        </p>

        <DocsCallout>
          <p>
            A long import survives a reload. Come back and the wizard offers to
            pick up where it stopped, and tells you plainly that nothing has been
            added to your map yet. <strong>Start over</strong> throws the run
            away.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="review" title="Step 4 — Review">
        <p>
          A map above your rows, and still nothing saved. The header says{" "}
          <strong>N of M rows are ready</strong>, with three tallies underneath:
          ready to import, need attention, and not placed.
        </p>

        <p>
          <strong>Show only rows that need attention</strong> is switched on to
          begin with, so you are looking at the rows that want a decision rather
          than scrolling past the ones that are already fine.
        </p>

        <p>For any row that needs work:</p>

        <ul>
          <li>
            Drag its pin on the map. That is the fastest fix for a location that
            landed on the right street but the wrong building.
          </li>
          <li>
            Press <strong>Fix</strong> to edit the address and search again, or to
            pick one of the other matches we found.
          </li>
          <li>
            Press <strong>Place on map</strong> for a row that was never found,
            then click where it belongs.
          </li>
          <li>
            Leave a row out entirely by clearing its name on{" "}
            <strong>Back to columns</strong>.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="statuses" title="What each status means">
        <DocsTable
          caption="Location statuses and what to do about them"
          head={["Status", "What it means"]}
          rows={[
            ["Good match", "We found the address confidently. Nothing to do."],
            [
              "Rough match",
              "Found, but only as far as a street or a town. Check the pin — drag it, or pick another match. It imports either way.",
            ],
            [
              "No match found",
              "We searched and nothing came back. Edit the address and search again, or place the pin yourself. It cannot import until you do.",
            ],
            [
              "Placed by hand",
              "The coordinates came from your file, or you placed the pin. We never look these up.",
            ],
            [
              "Not looked up",
              "The search never ran, usually because it was skipped. Search it, or place the pin.",
            ],
          ]}
        />

        <p>
          Rows marked in red cannot be imported until they are fixed or removed.
          Amber ones import as they are — they are a suggestion to look, not a
          blocker.
        </p>
      </DocsSection>

      <DocsSection id="saving" title="Importing">
        <p>
          Press <strong>Import N locations</strong>. Rows are saved in batches
          with a progress bar, your tag columns become real tags on the map, and
          the main tag is put first so it colours the pin. Then you land back on
          your map with everything on it.
        </p>
      </DocsSection>

      <DocsSection id="fixing-later" title="Fixing locations later">
        <p>
          You do not have to settle everything during the import. On the Locations
          page, open the <strong>Show</strong> menu and choose{" "}
          <strong>Needs attention</strong> to see every location we are unsure
          about. The same menu narrows to <strong>Not placed</strong>,{" "}
          <strong>Rough match</strong>, <strong>Approximate address</strong> and{" "}
          <strong>Missing details</strong>.
        </p>

        <p>
          Open any location to edit its address and search again, or drag its pin
          in the map editor.
        </p>
      </DocsSection>

      <DocsSection id="troubleshooting" title="When something goes wrong">
        <DocsTable
          caption="Common import problems and their fixes"
          head={["What you see", "What to do"]}
          rows={[
            [
              "The file is too big",
              "Files have to be under 5MB. Split it and import the parts one after another — locations add up across imports.",
            ],
            [
              "Only some rows arrived",
              "A single file imports at most 3,000 rows. Split it, or check whether you have reached your plan’s limit.",
            ],
            [
              "Your plan is full",
              "The wizard says how much room is left before it saves anything. Remove some locations, or move to a larger plan.",
            ],
            [
              "That’s an older .xls file",
              "Open it in Excel and save it again as .xlsx or CSV.",
            ],
            [
              "The Google Sheet won’t read",
              "Share → General access → Anyone with the link → Viewer. A sheet shared only with named people cannot be read.",
            ],
            [
              "Every pin is in the wrong country",
              "Latitude and longitude are almost certainly swapped. Go back to Columns and press Swap them.",
            ],
            [
              "Rows that repeated your column names were dropped",
              "Normal for exports that stack several tables into one file. The count tells you how many, so you can check it against what you expected.",
            ],
            [
              "A website or email is missing",
              "The value could not be read as one, so it was left out and the rest of the row was imported. The row says so on the Review step.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="limits" title="How many locations you can have">
        <DocsTable
          caption="Locations allowed per map on each plan"
          head={["Plan", "Locations per map"]}
          rows={[
            ["Free", "10"],
            ["Starter", "300"],
            ["Pro", "3,000"],
          ]}
        />

        <p>
          The wizard checks your remaining room before it writes anything, so an
          import that would take you past the limit is stopped rather than half
          applied.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
