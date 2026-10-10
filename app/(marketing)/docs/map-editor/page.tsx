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
          The Map tab shows your map with a toolbar across the top and your
          locations beside it. From left to right:
        </p>

        <DocsTable
          caption="Toolbar buttons, left to right"
          head={["Button", "What it does"]}
          rows={[
            [
              "Pin",
              "Adds a location: pick from its grid of pins, or drag it onto the map.",
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
              "Makes the current position and zoom where the published map opens.",
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
      </DocsSection>

      <DocsSection id="adding" title="Adding locations">
        <p>Three ways:</p>

        <DocsSteps>
          <DocsStep title="Click to place">
            <p>
              Press the pin button, choose a pin — <strong>Plain</strong>, a
              built-in one or one of yours — and click where the location is. Esc
              stops.
            </p>
          </DocsStep>

          <DocsStep title="Drag to place">
            <p>
              Drag the pin button, or any pin in its grid, onto the map.
            </p>
          </DocsStep>

          <DocsStep title="Search to place">
            <p>
              Type an address into <strong>Find an address</strong>, press Enter,
              then <strong>Add a location here</strong> beside a match.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          A new location is called <strong>Location 1</strong>,{" "}
          <strong>Location 2</strong> and so on, and its address fills in a
          moment later (or reads <strong>Couldn’t find an address</strong>).
          Rename it and fill in the rest from its card or{" "}
          <Link href="/docs/managing-locations#edit">Edit location</Link>.
        </p>

        <DocsCallout>
          <p>
            Each pin you drop uses one lookup from your monthly allowance. See{" "}
            <Link href="/docs/plans-and-billing#lookups">
              What counts as a lookup
            </Link>
            .
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="moving" title="Moving locations">
        <p>
          Drag any pin to move it; it saves when you let go. Undo, or Ctrl+Z (⌘Z),
          puts it back. Pins can’t be dragged while a drawing tool is on — press
          Esc first.
        </p>
      </DocsSection>

      <DocsSection id="selecting" title="Working on several at once">
        <DocsSteps>
          <DocsStep title="Select">
            <p>
              Press <strong>Select several</strong> and drag a box around
              locations and shapes. Esc stops.
            </p>
          </DocsStep>

          <DocsStep title="Act on the selection">
            <p>
              <strong>Group</strong> puts them in a{" "}
              <Link href="/docs/tags-pins-and-groups#groups">group</Link> (
              <strong>Merge</strong> if already grouped), <strong>Tag</strong>{" "}
              adds or removes a tag on all of them, and <strong>Clear</strong>{" "}
              ends the selection.
            </p>
          </DocsStep>
        </DocsSteps>
      </DocsSection>

      <DocsSection id="appearance" title="How the map looks">
        <p>
          Press <strong>Map appearance</strong>. Changes save at once and reach
          your site when you next publish.
        </p>

        <DocsTable
          caption="Map styles"
          head={["Group", "Styles", "About them"]}
          rows={[
            [
              "Auto",
              "Auto",
              "Light or dark to match each viewer’s own setting. The default.",
            ],
            [
              "Basemaps",
              "Liberty, Bright, Positron, Dark, Fiord",
              "Different maps, drawn by the tile provider.",
            ],
            [
              "Themes",
              "Midnight, Carbon, Ember, Amber, Lagoon, Blueprint, Mono, Sepia, Verdant, Frost",
              "The same map, recoloured. The first six dark, the last four light.",
            ],
          ]}
        />

        <p>
          <strong>Labels</strong>: <strong>All labels</strong>,{" "}
          <strong>Fewer labels</strong> (place names and airports) or{" "}
          <strong>No labels</strong>. Your pins keep their names either way.
        </p>

        <p>
          <strong>Layers</strong>: <strong>Points of interest</strong>,{" "}
          <strong>Railways and transit</strong>, <strong>Buildings</strong>,{" "}
          <strong>3D buildings</strong>,{" "}
          <strong>Paths and pedestrian streets</strong> and{" "}
          <strong>Cycle paths</strong> — all but cycle paths on to begin with.
          Turning off points of interest keeps attention on your locations.
        </p>

        <DocsCallout>
          <p>
            There is no live traffic or satellite imagery: both are charged per
            map view, and your maps have unlimited views.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="default-view" title="Where the map opens">
        <p>
          Pan and zoom to where visitors should start, press{" "}
          <strong>Save this view as default</strong>, then publish again.
        </p>
      </DocsSection>

      <DocsSection id="export" title="Exporting an image or PDF">
        <p>
          Press <strong>Export this map</strong>, choose the options below, and
          press <strong>Export</strong>. The file is made in your browser.
        </p>

        <DocsTable
          caption="Export options"
          head={["Option", "Choices"]}
          rows={[
            ["Format", "PNG, JPEG or PDF."],
            [
              "Page",
              "Same shape as the map, A4 or Letter (landscape or portrait), or A3 landscape.",
            ],
            [
              "Quality",
              "Screen (slides, web), Good (sharp on retina displays) or Print (full detail).",
            ],
          ]}
        />

        <p>
          The map credit is drawn into the image. Too big for the browser? Choose
          a lower quality. Still loading? Wait a moment and try again.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
