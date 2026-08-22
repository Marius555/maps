"use client";

import { Switch } from "@heroui/react";

import { ShapeIcon } from "@/components/shapes/shape-icon";
import { formatCount } from "@/lib/format/number";
import type { ShapeImport, SkipReason } from "@/lib/import/shapes";
import { shapeSummary } from "@/lib/map/shape-summary";
import { MAX_POLYGON_POINTS } from "@/lib/validation/shape.schema";

/**
 * What we found in the file, before anything is saved.
 *
 * A review step rather than a count, for the reason the locations import has
 * one: a file that parsed is not the same as a file that parsed *correctly*, and
 * the moment to notice thirteen features named "Unnamed feature" is before they
 * are rows on a map. Every row shows the name it will be saved under and what it
 * actually is, both from the same functions the sidebar uses.
 *
 * The notes underneath are the things we changed on the way in. They are stated
 * plainly rather than hidden, because each one is a small loss or a small guess
 * the user would otherwise discover later and have no explanation for: a boundary
 * with fewer corners than the file had, a lake that filled in, a feature that
 * vanished, a ring that turned out to be a circle.
 *
 * One of them is not a note but a control. When the file gave no way to tell
 * longitude from latitude, saying so and offering the switch is the only honest
 * thing to do — the same move the locations import makes when it cannot name a
 * column and asks instead of guessing quietly.
 */
export function ImportPreview({
  parsed,
  headroom,
  onSwapAxis,
}: {
  parsed: ShapeImport;
  /**
   * How many more shapes the plan allows. Negative is impossible; zero means the
   * map is full.
   */
  headroom: number;
  /** Re-reads the file the other way round. Only offered when it is a question. */
  onSwapAxis: (latitudeFirst: boolean) => void;
}) {
  const { shapes, skipped, holesDropped, circlesDetected } = parsed;
  const simplified = shapes.filter((shape) => shape.simplifiedFrom !== null);
  const described = shapes.filter((shape) => shape.description !== undefined);
  const overflows = shapes.length > headroom;

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        Found {formatCount(shapes.length)}{" "}
        {shapes.length === 1 ? "shape" : "shapes"}
        {parsed.dialect === "loose" ? "" : ` in ${DIALECTS[parsed.dialect]}`}.
      </p>

      {/* Capped and scrolled: a provinces file is thirteen rows, but a
          municipality file is six hundred, and a dialog that grows to fit them
          is a dialog with its button off the bottom of the screen. */}
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {shapes.map((shape, index) => (
          <li
            // The parser gives no ids and names repeat freely in real files, so
            // position is the only honest key. The list is never reordered.
            key={`${shape.name}-${index}`}
            className="flex items-center gap-2.5 px-3 py-2"
          >
            <ShapeIcon geometry={shape.geometry} color={shape.color} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {shape.name}
              </span>
              <span className="block text-xs text-muted">
                {shapeSummary(shape.geometry)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {parsed.axisAmbiguous ? (
        <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
          <Switch
            isSelected={parsed.axis === "latlng"}
            onChange={(isSelected) => onSwapAxis(isSelected)}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="text-sm">Latitude is written first</span>
            </Switch.Content>
          </Switch>

          <p className="mt-1.5 text-xs text-muted">
            Every coordinate in this file is between -90 and 90, so both readings
            are possible and we took the usual one. If the shapes land in the
            wrong place, switch this and look again.
          </p>
        </div>
      ) : null}

      <div className="space-y-1 text-xs text-muted">
        {circlesDetected > 0 ? (
          <p>
            {formatCount(circlesDetected)}{" "}
            {circlesDetected === 1 ? "shape was" : "shapes were"} drawn as a ring
            of points but{" "}
            {circlesDetected === 1 ? "is a circle" : "are circles"} — saved as one,
            so you can drag the radius.
          </p>
        ) : null}

        {parsed.unprojected ? (
          <p>
            The coordinates were in Web Mercator metres and have been converted to
            latitude and longitude.
          </p>
        ) : null}

        {parsed.styled > 0 ? (
          <p>
            {formatCount(parsed.styled)}{" "}
            {parsed.styled === 1 ? "shape kept its own" : "shapes kept their own"}{" "}
            colour from the file. The rest were given one from our palette so
            they can be told apart.
          </p>
        ) : null}

        {described.length > 0 ? (
          <p>
            {formatCount(described.length)}{" "}
            {described.length === 1 ? "shape brought" : "shapes brought"} a
            description with it.
          </p>
        ) : null}

        {simplified.length > 0 ? (
          <p>
            {formatCount(simplified.length)}{" "}
            {simplified.length === 1 ? "shape was" : "shapes were"} simplified to
            fit — the largest went from{" "}
            {formatCount(
              Math.max(...simplified.map((shape) => shape.simplifiedFrom ?? 0)),
            )}{" "}
            points to {formatCount(MAX_POLYGON_POINTS)}. Detail finer than a few
            metres was dropped.
          </p>
        ) : null}

        {holesDropped > 0 ? (
          <p>
            {formatCount(holesDropped)}{" "}
            {holesDropped === 1 ? "shape has" : "shapes have"} holes, which
            we can&rsquo;t draw yet — {holesDropped === 1 ? "it" : "they"} will
            be filled in.
          </p>
        ) : null}

        {/* Split by reason rather than counted together: a point that is really
            a location and a ring with two corners in it are different mistakes,
            and one sentence covering both explains neither. */}
        {SKIP_ORDER.map((reason) => {
          const count = skipped.filter((entry) => entry.reason === reason).length;
          if (count === 0) return null;

          return (
            <p key={reason}>{SKIP_COPY[reason](count)}</p>
          );
        })}
      </div>

      {/* The plan check, said before the button rather than after it. Server-side
          enforcement still refuses the batch (§6), but a limit you only meet by
          pressing the button is a limit that reads as a bug. */}
      {overflows ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {headroom === 0
            ? "Your plan's shape limit is already reached on this map. Upgrade, or delete some shapes first."
            : `Only ${formatCount(headroom)} more ${headroom === 1 ? "shape fits" : "shapes fit"} on your plan. Upgrade, or import a smaller file.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * What the file turned out to be, named only when it is worth saying.
 *
 * A plain GeoJSON is what everyone expects and needs no announcement; the other
 * two are worth confirming, because a file that used to import as nothing now
 * imports, and knowing which reader ran is the first thing to check if a shape
 * comes out wrong.
 */
const DIALECTS: Record<string, string> = {
  geojson: "GeoJSON",
  topojson: "TopoJSON",
  esri: "ArcGIS JSON",
};

const SKIP_ORDER: SkipReason[] = ["location", "radius", "too-few-points"];

const SKIP_COPY: Record<SkipReason, (count: number) => string> = {
  location: (count) =>
    `${formatCount(count)} ${count === 1 ? "feature is a point" : "features are points"} with no radius. ` +
    "Points are locations — import them from the Locations tab.",
  radius: (count) =>
    `${formatCount(count)} ${count === 1 ? "circle has a radius" : "circles have a radius"} we can't draw — ` +
    "under 10m or past the size of the planet — and will be left out.",
  "too-few-points": (count) =>
    `${formatCount(count)} ${count === 1 ? "feature had" : "features had"} too few corners to draw, ` +
    "and will be left out.",
};
