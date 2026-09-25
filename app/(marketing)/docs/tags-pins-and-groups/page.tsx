import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("tags-pins-and-groups");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * Tags, custom pins and editor groups — three ways of sorting locations that
 * people confuse, so the page says early which of them a visitor ever sees.
 *
 * Labels are quoted as `components/tags/**`, `components/map/pin-studio/**`
 * and `components/groups/**` draw them.
 */
export default function TagsPinsAndGroupsPage() {
  return (
    <DocsArticle
      title="Tags, pins and groups"
      summary="Sort your locations with tags, give them pins in your own colours or with your logo, and keep a big map tidy with groups."
    >
      <DocsSection id="which" title="Which one do you want?">
        <DocsTable
          caption="Tags, pins and groups compared"
          head={["", "What it is for", "Visitors see it"]}
          rows={[
            [
              "Tags",
              "Saying what a location offers — “Sells bikes”, “Open Sundays”. The first tag colours the pin.",
              "Yes, on the card",
            ],
            [
              "Pins",
              "How a location’s marker looks — your colours, a shape, an icon or your logo.",
              "Yes, on the map",
            ],
            [
              "Groups",
              "Keeping your own list tidy while you work, colouring many pins at once, and changing their pins together.",
              "Only as the colour of the pins and shapes in it",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="tags" title="Setting up tags">
        <p>
          Tags live in groups. A group is one question — “Sells”, or “Open on
          Sundays” — and the tags inside it are its answers.
        </p>

        <DocsSteps>
          <DocsStep title="Open Tags & fields">
            <p>
              On Locations, press <strong>Tags &amp; fields</strong> and stay on
              the <strong>Filters</strong> tab.
            </p>
          </DocsStep>

          <DocsStep title="Add a group">
            <p>
              Press <strong>Add group</strong> and name it — what are you
              filtering by?
            </p>
          </DocsStep>

          <DocsStep title="Add its tags">
            <p>
              Type a tag name and press <strong>Add tag</strong>. Each new tag
              takes the next unused colour; press its swatch to change it.
            </p>
          </DocsStep>

          <DocsStep title="Save">
            <p>
              Press <strong>Save filters</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Tags in the same group widen results; tags in different groups narrow
          them. Choosing “Bikes” and “Scooters” from one group finds locations
          with either; adding “Open Sundays” from another keeps only the ones
          that are also open on Sundays.
        </p>

        <DocsCallout>
          <p>
            Removing a tag hides it from your published map. Locations keep it
            until you change them, so adding it back brings everything back.
          </p>
        </DocsCallout>

        <DocsTable
          caption="Tag limits"
          head={["Limit", "Allowed"]}
          rows={[
            ["Groups per map", "6"],
            ["Tags per group", "24"],
            ["Tags per map", "60"],
            ["Tags per location", "20"],
            ["Length of a name", "64 characters"],
          ]}
        />
      </DocsSection>

      <DocsSection id="tagging" title="Tagging locations">
        <p>
          In <Link href="/docs/managing-locations#edit">Edit location</Link>,
          open <strong>Tags</strong> and pick from the list. Need one that
          doesn’t exist yet? Choose <strong>New tag</strong>, name it, pick a
          colour and press <strong>Add tag</strong>.
        </p>

        <DocsCallout tone="warning">
          <p>
            The order matters: <strong>the first tag colours the pin</strong>.
            Drag a tag to reorder, or focus it and use Alt with the left and right
            arrow keys.
          </p>
        </DocsCallout>

        <p>
          To tag many at once, use <strong>Select several</strong> on the Map
          tab, press <strong>Tag</strong> in the bar, choose add or remove, then
          pick the tag.
        </p>
      </DocsSection>

      <DocsSection id="pins" title="Custom pins">
        <p>
          Press the pin button at the left of the Map tab’s toolbar and choose{" "}
          <strong>New</strong> (<strong>Make a new pin</strong>). Or start from
          one of the built-in pins: Shop, Restaurant, Café, Hotel, Office and
          Landmark.
        </p>

        <DocsTable
          caption="Pin designer settings"
          head={["Setting", "Choices"]}
          rows={[
            ["Name", "Up to 32 characters. Only you see it."],
            ["Icon", "A symbol drawn inside the pin."],
            ["Fill", "The pin’s colour."],
            ["Shape", "Circle, Square or Diamond."],
            ["Size", "Small, Medium or Large."],
            ["Ring", "No ring, Thin, Regular or Thick."],
            [
              "Ring colour, Icon colour",
              "Automatic picks one that reads against the fill.",
            ],
            [
              "Upload an image",
              "Your logo in place of an icon — PNG, JPG, WebP or SVG. Flat colours work best.",
            ],
          ]}
        />

        <p>
          Press <strong>Use pin</strong>. It is saved to{" "}
          <strong>Your pins</strong> and the pin button is ready to drop it. An
          account can have up to 8 custom pins.
        </p>

        <p>
          Deleting a pin that locations are wearing puts them back on a plain pin
          — the button says how many before you press it.
        </p>
      </DocsSection>

      <DocsSection id="pin-colour" title="What colour a pin ends up">
        <p>When more than one thing could colour a pin, the first that applies wins:</p>

        <ol className="list-decimal space-y-2 pl-5 marker:text-muted">
          <li>The colour of the group the location is in, if it has one.</li>
          <li>
            The colour of the group a route belongs to, for a location that is a
            stop on that route and in no group of its own.
          </li>
          <li>The custom pin’s own fill.</li>
          <li>The colour of the location’s first tag.</li>
          <li>
            The map’s <strong>Default pin</strong> colour, set on the Publish tab
            under <strong>Colours</strong>.
          </li>
        </ol>
      </DocsSection>

      <DocsSection id="groups" title="Groups">
        <p>
          Groups gather locations and shapes in the Map tab’s list so a long map
          stays manageable. Visitors never see a group as such — no heading, no
          filter — but they do see its colour: give a group a colour and every
          location and shape in it is drawn in that colour, on your published
          map too.
        </p>

        <p>Three ways to make one:</p>

        <ul>
          <li>
            A location’s menu → <strong>Create group</strong>.
          </li>
          <li>Drag one location’s row onto another’s.</li>
          <li>
            <strong>Select several</strong>, then <strong>Group</strong>.
          </li>
        </ul>

        <p>A group’s menu offers:</p>

        <DocsTable
          caption="Group menu"
          head={["Item", "What it does"]}
          rows={[
            ["Rename", "Change its name and its colour."],
            [
              "Change pins",
              "Gives every location in it the same pin. Change individual ones afterwards if they should differ.",
            ],
            [
              "Ungroup",
              "Moves everything back to the main list. Nothing on the published map changes.",
            ],
            [
              "Delete group and contents",
              "Permanently deletes the group and every location and shape in it.",
            ],
          ]}
        />

        <p>
          To take one location out, use its menu’s{" "}
          <strong>Remove from group</strong>, or drag it onto the{" "}
          <strong>Remove from group</strong> strip.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
