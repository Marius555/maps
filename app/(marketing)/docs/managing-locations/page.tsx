import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("managing-locations");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The Locations page and the Edit location dialog.
 *
 * Labels are quoted as `components/places/**` and `components/places/place-form/**`
 * draw them, including the address field's own "Find New Location" — the guide
 * follows the screen, and if that label is tidied the line here changes in the
 * same commit.
 */
export default function ManagingLocationsPage() {
  return (
    <DocsArticle
      title="Managing locations"
      summary="Find, filter and fix your locations, and fill in their contact details, opening hours, photos and logo."
    >
      <DocsSection id="locations-page" title="The Locations page">
        <p>
          Open <strong>Locations</strong> in your map’s sidebar to see every
          location — a table on a wide screen, rows on a phone. Click one to edit
          it. Along the top:
        </p>

        <ul>
          <li>
            <strong>Tags &amp; fields</strong> — the map’s filters and extra
            fields. See{" "}
            <Link href="/docs/tags-pins-and-groups#tags">Tags</Link> and{" "}
            <Link href="#extra-fields">Extra fields</Link> below.
          </li>
          <li>
            <strong>Sheet sync</strong> — only on a map linked to a Google Sheet.
            See <Link href="/docs/google-sheets-sync">Google Sheets sync</Link>.
          </li>
          <li>
            <strong>Import locations</strong> — see{" "}
            <Link href="/docs/importing-locations">Importing locations</Link>.
          </li>
        </ul>

        <p>
          Single locations are added on the Map tab — see{" "}
          <Link href="/docs/map-editor#adding">Adding locations</Link>.
        </p>
      </DocsSection>

      <DocsSection id="finding" title="Finding a location">
        <p>
          <strong>Search locations</strong> matches name or address. The{" "}
          <strong>Show</strong> menu narrows the list to locations that need
          something:
        </p>

        <DocsTable
          caption="Options in the Show menu"
          head={["Option", "Shows"]}
          rows={[
            ["All locations", "Everything on the map."],
            [
              "Needs attention",
              "Every location in the next three rows together — start here.",
            ],
            [
              "Not placed",
              "No address found, so not on the map yet.",
            ],
            [
              "Rough match",
              "Found only as far as a street or town. Check the pin.",
            ],
            [
              "Approximate address",
              "Matched to the street, not the building. Adding the house number usually fixes it.",
            ],
            [
              "Missing details",
              "No phone, email, website, photo, opening hours or description.",
            ],
          ]}
        />

        <p>
          <strong>Tags</strong> filters by tag — several shows locations with any
          of them, <strong>Untagged</strong> those with none.{" "}
          <strong>Clear tags</strong> resets it.
        </p>
      </DocsSection>

      <DocsSection id="columns" title="Reading the list">
        <DocsTable
          caption="Columns on the Locations page"
          head={["Column", "What it tells you"]}
          rows={[
            ["Name", "What the location is called. Click it to edit."],
            [
              "Address",
              "Couldn’t find an address means the lookup failed; bare coordinates mean it was never looked up.",
            ],
            [
              "Tags",
              "Up to three, then a count. A dot marks the tag that colours the pin.",
            ],
            [
              "Status",
              "Not placed, Check (a rough match) or Approximate. Empty means all is well.",
            ],
            [
              "Missing",
              "An icon for each detail the location doesn’t have. Hover for the list.",
            ],
          ]}
        />

        <p>
          <strong>N of M locations</strong> under the list is this map’s count
          against your plan’s limit.
        </p>
      </DocsSection>

      <DocsSection id="edit" title="Editing a location">
        <p>
          Opening a location brings up <strong>Edit location</strong>. Nothing is
          saved until <strong>Save changes</strong>; <strong>Cancel</strong>{" "}
          discards everything, photos included.
        </p>

        <DocsSteps>
          <DocsStep title="Move the pin">
            <p>
              Drag the pin on the small map at the top. A pin moved by hand stays
              exactly where you put it.
            </p>
          </DocsStep>

          <DocsStep title="Name it">
            <p>
              <strong>Name</strong> is the only field every location needs.
            </p>
          </DocsStep>

          <DocsStep title="Find a new address">
            <p>
              Type the full address into <strong>Find New Location</strong> and
              press Enter. Pick one of up to five{" "}
              <strong>Address matches</strong> to move the address and pin. No
              matches? Add a city or postcode, or drag the pin.
            </p>
          </DocsStep>

          <DocsStep title="Tag it and choose a pin">
            <p>
              The first of the <strong>Tags</strong> colours the pin; drag to
              reorder. <strong>Pin</strong> picks your own pin or a built-in one.
              See{" "}
              <Link href="/docs/tags-pins-and-groups">Tags, pins and groups</Link>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          The rest is in folds below, each showing what it holds or{" "}
          <strong>Not set</strong>.
        </p>

        <DocsTable
          caption="Sections of the Edit location dialog"
          head={["Section", "What goes in it"]}
          rows={[
            [
              "Coordinates",
              "Latitude and Longitude, for when the address search can’t find the place.",
            ],
            [
              "Contact",
              "Phone, Email and Website (with its https://).",
            ],
            [
              "Extra fields",
              "Your own fields, when the map has some. See below.",
            ],
            ["Opening hours", "The week, one day at a time. See below."],
            [
              "Description, logo and photos",
              "Up to 5,000 characters, the location’s own logo, and up to 8 photos.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="hours" title="Opening hours">
        <DocsSteps>
          <DocsStep title="Open or close a day">
            <p>
              Press a day to open or close it. A newly opened day starts at
              09:00–17:00; a reopened one gets its last times back.
            </p>
          </DocsStep>

          <DocsStep title="Set the times">
            <p>
              Type 24-hour times like <code>09:00</code>, or press the clock and
              pick <strong>Opens</strong> and <strong>Closes</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Times are the location’s local time; 18:00 to 02:00 runs past midnight.
          Visitors’ cards show <strong>Open now</strong> or{" "}
          <strong>Closed now</strong>.
        </p>

        <DocsCallout tone="warning">
          <p>
            Each day holds one opening period. For a lunch break, use the full
            day’s times and mention the break in the description.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="photos" title="Photos and logo">
        <DocsTable
          caption="Photo and logo limits"
          head={["", "Photos", "Logo"]}
          rows={[
            ["How many", "Up to 8 per location", "One per location"],
            ["File types", "JPG, PNG, WebP or AVIF", "JPG, PNG, WebP or AVIF"],
            ["Largest file", "5MB each", "512KB"],
          ]}
        />

        <p>
          Press <strong>Add photos</strong> to pick several at once. The first is
          the <strong>Cover</strong>; press the star on another to change it.
          Everything uploads on <strong>Save changes</strong>.
        </p>

        <p>
          The logo is this location’s own brand mark, shown on its card — not the
          image on a pin, which is a{" "}
          <Link href="/docs/tags-pins-and-groups#pins">custom pin</Link>.
        </p>
      </DocsSection>

      <DocsSection id="extra-fields" title="Extra fields">
        <p>
          For anything the built-in fields don’t cover — a booking link, a menu,
          a dealer code.
        </p>

        <DocsSteps>
          <DocsStep title="Define the field once, for the map">
            <p>
              Press <strong>Tags &amp; fields</strong> →{" "}
              <strong>Extra fields</strong> → <strong>Add field</strong>. Give it
              a name, a <strong>Type</strong> (Text, Link, Phone or Email) and{" "}
              <strong>Show as</strong> a <strong>Detail row</strong> or{" "}
              <strong>Button</strong>, then <strong>Save changes</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Fill it in per location">
            <p>
              It appears under <strong>Extra fields</strong> in Edit location;
              leave it empty where it doesn’t apply. A map can have up to 10.
            </p>
          </DocsStep>
        </DocsSteps>
      </DocsSection>

      <DocsSection id="from-the-card" title="Filling in details from the map">
        <p>
          On the Map tab, click a pin to open its card. Anything missing shows as
          a dashed <strong>+</strong> — <strong>Add a description</strong>,{" "}
          <strong>Add opening hours</strong>, <strong>Add photos</strong> and so
          on. Fill it in and press <strong>Add</strong>.
        </p>
      </DocsSection>

      <DocsSection id="deleting" title="Deleting a location">
        <p>
          In the row’s menu (⋯), choose <strong>Delete</strong>, then{" "}
          <strong>Delete location</strong>. Visitors still see it until you
          publish again. The same menu offers <strong>Find address again</strong>{" "}
          when a lookup failed.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
