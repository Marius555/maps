"use client";

import { Button } from "@heroui/react";
import { useCallback, useState } from "react";

import {
  HERO_PINS,
  HERO_SIZE,
  HERO_YOU_ARE_HERE,
  projectPin,
} from "@/lib/marketing/hero-map";

import { HeroPinMarker, heroPinPosition } from "../hero-map/hero-pin-marker";

/** What the generated module looks like, read back just far enough to draw it. */
type Generated = {
  source: string;
  url: string;
  routes: { to: string; points: [number, number][]; distanceM: number }[];
};

/**
 * Renders `lib/marketing/hero-routes.data.ts`, to be saved over the committed one.
 *
 * The hero's "Nearest to me" draws a real road route from a file rather than
 * from a request (CLAUDE.md §2, and lib/marketing/hero-routes.ts for why). This
 * is the button that makes that file: it asks `/dev/hero-routes` for it and
 * draws every route it got back over the hero's own picture, at the hero's own
 * camera — so a route that runs through the Thames is visible here rather than
 * on the landing page.
 */
export function HeroRouteGenerator() {
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const generate = useCallback(async () => {
    setPending(true);
    setError(null);
    setGenerated(null);

    try {
      const response = await fetch("/dev/hero-routes");
      const source = await response.text();

      if (!response.ok) throw new Error(source || `HTTP ${response.status}`);

      setGenerated({
        source,
        url: URL.createObjectURL(new Blob([source], { type: "text/plain" })),
        routes: readRoutes(source),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, []);

  const you = projectPin(HERO_YOU_ARE_HERE);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-foreground">Hero map routes</h2>
        <p className="text-sm text-muted">
          Asks the configured routing engine for the way from “you are here” to
          every pin “Nearest to me” can land on. Save the download over{" "}
          <code>lib/marketing/hero-routes.data.ts</code>.
        </p>
        <Button onPress={generate} isPending={pending}>
          Generate routes
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      {generated ? (
        <figure className="space-y-2">
          <figcaption className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-mono text-foreground">hero-routes.data.ts</span>
            <span className="text-muted">
              {generated.routes
                .map((route) => `${route.to} ${(route.distanceM / 1000).toFixed(1)} km`)
                .join(" · ")}
            </span>
            <a
              className="text-accent underline"
              href={generated.url}
              download="hero-routes.data.ts"
            >
              Download
            </a>
          </figcaption>

          <div
            className="relative w-full overflow-hidden rounded-xl border border-border bg-surface-secondary"
            style={{ aspectRatio: `${HERO_SIZE.width} / ${HERO_SIZE.height}` }}
          >
            <div
              className="absolute inset-0"
              style={{ backgroundImage: "url(/marketing/hero-positron.webp)", backgroundSize: "100% 100%" }}
            />

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {generated.routes.map((route) => (
                <path
                  key={route.to}
                  d={route.points
                    .map(([lng, lat], index) => {
                      const at = projectPin({ lng, lat });
                      return `${index === 0 ? "M" : "L"}${at.x} ${at.y}`;
                    })
                    .join("")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {HERO_PINS.map((pin) => (
              <span key={pin.name} className="mk-hero-pin" style={heroPinPosition(pin)}>
                <HeroPinMarker pin={pin} />
              </span>
            ))}

            <span
              className="mk-hero-you"
              style={{ left: `${you.x}%`, top: `${you.y}%` }}
            >
              <span className="mk-hero-you__dot" />
            </span>
          </div>
        </figure>
      ) : null}
    </section>
  );
}

/**
 * The routes out of the generated module, for the preview only.
 *
 * The module is TypeScript, and this page cannot import a file it has just been
 * handed as text — so the arrays are read out of the source, one entry at a
 * time. It is a preview: if the shape ever changes and this stops finding
 * anything, the download is still the thing that matters.
 */
function readRoutes(source: string): Generated["routes"] {
  const routes: Generated["routes"] = [];

  // Each entry starts at a key on its own line: `  "Southbank": {`.
  for (const chunk of source.split(/\n {2}"/).slice(1)) {
    const to = /^([^"]+)"/.exec(chunk)?.[1];
    const distance = /distanceM: (\d+)/.exec(chunk)?.[1];
    const points: [number, number][] = [];

    for (const [, lng, lat] of chunk.matchAll(/\[(-?[\d.]+), (-?[\d.]+)\]/g)) {
      points.push([Number(lng), Number(lat)]);
    }

    if (to && points.length > 0) {
      routes.push({ to, distanceM: Number(distance ?? 0), points });
    }
  }

  return routes;
}
