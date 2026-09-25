import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

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
          A linked map treats your Google Sheet as the source of truth. Each row
          in the sheet is one location. A sync adds the rows that are new,
          updates the ones that changed, removes the ones that are gone, and — if
          the map is already published — republishes it, so your site keeps up
          without you pressing anything.
        </p>

        <p>
          Sheet sync is on the Starter and Pro plans. See{" "}
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
              On Locations, press <strong>Import locations</strong>, choose the{" "}
              <strong>Google Sheet</strong> tab and follow the wizard — see{" "}
              <Link href="/docs/importing-locations">Importing locations</Link>.
            </p>
          </DocsStep>

          <DocsStep title="Leave Keep in sync with the sheet on">
            <p>
              On the Review step, <strong>Keep in sync with the sheet</strong> is
              on already. Press <strong>Import N locations</strong>; the toast
              confirms the map is linked and syncs daily.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A map links to one sheet. Importing another sheet with the switch on
          replaces the link.
        </p>
      </DocsSection>

      <DocsSection id="syncing" title="Syncing">
        <p>
          A linked map has a <strong>Sheet sync</strong> button on its Locations
          page. It opens a panel with:
        </p>

        <DocsTable
          caption="Sheet sync panel"
          head={["Control", "What it does"]}
          rows={[
            [
              "Sync now",
              "Syncs straight away. You can close the panel — the sync carries on.",
            ],
            [
              "Sync every day",
              "Syncs by itself every day at 03:00 UTC.",
            ],
            ["Open the sheet", "Opens the linked sheet in Google Sheets."],
            [
              "Unlink sheet",
              "Ends the link. Your locations stay as they are; edits to the sheet stop reaching the map.",
            ],
          ]}
        />

        <p>
          A red dot on the button means the last sync failed or is waiting for
          you to confirm something. An amber dot means only part of the sheet got
          in.
        </p>
      </DocsSection>

      <DocsSection id="what-changes" title="What a sync changes">
        <p>
          A sync only touches locations that came from the sheet, and only the
          columns you mapped when you imported — the name always, and the
          address, description, phone, email, website and tags if you mapped
          them.
        </p>

        <p>It never touches:</p>

        <ul>
          <li>Locations you added by hand.</li>
          <li>
            Photos, logo, opening hours, pin, group, extra fields or card changes
            on any location.
          </li>
        </ul>

        <DocsCallout tone="warning">
          <p>
            Change the synced fields in the sheet, not in the dashboard. An edit
            made in Edit location is replaced by the sheet’s value at the next
            sync — the dialog says which fields come from the sheet.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="addresses" title="How addresses are found">
        <p>
          New and changed addresses are looked up during the sync, with no review
          step. So a sync only places a location when it is confident of the
          match:
        </p>

        <ul>
          <li>
            A new row whose address can’t be found, or only roughly, is left off
            the map and reported by its row number.
          </li>
          <li>
            An existing location whose new address can’t be placed keeps its old
            one, and the report says so.
          </li>
          <li>
            Latitude and longitude columns in the sheet skip the lookup
            entirely — the surest fix for an address that won’t resolve.
          </li>
        </ul>

        <p>
          An address that couldn’t be found isn’t tried again for 7 days unless
          you change it. Each lookup uses one from your{" "}
          <Link href="/docs/plans-and-billing#lookups">monthly allowance</Link>.
        </p>
      </DocsSection>

      <DocsSection id="report" title="Reading the report">
        <p>
          After a sync the panel shows what changed — added, updated, removed —
          and <strong>N rows not on the map</strong>, each as{" "}
          <strong>Row 12 · name — reason</strong>, numbered as in your sheet.
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
              "Rename the column back, or import the sheet again to link it afresh.",
            ],
          ]}
        />

        <p>
          If a sync says not every change is in yet, press{" "}
          <strong>Sync now</strong> again, or leave it to the daily sync.
        </p>
      </DocsSection>

      <DocsSection id="removing" title="When a sync would remove most of the map">
        <p>
          A sync stops and asks before removing 3 or more locations when that is
          more than half of the ones from the sheet, and whenever the sheet comes
          back empty. That protects you from a sheet that was cleared by mistake,
          or a filter left on.
        </p>

        <p>
          The panel says how many would go. If that’s what you meant, press{" "}
          <strong>Remove N and sync</strong>. If not, fix the sheet and sync again.
          The daily sync never confirms this by itself.
        </p>
      </DocsSection>

      <DocsSection id="downgrade" title="If you leave Starter or Pro">
        <p>
          The link is kept, but syncing stops until you’re back on a paid plan.
          Your locations stay as the last sync left them.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
