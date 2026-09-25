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
          Open <strong>Locations</strong> in your map’s sidebar. Every location
          on the map is listed here — as a table on a wide screen, as stacked rows
          on a phone. Click a row, or its name, to edit it.
        </p>

        <p>Along the top:</p>

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
          Locations are added one at a time on the Map tab, not here — see{" "}
          <Link href="/docs/map-editor#adding">Adding locations</Link>.
        </p>
      </DocsSection>

      <DocsSection id="finding" title="Finding a location">
        <p>
          Type into <strong>Search locations</strong> to match on name or address.
          The <strong>Show</strong> menu narrows the list to the locations that
          want something from you:
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
              "Locations we couldn’t find an address for. They aren’t on the map yet.",
            ],
            [
              "Rough match",
              "Found, but only as far as a street or a town. Worth checking the pin.",
            ],
            [
              "Approximate address",
              "Matched to the street rather than the building. Adding the house number usually fixes it.",
            ],
            [
              "Missing details",
              "No phone, email, website, photo, opening hours or description.",
            ],
          ]}
        />

        <p>
          The <strong>Tags</strong> button filters by tag. Tags in the same group
          widen the list, tags in different groups narrow it, and{" "}
          <strong>Untagged</strong> finds the locations wearing none.{" "}
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
              "The stored address. Couldn’t find an address means the lookup failed; bare coordinates mean it was never looked up.",
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
          The count under the list reads <strong>N of M locations</strong> — how
          many this map has against what your plan allows.
        </p>
      </DocsSection>

      <DocsSection id="edit" title="Editing a location">
        <p>
          Opening a location brings up <strong>Edit location</strong>. Nothing is
          saved until you press <strong>Save changes</strong> —{" "}
          <strong>Cancel</strong> throws every change away, photos included.
        </p>

        <DocsSteps>
          <DocsStep title="Move the pin">
            <p>
              The small map at the top says{" "}
              <strong>Drag the pin to move this location.</strong> A pin you move
              by hand is kept exactly where you put it.
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
              press Enter, or the magnifier. Nothing is looked up while you type.
              You get up to five matches under <strong>Address matches</strong>;
              pick one and the address and pin both move to it. Nothing changes
              until you pick.
            </p>
            <p>
              No matches? Add a city or postcode, or drag the pin instead.
            </p>
          </DocsStep>

          <DocsStep title="Tag it and choose a pin">
            <p>
              <strong>Tags</strong> — the first tag colours the pin, and you drag
              a tag to reorder them. <strong>Pin</strong> picks one of your own
              pins or a built-in one. See{" "}
              <Link href="/docs/tags-pins-and-groups">Tags, pins and groups</Link>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          The rest is in folds below, which start shut and open one at a time.
          Each shows what it holds on the right, or <strong>Not set</strong>.
        </p>

        <DocsTable
          caption="Sections of the Edit location dialog"
          head={["Section", "What goes in it"]}
          rows={[
            [
              "Coordinates",
              "Latitude and Longitude, for when the address search can’t find the place. Dragging the pin writes these too.",
            ],
            [
              "Contact",
              "Phone, Email and Website. A website needs its https:// at the front.",
            ],
            [
              "Extra fields",
              "Your own fields, when the map has some. See below.",
            ],
            ["Opening hours", "The week, one day at a time. See below."],
            [
              "Description, logo and photos",
              "A description of up to 5,000 characters, the location’s own logo, and up to 8 photos.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="hours" title="Opening hours">
        <DocsSteps>
          <DocsStep title="Open or close a day">
            <p>
              Press a day to open it or close it. A closed day reads{" "}
              <strong>Closed</strong>. A day you open for the first time starts at
              09:00–17:00; one you reopen gets its last times back.
            </p>
          </DocsStep>

          <DocsStep title="Set the times">
            <p>
              Type them as 24-hour times, like <code>09:00</code>, or press the
              clock beside the day and pick from <strong>Opens</strong> and{" "}
              <strong>Closes</strong> in half-hour steps.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Times are the location’s own local time. A closing time earlier than the
          opening time means the location is open past midnight — 18:00 to 02:00
          works as you’d expect.
        </p>

        <DocsCallout tone="warning">
          <p>
            Each day holds one opening period. A location that closes for lunch
            can’t be shown as two periods yet — use its full opening and closing
            times, and mention the break in the description.
          </p>
        </DocsCallout>

        <p>
          On a visitor’s card, opening hours show <strong>Open now</strong> or{" "}
          <strong>Closed now</strong>.
        </p>
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
          Press <strong>Add photos</strong> and pick as many as you like at once.
          The first photo is the <strong>Cover</strong>; press the star on another
          to make it the cover instead. Photos and the logo upload when you press{" "}
          <strong>Save changes</strong>.
        </p>

        <p>
          The logo is this location’s own brand mark — a stockist’s logo, say —
          shown on its card. It is not the image on a pin; that is a{" "}
          <Link href="/docs/tags-pins-and-groups#pins">custom pin</Link>, shared
          by every location wearing it.
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
              On Locations, press <strong>Tags &amp; fields</strong>, open the{" "}
              <strong>Extra fields</strong> tab and press{" "}
              <strong>Add field</strong>. Give it a name, a{" "}
              <strong>Type</strong> — Text, Link, Phone or Email — and choose{" "}
              <strong>Show as</strong>: a <strong>Detail row</strong> or a{" "}
              <strong>Button</strong>. Press <strong>Save fields</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Fill it in per location">
            <p>
              The field now appears under <strong>Extra fields</strong> in Edit
              location. Leave it empty on locations it doesn’t apply to.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>A map can have up to 10 extra fields.</p>
      </DocsSection>

      <DocsSection id="from-the-card" title="Filling in details from the map">
        <p>
          On the Map tab, click a pin to open its card. Anything the location
          doesn’t have yet shows as a dashed <strong>+</strong> —{" "}
          <strong>Add a description</strong>, <strong>Add opening hours</strong>,{" "}
          <strong>Add photos</strong> and so on. Fill it in and press{" "}
          <strong>Add</strong>. It’s the quickest way to finish a location while
          you’re looking at it.
        </p>
      </DocsSection>

      <DocsSection id="deleting" title="Deleting a location">
        <p>
          Open the row’s menu (⋯) and choose <strong>Delete</strong>, then{" "}
          <strong>Delete location</strong>. If the map is published, the location
          stays visible to visitors until you publish again.
        </p>

        <p>
          The same menu offers <strong>Find address again</strong> on a location
          whose lookup failed.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
