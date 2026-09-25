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
          The card is what opens when a visitor clicks a pin or a row in the
          results list: the location’s name, address, photos, opening hours and
          buttons, laid out however you like.
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
          Open <strong>Card</strong> in your map’s sidebar. The card sits in the
          middle, drawn with one of your real locations — or an example one if
          the map is still empty. The panel beside it has two tabs:
        </p>

        <ul>
          <li>
            <strong>Blocks</strong> — the pieces a card is built from, and{" "}
            <strong>Save changes</strong> at the foot.
          </li>
          <li>
            <strong>Modify</strong> — the settings of whatever is selected: a
            block, or the card itself when nothing is.
          </li>
        </ul>

        <p>
          A dot on <strong>Blocks</strong> means there are unsaved changes. Press{" "}
          <strong>Save changes</strong> and the toast confirms every map in your
          account now uses it. <strong>Reset card</strong> starts again from an
          empty card.
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

        <p>
          Button, Divider and Space can be used as often as you like; every other
          block once.
        </p>
      </DocsSection>

      <DocsSection id="building" title="Adding, moving and removing blocks">
        <DocsSteps>
          <DocsStep title="Add">
            <p>
              Drag a block from the <strong>Blocks</strong> tab onto the card. Or
              click it, then click one of the places that light up.
            </p>
          </DocsStep>

          <DocsStep title="Move and resize">
            <p>
              Drag a placed block to move it. Drag its <strong>Height</strong> or{" "}
              <strong>Size</strong> handle to resize it — arrow keys work too.
            </p>
          </DocsStep>

          <DocsStep title="Remove">
            <p>
              Drag it to the <strong>Remove</strong> wall beside the card.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          If a block won’t drop, the card is full. Make the card taller under{" "}
          <strong>Size</strong> on the Modify tab, or remove something.
        </p>
      </DocsSection>

      <DocsSection id="card-settings" title="The card itself">
        <p>
          With nothing selected, <strong>Modify</strong> shows the card’s own
          settings.
        </p>

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
        <p>
          Click a block and <strong>Modify</strong> shows the sections that apply
          to it.
        </p>

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
              "Style (Solid, Soft, Outline, Ghost or Pill), Colour, Border colour, Border width, Corners, Roominess, Hover and Full width.",
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
              "Action — Directions or Link. For a link, Link to picks the Website or one of your extra fields. Label is its text.",
            ],
            [
              "Links",
              "Show — which of Phone, Email, Website and Directions appear.",
            ],
            [
              "Logo",
              "Show — Pin, Mixed or Logo. Mixed draws the pin for locations with no logo, instead of an empty space. Corners — Square, Rounded or Round.",
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
          A button’s <strong>Colour</strong> left unset follows each location’s
          pin colour, so a map with colour-coded tags gets colour-coded buttons.
          To give every location its own button link, add an{" "}
          <Link href="/docs/managing-locations#extra-fields">extra field</Link>{" "}
          of type Link first, then pick it under <strong>Link to</strong>.
        </p>

        <p>
          The <strong>Preview</strong> section only changes what you see while
          designing — how many tag chips the example shows, and what pin colour
          it wears. Real cards always use each location’s own.
        </p>
      </DocsSection>

      <DocsSection id="one-location" title="Changing one location’s card">
        <p>
          A flagship store might want a different button, or a larger photo.
          Change it on that location alone:
        </p>

        <DocsSteps>
          <DocsStep title="Open its card on the map">
            <p>On the Map tab, click the location’s pin.</p>
          </DocsStep>

          <DocsStep title="Press Edit this card">
            <p>
              The button in the card’s top-left corner. Every block pulses
              gently.
            </p>
          </DocsStep>

          <DocsStep title="Click a block and change it">
            <p>
              A panel opens with the same settings as the designer. A Button
              here can also use <strong>A link I’ll type</strong> — a web
              address for this location only. Changes save by themselves.
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
          A location can change what a block looks like and says, but not which
          blocks the card has or their order — those stay the same everywhere.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
