import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";
import { AUTO_SYNC_EVERY } from "@/lib/sheet-sync/schedule";

const ARTICLE = findArticle("google-sheets-sync");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * A map linked to a Google Sheet.
 *
 * Labels are quoted as `components/places/sheet-sync/**` and the import
 * wizard's review step draw them; the rules — what a sync touches, when it
 * stops and asks — are the ones `docs/notes/sheet-sync.md` sets out.
 */
export default function GoogleSheetsSyncPage() {
  return (
    <DocsArticle
      title="Google Sheets sync"
      summary="Keep a map in step with a Google Sheet, so editing the sheet is how you edit the map."
    >
      <DocsSection id="how-it-works" title="How it works">
        <p>
          Each row in the sheet is one location. A sync adds new rows, updates
          changed ones, removes deleted ones and, if the map is published,
          republishes it. Starter and Pro only — see{" "}
          <Link href="/docs/plans-and-billing">Plans and billing</Link>.
        </p>
      </DocsSection>

      <DocsSection id="linking" title="Linking a sheet">
        <DocsSteps>
          <DocsStep title="Share the sheet">
            <p>
              In Google Sheets: Share → General access → Anyone with the link →
              Viewer.
            </p>
          </DocsStep>

          <DocsStep title="Import it">
            <p>
              <strong>Import locations</strong> → <strong>Google Sheet</strong>,
              and follow the wizard — see{" "}
              <Link href="/docs/importing-locations">Importing locations</Link>.
            </p>
          </DocsStep>

          <DocsStep title="Leave Keep in sync with the sheet on">
            <p>
              It is on already on the Review step. Press{" "}
              <strong>Import N locations</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A map links to one sheet; importing another with the switch on
          replaces the link. The map then syncs {AUTO_SYNC_EVERY}.
        </p>
      </DocsSection>

      <DocsSection id="syncing" title="Syncing">
        <p>
          <strong>Sheet sync</strong> on the Locations page opens:
        </p>

        <DocsTable
          caption="Sheet sync panel"
          head={["Control", "What it does"]}
          rows={[
            [
              "Sync now",
              "Syncs straight away, even if you close the panel.",
            ],
            [
              `Sync ${AUTO_SYNC_EVERY}`,
              `Syncs by itself ${AUTO_SYNC_EVERY}.`,
            ],
            ["Open the sheet", "Opens the linked sheet in Google Sheets."],
            [
              "Unlink sheet",
              "Ends the link. Your locations stay as they are.",
            ],
          ]}
        />

        <p>
          A red dot on the button means the last sync failed or needs you to
          confirm something; amber means only part of the sheet got in.
        </p>
      </DocsSection>

      <DocsSection id="what-changes" title="What a sync changes">
        <p>
          A sync only touches locations from the sheet, and only the columns you
          mapped — name, and address, description, phone, email, website and
          tags if mapped. It never touches:
        </p>

        <ul>
          <li>Locations you added by hand.</li>
          <li>
            Photos, logo, opening hours, pin, group, extra fields or card changes
            on any location.
          </li>
        </ul>

        <DocsCallout tone="warning">
          <p>
            Change synced fields in the sheet. An edit in Edit location is
            overwritten at the next sync — the dialog marks which fields come
            from the sheet.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="addresses" title="How addresses are found">
        <p>
          Addresses are looked up during the sync with no review step, so a sync
          only places a location it is confident of:
        </p>

        <ul>
          <li>
            A new row with no confident match is left off and reported by row
            number.
          </li>
          <li>
            A location whose new address can’t be placed keeps its old one.
          </li>
          <li>
            Latitude and longitude columns skip the lookup — the surest fix.
          </li>
        </ul>

        <p>
          A failed address isn’t retried for 7 days unless you change it. Each
          lookup uses one from your{" "}
          <Link href="/docs/plans-and-billing#lookups">monthly allowance</Link>.
        </p>
      </DocsSection>

      <DocsSection id="report" title="Reading the report">
        <p>
          After a sync the panel shows what was added, updated and removed, and{" "}
          <strong>N rows not on the map</strong> as{" "}
          <strong>Row 12 · name — reason</strong>.
        </p>

        <DocsTable
          caption="Why a row isn’t on the map"
          head={["Reason", "What to do in the sheet"]}
          rows={[
            ["This row has no name.", "Give it a name."],
            [
              "This row has no address and no coordinates.",
              "Add an address, or latitude and longitude.",
            ],
            [
              "We couldn’t find this address.",
              "Check it for typos, or add latitude and longitude columns.",
            ],
            [
              "Only a rough match for this address.",
              "Make it more specific — a house number, a postcode.",
            ],
            [
              "Your plan is full",
              "Remove some locations, or move to a larger plan.",
            ],
            [
              "The column is no longer in the sheet",
              "Rename the column back, or import the sheet again.",
            ],
          ]}
        />

        <p>
          If not every change is in yet, press <strong>Sync now</strong> again or
          wait for the next automatic sync.
        </p>
      </DocsSection>

      <DocsSection id="removing" title="When a sync would remove most of the map">
        <p>
          A sync stops and asks before removing 3 or more locations that are over
          half of the sheet’s, or when the sheet comes back empty — a cleared
          sheet or a forgotten filter. If it’s intended, press{" "}
          <strong>Remove N and sync</strong>; if not, fix the sheet. The
          automatic sync never confirms this itself.
        </p>
      </DocsSection>

      <DocsSection id="downgrade" title="If you leave Starter or Pro">
        <p>
          The link is kept, but syncing stops until you’re back on a paid plan.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
