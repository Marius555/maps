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
          toolbar:
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
          Esc puts a tool away; Backspace removes the last point placed.
        </p>
      </DocsSection>

      <DocsSection id="drawing" title="Drawing a shape">
        <DocsSteps>
          <DocsStep title="Circle">
            <p>
              Press at the centre and drag outwards. The smallest radius is 10
              metres.
            </p>
          </DocsStep>

          <DocsStep title="Polygon">
            <p>
              Click each corner, then the first point again or Enter to close it.
            </p>
          </DocsStep>

          <DocsStep title="Line">
            <p>
              Click each point, then Enter. A point near a location snaps onto it.
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
          Click a shape to select it. On the map, drag a circle’s handles to move
          or resize it; drag a polygon’s points to reshape it, its centre to move
          it, or the handle mid-edge to add a point. Changes save when you let
          go. For its details, press <strong>Edit shape</strong>:
        </p>

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
              "How strongly the inside is filled, 0–100%. Not on lines.",
            ],
          ]}
        />

        <p>
          To delete a shape, choose <strong>Delete</strong> from its menu in the
          list, then <strong>Delete shape</strong>. Visitors see it until you
          publish again.
        </p>

        <p>
          A map holds 3 shapes on Free, 50 on Starter and 250 on Pro, routes
          included. At the limit the drawing tools turn grey.
        </p>
      </DocsSection>

      <DocsSection id="import" title="Importing shapes">
        <DocsSteps>
          <DocsStep title="Choose the file">
            <p>
              Pick <strong>Import shapes</strong>, then{" "}
              <strong>Choose file</strong> or drag in a GeoJSON, TopoJSON or
              ArcGIS JSON file under 5MB. Nothing is saved until you confirm.
            </p>
          </DocsStep>

          <DocsStep title="Check what was found">
            <p>
              The dialog counts the shapes found. If the coordinates could be
              either way round, use <strong>Latitude is written first</strong>.
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
              "Export it again from your GIS tool.",
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
              "Re-export it as WGS84 (EPSG:4326).",
            ],
            [
              "The file is over 5MB",
              "Simplify it in your GIS tool.",
            ],
            [
              "A shape was simplified",
              "Shapes over 500 points are simplified to fit.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="routes" title="Drawing a route">
        <p>
          A route is a driving line between your locations along the roads, with
          its distance and drive time. Starter and Pro only.
        </p>

        <DocsSteps>
          <DocsStep title="Choose Route">
            <p>
              Pick <strong>Route</strong>. Locations no road reaches turn grey and
              can’t be picked.
            </p>
          </DocsStep>

          <DocsStep title="Click the stops in order">
            <p>
              Click the starting location, then each one after it — up to 25
              stops. Only locations can be stops.
            </p>
          </DocsStep>

          <DocsStep title="Press Enter">
            <p>
              The route is drawn along the roads. Its card reads like{" "}
              <strong>Route · 12 km · 19 min</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Routes are a line and a time, not turn-by-turn directions — for those,
          a card’s <strong>Directions</strong> link opens the visitor’s maps app.
        </p>

        <DocsCallout>
          <p>
            Opening the Route tool uses up to one lookup per location on the map,
            from your monthly allowance. See{" "}
            <Link href="/docs/plans-and-billing#lookups">
              What counts as a lookup
            </Link>
            .
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="changing-routes" title="Changing a route">
        <p>
          A route’s stops are listed under it in the Map tab’s sidebar, each with
          a menu: <strong>Move up</strong>,{" "}
          <strong>Move down</strong>, <strong>Make this the start</strong>,{" "}
          <strong>Make this the end</strong> and{" "}
          <strong>Remove from route</strong>.
        </p>

        <p>
          Move a stop’s location and the route keeps its old line until you press{" "}
          <strong>Recalculate</strong>.
        </p>

        <p>
          <strong>Edit shape</strong> sets a route’s <strong>Line style</strong>{" "}
          and <strong>Colour</strong>. In a coloured{" "}
          <Link href="/docs/tags-pins-and-groups#groups">group</Link>, its stops
          take that colour too.
        </p>
      </DocsSection>

      <DocsSection id="route-problems" title="When a route won’t draw">
        <DocsTable
          caption="Route problems and their fixes"
          head={["What you see", "What to do"]}
          rows={[
            [
              "{name} can’t be a stop",
              "No road is near it. Move its pin closer to a road, or pick another location.",
            ],
            [
              "Click a location to add a stop",
              "You clicked open ground. Click a pin instead.",
            ],
            [
              "That location is still saving",
              "Wait a second, then click it again.",
            ],
            [
              "No route between those stops",
              "No drivable way between them — an island, say. Move a stop nearer a road.",
            ],
            [
              "Couldn’t work out the route",
              "The routing service was busy. Press Enter again in a moment.",
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
