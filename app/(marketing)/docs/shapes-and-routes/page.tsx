import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("shapes-and-routes");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * Circles, areas, lines, imported shapes and driving routes.
 *
 * Labels and hints are quoted as `components/map/shapes/**`,
 * `components/shapes/**` and `components/map/routes/**` draw them. Routes are a
 * line, a distance and a drive time — not turn-by-turn directions, and the page
 * does not suggest otherwise (CLAUDE.md §11).
 */
export default function ShapesAndRoutesPage() {
  return (
    <DocsArticle
      title="Shapes and routes"
      summary="Draw delivery areas, zones and lines on your map, import them from a GIS file, and draw driving routes between locations."
    >
      <DocsSection id="draw-menu" title="The drawing tools">
        <p>
          On the Map tab, press the shapes button, second from the left in the
          toolbar. It offers:
        </p>

        <DocsTable
          caption="Drawing tools"
          head={["Tool", "How it draws"]}
          rows={[
            ["Circle", "Drag out from the centre."],
            ["Polygon", "Click each corner, Enter to finish."],
            ["Line", "Click each point, Enter to finish."],
            [
              "Route",
              "Click each location, Enter to follow the roads. Starter and Pro.",
            ],
            ["Import shapes", "GeoJSON, TopoJSON or ArcGIS JSON."],
          ]}
        />

        <p>
          Press Esc, or the shapes button again, to put a tool away. While
          drawing, Backspace removes the last point you placed.
        </p>
      </DocsSection>

      <DocsSection id="drawing" title="Drawing a shape">
        <DocsSteps>
          <DocsStep title="Circle">
            <p>
              Press where the centre goes and drag outwards until the circle is
              the size you want. The smallest radius is 10 metres.
            </p>
          </DocsStep>

          <DocsStep title="Polygon">
            <p>
              Click each corner in turn. Click the first point again, or press
              Enter, to close it.
            </p>
          </DocsStep>

          <DocsStep title="Line">
            <p>
              Click each point and press Enter to finish. A point clicked near one
              of your locations snaps onto it.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          New shapes are named <strong>Circle 1</strong>,{" "}
          <strong>Area 1</strong> or <strong>Line 1</strong>, ready to rename.
        </p>
      </DocsSection>

      <DocsSection id="editing" title="Changing a shape">
        <p>
          Click a shape to select it. Its card shows what it is — a circle’s
          radius, a polygon’s points, a line’s length.
        </p>

        <ul>
          <li>
            <strong>On the map:</strong> drag a circle’s handles to move or resize
            it. Drag a polygon’s points to reshape it, its centre to move it, and
            the small handle halfway along an edge to add a point there. Each
            change saves when you let go.
          </li>
          <li>
            <strong>Its details:</strong> press <strong>Edit shape</strong>.
          </li>
        </ul>

        <DocsTable
          caption="Edit shape settings"
          head={["Setting", "What it does"]}
          rows={[
            ["Name", "What the shape is called on its card."],
            ["Description", "A line or two shown on its card."],
            ["Colour", "Its outline and fill colour."],
            ["Thickness", "The outline, from 1 to 12 pixels."],
            ["Line style", "Solid, Dashed or Dotted."],
            [
              "Fill",
              "How strongly the inside is filled, from 0 to 100%. Not on lines.",
            ],
          ]}
        />

        <p>
          To delete a shape, open its menu in the list and choose{" "}
          <strong>Delete</strong>, then <strong>Delete shape</strong>. On a
          published map it stays visible until you publish again.
        </p>
      </DocsSection>

      <DocsSection id="import" title="Importing shapes">
        <p>
          Delivery zones and sales territories often already exist in a GIS tool.
          Bring them in rather than tracing them.
        </p>

        <DocsSteps>
          <DocsStep title="Choose the file">
            <p>
              Pick <strong>Import shapes</strong> from the drawing tools, then
              press <strong>Choose file</strong> or drag the file in. It has to be
              GeoJSON, TopoJSON or ArcGIS JSON, under 5MB. It is read in your
              browser and nothing is saved until you confirm.
            </p>
          </DocsStep>

          <DocsStep title="Check what was found">
            <p>
              The dialog says how many shapes it found. If the coordinates could
              be read either way round, a <strong>Latitude is written first</strong>{" "}
              switch lets you say which.
            </p>
          </DocsStep>

          <DocsStep title="Import">
            <p>
              Press <strong>Import N</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsTable
          caption="Shape import problems"
          head={["What you see", "What to do"]}
          rows={[
            [
              "The file isn’t valid JSON",
              "Export it again from your GIS tool — the file is damaged or isn’t JSON.",
            ],
            [
              "The file has points and no areas or lines",
              <>
                Points are locations. Import them from the Locations tab — see{" "}
                <Link href="/docs/importing-locations">Importing locations</Link>.
              </>,
            ],
            [
              "Those coordinates aren’t latitude and longitude",
              "Re-export it as WGS84 (EPSG:4326) and try again.",
            ],
            [
              "The file is over 5MB",
              "Simplify it in your GIS tool and try again.",
            ],
            [
              "A shape was simplified",
              "A shape can have up to 500 points; bigger ones are simplified to fit.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="limits" title="How many shapes you can have">
        <DocsTable
          caption="Shapes allowed per map"
          head={["Plan", "Shapes and routes per map"]}
          rows={[
            ["Free", "3"],
            ["Starter", "50"],
            ["Pro", "250"],
          ]}
        />

        <p>
          Routes count as shapes. At the limit the drawing tools turn grey, and an
          import that wouldn’t fit says how many more your plan has room for.
        </p>
      </DocsSection>

      <DocsSection id="routes" title="Drawing a route">
        <p>
          A route is a driving line between your locations, drawn along the
          roads, with its distance and drive time. Routes are on the Starter and
          Pro plans.
        </p>

        <DocsSteps>
          <DocsStep title="Choose Route">
            <p>
              Pick <strong>Route</strong> from the drawing tools. The map checks
              which of your locations are near a road; any it can’t reach turn
              grey and can’t be picked.
            </p>
          </DocsStep>

          <DocsStep title="Click the stops in order">
            <p>
              Click the location to start from, then each one after it. Only
              locations can be stops — a click on open ground adds nothing. A
              route can have up to 25 stops.
            </p>
          </DocsStep>

          <DocsStep title="Press Enter">
            <p>
              The route is worked out along the roads and drawn. Its card reads
              like <strong>Route · 12 km · 19 min</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Routes are for driving. They are a line and a time, not turn-by-turn
          directions — the <strong>Directions</strong> link on each location’s
          card opens the visitor’s own maps app for that.
        </p>

        <DocsCallout>
          <p>
            Checking which locations are reachable uses address lookups from your
            monthly allowance — up to one per location on the map when the Route
            tool opens. See{" "}
            <Link href="/docs/plans-and-billing#lookups">
              What counts as a lookup
            </Link>
            .
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="changing-routes" title="Changing a route">
        <p>
          A route’s stops are listed under it in the Map tab’s sidebar. Each
          stop’s menu offers <strong>Move up</strong>,{" "}
          <strong>Move down</strong>, <strong>Make this the start</strong>,{" "}
          <strong>Make this the end</strong> and{" "}
          <strong>Remove from route</strong>.
        </p>

        <p>
          If you move a location that is a stop, the route keeps its old line and
          says{" "}
          <strong>
            A stop has moved. The route still follows the old roads until you
            work it out again.
          </strong>{" "}
          Press <strong>Recalculate</strong>.
        </p>

        <p>
          Routes take the same <strong>Line style</strong> and{" "}
          <strong>Colour</strong> as any line, from <strong>Edit shape</strong>.
          Put a route in a{" "}
          <Link href="/docs/tags-pins-and-groups#groups">group</Link> with a
          colour and its stops take that colour too.
        </p>
      </DocsSection>

      <DocsSection id="route-problems" title="When a route won’t draw">
        <DocsTable
          caption="Route problems and their fixes"
          head={["What you see", "What to do"]}
          rows={[
            [
              "{name} can’t be a stop",
              "There’s no road near that location. Move its pin closer to a road, or pick a different location.",
            ],
            [
              "Click a location to add a stop",
              "You clicked open ground. Click a pin instead.",
            ],
            [
              "That location is still saving",
              "Wait a second for a new location to finish saving, then click it again.",
            ],
            [
              "No route between those stops",
              "There’s no drivable way between them — an island, say. Move a stop nearer a road and try again.",
            ],
            [
              "Couldn’t work out the route",
              "The routing service was slow or busy. Press Enter again in a moment.",
            ],
            [
              "Routes aren’t included on the free plan",
              <>
                Routes are on Starter and Pro — see{" "}
                <Link href="/docs/plans-and-billing">Plans and billing</Link>.
              </>,
            ],
          ]}
        />
      </DocsSection>
    </DocsArticle>
  );
}
