import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("designing-the-card");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The card designer, and overriding it for one location.
 *
 * Labels are quoted as `components/card/designer/**` draws them. The retired
 * "Main tag" and "More details" blocks are left out on purpose: they can no
 * longer be added, and documenting them would send people looking.
 */
export default function DesigningTheCardPage() {
  return (
    <DocsArticle
      title="Designing the card"
      summary="Choose what a visitor sees when they open a location, lay it out block by block, and change it for one location only."
    >
      <DocsSection id="what" title="What the card is">
        <p>
          The card opens when a visitor clicks a pin or a results row: the
          location’s name, address, photos, hours and buttons, laid out as you
          like.
        </p>

        <DocsCallout>
          <p>
            One design covers your whole account — every location on every map.
            Any single location can still differ; see{" "}
            <Link href="#one-location">Changing one location’s card</Link>.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="layout" title="Finding your way around">
        <p>
          Open <strong>Card</strong> in your map’s sidebar. The card is drawn
          with one of your locations (or an example), beside a panel with two
          tabs:
        </p>

        <ul>
          <li>
            <strong>Blocks</strong> — the pieces a card is built from, and{" "}
            <strong>Save changes</strong> at the foot.
          </li>
          <li>
            <strong>Modify</strong> — settings for the selected block, or the
            card when nothing is selected.
          </li>
        </ul>

        <p>
          A dot on <strong>Blocks</strong> means unsaved changes.{" "}
          <strong>Reset card</strong> starts again from an empty card.
        </p>
      </DocsSection>

      <DocsSection id="blocks" title="The blocks">
        <DocsTable
          caption="Card blocks and where they can go"
          head={["Block", "What it shows", "Can go"]}
          rows={[
            ["Name", "The location’s name.", "Top or middle"],
            ["Address", "Its stored address.", "Top or middle"],
            ["Description", "Its description.", "Middle"],
            ["Tags", "Its tags, as coloured chips.", "Top or middle"],
            [
              "Opening hours",
              "The week, with Open now or Closed now.",
              "Middle or bottom",
            ],
            ["Photos", "Its photos, with arrows between them.", "Anywhere"],
            ["Logo", "Its own logo, or its pin.", "Anywhere"],
            [
              "Links",
              "Phone, email, website and directions.",
              "Bottom",
            ],
            [
              "Button",
              "Directions, the website, or one of your extra fields.",
              "Middle or bottom",
            ],
            ["Divider", "A line.", "Anywhere"],
            ["Space", "A gap.", "Anywhere"],
          ]}
        />

        <p>Button, Divider and Space can repeat; every other block is used once.</p>
      </DocsSection>

      <DocsSection id="building" title="Adding, moving and removing blocks">
        <DocsSteps>
          <DocsStep title="Add">
            <p>
              Drag a block from <strong>Blocks</strong> onto the card, or click
              it and then a highlighted spot.
            </p>
          </DocsStep>

          <DocsStep title="Move and resize">
            <p>
              Drag a block to move it, and its <strong>Height</strong> or{" "}
              <strong>Size</strong> handle (or arrow keys) to resize it.
            </p>
          </DocsStep>

          <DocsStep title="Remove">
            <p>
              Drag it to the <strong>Remove</strong> wall beside the card.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A block that won’t drop means the card is full: make it taller under{" "}
          <strong>Size</strong>, or remove something.
        </p>
      </DocsSection>

      <DocsSection id="card-settings" title="The card itself">
        <DocsTable
          caption="Card settings"
          head={["Section", "Settings"]}
          rows={[
            ["Size", "Width and Height, from XS to XL."],
            ["Spacing", "Padding, and the Gap between blocks."],
            [
              "Style",
              "Corners, Shadow, Background, Transparency, Blur behind, Border and Border width.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="block-settings" title="A block’s settings">
        <DocsTable
          caption="Block settings"
          head={["Section", "Settings"]}
          rows={[
            [
              "Size & position",
              "Position (Top, Middle or Bottom), Height, Width, Alignment, and whether it Overlaps the photo.",
            ],
            ["Spacing", "Margin and Padding."],
            ["Text", "Font, Size, Colour and Bold."],
            [
              "Chips",
              "For Tags: Chip colour, Chip border, Border width and Chip padding.",
            ],
            [
              "Button style",
              "Style (Solid, Soft, Outline, Ghost or Pill), Colour, Border colour, Border width, Corners, Inner padding, Hover and Full width.",
            ],
            [
              "Content",
              "What the block shows. Different for each block — see below.",
            ],
          ]}
        />

        <DocsTable
          caption="Content settings by block"
          head={["Block", "Content settings"]}
          rows={[
            [
              "Button",
              "Action — Directions or Link. Link to picks the Website or an extra field. Label is its text.",
            ],
            [
              "Links",
              "Show — which of Phone, Email, Website and Directions appear.",
            ],
            [
              "Logo",
              "Show — Pin, Mixed (the pin where there’s no logo) or Logo. Corners — Square, Rounded or Round.",
            ],
            [
              "Description",
              "Show it in full, or cut it to a number of Lines.",
            ],
            [
              "Opening hours",
              "Week — Bold, Whole week, Full day names — and Space between days.",
            ],
          ]}
        />

        <p>
          A button with no <strong>Colour</strong> follows each location’s pin
          colour. For a per-location button link, add an{" "}
          <Link href="/docs/managing-locations#extra-fields">extra field</Link>{" "}
          of type Link, then pick it under <strong>Link to</strong>.{" "}
          <strong>Preview</strong> settings only change the example you design
          with.
        </p>
      </DocsSection>

      <DocsSection id="one-location" title="Changing one location’s card">
        <p>
          A flagship store might want a different button or a larger photo:
        </p>

        <DocsSteps>
          <DocsStep title="Open its card on the map">
            <p>On the Map tab, click the location’s pin.</p>
          </DocsStep>

          <DocsStep title="Press Edit this card">
            <p>It’s in the card’s top-left corner.</p>
          </DocsStep>

          <DocsStep title="Click a block and change it">
            <p>
              The designer’s settings open, and save by themselves. A Button
              can also use <strong>A link I’ll type</strong>, for this location
              only.
            </p>
          </DocsStep>

          <DocsStep title="Press Done">
            <p>
              <strong>Reset to card design</strong> takes the block back to the
              account’s design.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A location can change how a block looks and what it says, but not
          which blocks the card has or their order.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
