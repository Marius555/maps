import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("map-editor");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The Map tab: toolbar, adding and moving pins, appearance, export.
 *
 * The toolbar's first two buttons are icons with no text, so they are named
 * here by what they look like and where they sit. Every other control is quoted
 * as `components/map/**` and `components/appearance/**` draw it.
 */
export default function MapEditorPage() {
  return (
    <DocsArticle
      title="The map editor"
      summary="Add and move locations on the map, choose how the map looks, and export it as an image or a PDF."
    >
      <DocsSection id="toolbar" title="The toolbar">
        <p>
          The Map tab is your map, full size, with a toolbar across the top and
          your locations listed beside it. From left to right:
        </p>

        <DocsTable
          caption="Toolbar buttons, left to right"
          head={["Button", "What it does"]}
          rows={[
            [
              "Pin",
              "Adds a location. Opens a grid of pins to choose from, or drag it onto the map.",
            ],
            [
              "Shapes",
              <>
                Draws a circle, area, line or route, or imports shapes. See{" "}
                <Link href="/docs/shapes-and-routes">Shapes and routes</Link>.
              </>,
            ],
            [
              "Select several",
              "Drag a box to pick several locations and shapes at once.",
            ],
            ["Undo", "Undoes the last pin you moved. Ctrl+Z, or ⌘Z on a Mac."],
            [
              "Map appearance",
              "The map style, how many labels it shows, and which layers are drawn.",
            ],
            [
              "Save this view as default",
              "Makes what you see now — position and zoom — where the published map opens.",
            ],
            [
              "Preview as a visitor",
              "Opens the map the way a visitor will see it.",
            ],
            [
              "Export this map",
              "Saves the map as a PNG, JPEG or PDF.",
            ],
            [
              "Find an address",
              "Searches for an address and moves the map there.",
            ],
          ]}
        />

        <p>
          On a phone, the buttons tuck themselves away one at a time while the
          search is open, so the pin button and the search are always there.
        </p>
      </DocsSection>

      <DocsSection id="adding" title="Adding locations">
        <p>Three ways, all ending with a new pin on the map:</p>

        <DocsSteps>
          <DocsStep title="Click to place">
            <p>
              Press the pin button and choose a pin — <strong>Plain</strong>, a
              built-in one, or one of yours. The map says{" "}
              <strong>
                Click the map to add a location. Press Esc to stop.
              </strong>{" "}
              Click where the location is. Adding switches off after each pin.
            </p>
          </DocsStep>

          <DocsStep title="Drag to place">
            <p>
              Drag the pin button, or any pin in its grid, straight onto the map
              and let go where the location is.
            </p>
          </DocsStep>

          <DocsStep title="Search to place">
            <p>
              Type an address into <strong>Find an address</strong>, press Enter,
              and press <strong>Add a location here</strong> beside the match you
              want.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A new location is called <strong>Location 1</strong>,{" "}
          <strong>Location 2</strong> and so on, and its street address fills in
          by itself a moment later. If no address can be found for that spot, its
          row says <strong>Couldn’t find an address</strong>. Rename it and fill
          in the rest from its card or from{" "}
          <Link href="/docs/managing-locations#edit">Edit location</Link>.
        </p>

        <DocsCallout>
          <p>
            Each pin you drop, and each address it looks up, uses one address
            lookup from your monthly allowance. See{" "}
            <Link href="/docs/plans-and-billing#lookups">
              What counts as a lookup
            </Link>
            .
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="moving" title="Moving locations">
        <p>
          Drag any pin to move it. It saves when you let go. Moved the wrong one?
          Press Undo, or Ctrl+Z (⌘Z on a Mac).
        </p>

        <p>
          Pins can’t be dragged while a drawing tool is on — press Esc first.
        </p>
      </DocsSection>

      <DocsSection id="selecting" title="Working on several at once">
        <DocsSteps>
          <DocsStep title="Select">
            <p>
              Press <strong>Select several</strong> and drag a box around the
              locations and shapes you want. Press Esc to stop.
            </p>
          </DocsStep>

          <DocsStep title="Act on the selection">
            <p>
              A bar shows how many are selected. <strong>Group</strong> puts them
              in a group (<strong>Merge</strong> when they are already grouped),{" "}
              <strong>Tag</strong> adds or removes a tag on all of them, and{" "}
              <strong>Clear</strong> ends the selection.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Groups keep a long list tidy while you work; see{" "}
          <Link href="/docs/tags-pins-and-groups#groups">Groups</Link>.
        </p>
      </DocsSection>

      <DocsSection id="appearance" title="How the map looks">
        <p>
          Press <strong>Map appearance</strong>. Changes save as you make them,
          and reach your published map the next time you publish.
        </p>

        <DocsTable
          caption="Map styles"
          head={["Group", "Styles", "About them"]}
          rows={[
            [
              "Auto",
              "Auto",
              "Light or dark to match whoever is looking — your theme here, each visitor’s own setting on your site. The default.",
            ],
            [
              "Basemaps",
              "Liberty, Bright, Positron, Dark, Fiord",
              "Different maps, drawn by the tile provider.",
            ],
            [
              "Themes",
              "Midnight, Carbon, Ember, Amber, Lagoon, Blueprint, Mono, Sepia, Verdant, Frost",
              "The same map, recoloured. The first six are dark, the last four light.",
            ],
          ]}
        />

        <p>
          <strong>Labels</strong> sets how much text the map carries:{" "}
          <strong>All labels</strong>, <strong>Fewer labels</strong> (place names
          and airports only) or <strong>No labels</strong>. Your own pins keep
          their names either way.
        </p>

        <p>
          <strong>Layers</strong> switches parts of the map on and off:{" "}
          <strong>Points of interest</strong>,{" "}
          <strong>Railways and transit</strong>, <strong>Buildings</strong>,{" "}
          <strong>3D buildings</strong>,{" "}
          <strong>Paths and pedestrian streets</strong> and{" "}
          <strong>Cycle paths</strong>. All but cycle paths are on to begin with.
          Turning off points of interest keeps attention on your own locations.
        </p>

        <DocsCallout>
          <p>
            There is no live traffic or satellite imagery. Both are paid feeds
            charged per map view, and your maps are unlimited because nothing on
            them costs anything to look at.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="default-view" title="Where the map opens">
        <p>
          Pan and zoom to the view you want visitors to start from, then press{" "}
          <strong>Save this view as default</strong>. A{" "}
          <strong>View saved</strong> note confirms it. Publish again for your
          site to pick it up.
        </p>
      </DocsSection>

      <DocsSection id="export" title="Exporting an image or PDF">
        <p>
          Press <strong>Export this map</strong>, choose the options below and
          press <strong>Export</strong>. The file is named after the map and made
          entirely in your browser — nothing is uploaded.
        </p>

        <DocsTable
          caption="Export options"
          head={["Option", "Choices"]}
          rows={[
            ["Format", "PNG, JPEG or PDF."],
            [
              "Page",
              "Same shape as the map, A4 landscape or portrait, Letter landscape or portrait, or A3 landscape.",
            ],
            [
              "Quality",
              "Screen (for a slide or a web page), Good (sharp on a retina display) or Print (full detail, for paper).",
            ],
          ]}
        />

        <p>
          The map credit is drawn into the image. If the export says the page is
          too big for the browser, choose a smaller quality. If it says the map is
          still loading, wait a moment and try again.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
