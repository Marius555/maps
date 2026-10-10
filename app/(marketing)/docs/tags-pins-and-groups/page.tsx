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
              "Keeping your list tidy, and colouring or changing many pins at once.",
              "Only as the colour of the pins and shapes in it",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="tags" title="Setting up tags">
        <p>
          Visitors filter your map by tags. Each has a colour, and a location’s
          first tag colours its pin.
        </p>

        <DocsSteps>
          <DocsStep title="Open Tags & fields">
            <p>
              On Locations, press <strong>Tags &amp; fields</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Add your tags">
            <p>
              Press <strong>Add tag</strong> and name it. Press its swatch to
              change the colour.
            </p>
          </DocsStep>

          <DocsStep title="Save">
            <p>
              Press <strong>Save changes</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A count such as <strong>3 locations</strong> beside a tag lists who
          wears it. For tag colours on the card, select the card designer’s{" "}
          <strong>Tags</strong> block and turn on{" "}
          <strong>Use tag colours</strong>. A map holds up to 60 tags, a
          location 20, and a name 64 characters.
        </p>

        <DocsCallout>
          <p>
            Removing a tag hides it from your published map, but locations keep
            it — adding it back restores everything.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="tagging" title="Tagging locations">
        <p>
          In <Link href="/docs/managing-locations#edit">Edit location</Link>,
          pick from <strong>Tags</strong>, or choose <strong>New tag</strong> to
          make one there.
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
          tab, then <strong>Tag</strong>.
        </p>
      </DocsSection>

      <DocsSection id="pins" title="Custom pins">
        <p>
          Press the pin button in the Map tab’s toolbar and choose{" "}
          <strong>New</strong>, or start from a built-in pin: Shop, Restaurant,
          Café, Hotel, Office or Landmark.
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
              "Your logo instead of an icon — PNG, JPG, WebP or SVG.",
            ],
          ]}
        />

        <p>
          Press <strong>Use pin</strong> to save it to <strong>Your pins</strong>{" "}
          — up to 8 per account. Deleting a pin puts the locations wearing it
          back on a plain pin.
        </p>
      </DocsSection>

      <DocsSection id="pin-colour" title="What colour a pin ends up">
        <p>The first of these that applies wins:</p>

        <ol className="list-decimal space-y-2 pl-5 marker:text-muted">
          <li>The colour of the group the location is in, if it has one.</li>
          <li>
            For a route stop in no group: the route’s group colour.
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
          Groups gather locations and shapes in the Map tab’s list. Visitors
          don’t see groups, but they do see a group’s colour on everything in
          it. To make one:
        </p>

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
              "Gives every location in it the same pin.",
            ],
            [
              "Ungroup",
              "Moves everything back to the main list.",
            ],
            [
              "Delete group and contents",
              "Permanently deletes the group and every location and shape in it.",
            ],
          ]}
        />

        <p>
          To take one out, use <strong>Remove from group</strong> in its menu,
          or drag it onto that strip.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
