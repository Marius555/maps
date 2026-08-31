import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attributionFor,
  BASEMAP_SOURCES as SCRIPT_SOURCES,
  fontStacks,
  OPENFREEMAP,
  OPENFREEMAP_ATTRIBUTION,
  remainingUpstream,
  retargetStyle,
  sourceOfStyleUrl,
  styleFile,
  styleUrlFor,
  TILE_ATTRIBUTION,
} from "@/scripts/tile-style.mjs";

import {
  BASEMAP_SOURCES,
  OPENFREEMAP_CREDIT,
  SELF_HOSTED_CREDIT,
  STYLE_URLS,
} from "./style";

/**
 * The seam between the app and the build scripts.
 *
 * `scripts/tile-style.mjs` is plain ESM because a `.mjs` script cannot import
 * TypeScript, and it holds three things the app also knows: the list of basemaps,
 * the URL a style is served from, and the credit written onto the vector source.
 * Nothing in the type system connects the two sides. This file is the connection,
 * and every failure it prevents is silent in production:
 *
 * - a basemap missing from the script is a style nobody generates, so choosing it
 *   renders nothing;
 * - a URL shape that drifts republishes every customer map at a 404;
 * - an attribution that drifts is an OpenStreetMap credit that quietly stops
 *   saying what §12 requires it to say.
 *
 * The same argument packages/shared/gazetteer.ts makes about `fold`, except that
 * here the shared code really is shared — only the constants are duplicated.
 */

/** Shaped like the real documents: two sources, one of them raster. */
function upstreamStyle() {
  return {
    version: 8,
    glyphs: `${OPENFREEMAP}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${OPENFREEMAP}/sprites/ofm_f384/ofm`,
    sources: {
      ne2_shaded: {
        type: "raster",
        tiles: [`${OPENFREEMAP}/natural_earth/ne2sr/{z}/{x}/{y}.png`],
        maxzoom: 6,
        tileSize: 256,
      },
      openmaptiles: { type: "vector", url: `${OPENFREEMAP}/planet` },
    },
    layers: [
      { id: "background", type: "background" },
      {
        id: "place-city",
        type: "symbol",
        "source-layer": "place",
        layout: { "text-font": ["Noto Sans Regular"], "text-field": ["get", "name"] },
      },
      {
        id: "poi",
        type: "symbol",
        "source-layer": "poi",
        layout: { "text-font": ["Noto Sans Italic", "Noto Sans Bold"] },
      },
    ],
  };
}

type StyleDoc = {
  glyphs: string;
  sprite: string;
  sources: Record<string, Record<string, unknown>>;
};

const BASE = "https://tiles.example.com";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the script's constants against the app's", () => {
  it("knows the same five basemaps", () => {
    expect([...SCRIPT_SOURCES].sort()).toEqual([...BASEMAP_SOURCES].sort());
  });

  it("writes the credit the app expects, for either host", () => {
    expect(TILE_ATTRIBUTION).toBe(SELF_HOSTED_CREDIT.html);
    expect(OPENFREEMAP_ATTRIBUTION).toBe(OPENFREEMAP_CREDIT.html);

    expect(attributionFor(BASE)).toBe(SELF_HOSTED_CREDIT.html);
    expect(attributionFor("")).toBe(OPENFREEMAP_CREDIT.html);
  });

  it("builds the URL the app builds, on the current host", () => {
    for (const source of BASEMAP_SOURCES) {
      expect(styleUrlFor(source, "")).toBe(STYLE_URLS[source]);
    }
  });

  /**
   * The canary for "this change moved nothing".
   *
   * Deriving these URLs from a variable was meant to leave today's behaviour
   * exactly as it was, and the assertion above only proves the app and the script
   * agree — they could agree on something new. Spelled out in full, once, so a
   * default that quietly drifts fails here rather than on a customer's site.
   */
  it("still serves the URLs it always did when the host is unset", () => {
    expect(STYLE_URLS).toEqual({
      liberty: "https://tiles.openfreemap.org/styles/liberty",
      bright: "https://tiles.openfreemap.org/styles/bright",
      positron: "https://tiles.openfreemap.org/styles/positron",
      dark: "https://tiles.openfreemap.org/styles/dark",
      fiord: "https://tiles.openfreemap.org/styles/fiord",
    });
  });

  /**
   * The other half of that, which no other test can reach: with the variable set,
   * the app's URLs have to be the ones the build script writes files for. Loaded
   * through a fresh module registry because `style.ts` reads the environment once,
   * at import.
   */
  it("builds the URL the app builds once the host is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_TILES_URL", BASE);
    vi.resetModules();

    const hosted = await import("./style");

    expect(hosted.SELF_HOSTED_TILES).toBe(true);

    for (const source of BASEMAP_SOURCES) {
      expect(hosted.STYLE_URLS[source]).toBe(styleUrlFor(source, BASE));
      expect(hosted.STYLE_URLS[source]).toBe(`${BASE}/${styleFile(source)}`);
    }
  });

  it("switches the credit with the host, in both directions", async () => {
    expect((await import("./style")).SELF_HOSTED_TILES).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_TILES_URL", BASE);
    vi.resetModules();

    const hosted = await import("./style");

    expect(hosted.ATTRIBUTION_HTML).toBe(SELF_HOSTED_CREDIT.html);
    expect(hosted.ATTRIBUTION_TEXT).toBe(SELF_HOSTED_CREDIT.text);
    // Whoever serves the tiles, this name never leaves (§12).
    expect(hosted.ATTRIBUTION_TEXT).toContain("OpenStreetMap");
  });

  it("tolerates a trailing slash, which a pasted URL usually has", async () => {
    vi.stubEnv("NEXT_PUBLIC_TILES_URL", `${BASE}/`);
    vi.resetModules();

    const hosted = await import("./style");

    expect(hosted.STYLE_URLS.liberty).toBe(`${BASE}/styles/liberty.json`);
    expect(styleUrlFor("liberty", `${BASE}/`)).toBe(hosted.STYLE_URLS.liberty);
  });
});

/**
 * What scripts/migrate-style-host.mjs stands on.
 *
 * It reads the basemap out of a published snapshot's own `styleUrl` rather than
 * matching against a table of old URLs, which is the only reason it can run in
 * both directions and roll a switch back. If this round trip breaks, the
 * migration stops recognising live snapshots and silently leaves every one of
 * them on the old host — reporting success while doing nothing.
 */
describe("sourceOfStyleUrl", () => {
  it("round-trips every basemap on every host", () => {
    for (const base of ["", BASE, `${BASE}/`, "https://cdn.example.org/map-tiles"]) {
      for (const source of BASEMAP_SOURCES) {
        expect(sourceOfStyleUrl(styleUrlFor(source, base))).toBe(source);
      }
    }
  });

  it("reads what is already published today", () => {
    expect(sourceOfStyleUrl("https://tiles.openfreemap.org/styles/liberty")).toBe(
      "liberty",
    );
  });

  /**
   * Null rather than a guess. A snapshot is live on somebody else's website, so a
   * URL we do not recognise gets reported and left alone.
   */
  it("refuses anything it does not recognise", () => {
    expect(sourceOfStyleUrl("https://tiles.example.com/styles/satellite.json")).toBe(
      null,
    );
    expect(sourceOfStyleUrl("https://example.com/whatever")).toBe(null);
    expect(sourceOfStyleUrl("")).toBe(null);
    expect(sourceOfStyleUrl(undefined)).toBe(null);
  });
});

describe("retargetStyle", () => {
  it("moves the assets that only change origin", () => {
    const out = retargetStyle(upstreamStyle(), BASE) as StyleDoc;

    expect(out.glyphs).toBe(`${BASE}/fonts/{fontstack}/{range}.pbf`);
    expect(out.sprite).toBe(`${BASE}/sprites/ofm_f384/ofm`);
    expect(out.sources.ne2_shaded.tiles).toEqual([
      `${BASE}/natural_earth/ne2sr/{z}/{x}/{y}.png`,
    ]);
  });

  it("keeps the path, because the mirror writes to that same path", () => {
    // The one convention scripts/mirror-tile-assets.mjs and this transform share.
    // If either invents a layout of its own, every asset 404s.
    const out = retargetStyle(upstreamStyle(), BASE) as StyleDoc;

    expect(out.sprite.slice(BASE.length)).toBe("/sprites/ofm_f384/ofm");
  });

  it("turns the vector source into one archive and credits it", () => {
    const out = retargetStyle(upstreamStyle(), BASE) as StyleDoc;
    const source = out.sources.openmaptiles;

    expect(source.url).toBe(`pmtiles://${BASE}/planet.pmtiles`);
    expect(source.attribution).toBe(TILE_ATTRIBUTION);
    expect(source.type).toBe("vector");
  });

  /**
   * The style spec treats a source's `url` and `tiles` as alternatives. A stale
   * `tiles` left beside the new `url` is a style that half-loads from an origin
   * that no longer serves it — which is the failure this whole change removes.
   */
  it("drops a tiles array left on the vector source", () => {
    const style = upstreamStyle();
    style.sources.openmaptiles = {
      type: "vector",
      tiles: [`${OPENFREEMAP}/planet/{z}/{x}/{y}.pbf`],
    } as never;

    const out = retargetStyle(style, BASE) as StyleDoc;

    expect(out.sources.openmaptiles.tiles).toBeUndefined();
    expect(out.sources.openmaptiles.url).toBe(`pmtiles://${BASE}/planet.pmtiles`);
  });

  it("leaves the upstream document alone", () => {
    const style = upstreamStyle();
    retargetStyle(style, BASE);

    expect(style.glyphs).toContain(OPENFREEMAP);
    expect(style.sources.openmaptiles.url).toBe(`${OPENFREEMAP}/planet`);
  });

  it("tolerates a trailing slash on the base", () => {
    const out = retargetStyle(upstreamStyle(), `${BASE}/`) as StyleDoc;

    expect(out.glyphs).toBe(`${BASE}/fonts/{fontstack}/{range}.pbf`);
    expect(out.sources.openmaptiles.url).toBe(`pmtiles://${BASE}/planet.pmtiles`);
  });
});

describe("remainingUpstream", () => {
  it("finds nothing in a fully retargeted style", () => {
    expect(remainingUpstream(retargetStyle(upstreamStyle(), BASE))).toEqual([]);
  });

  /**
   * The guard for what has not happened yet: upstream adding an asset class the
   * transform has never seen. Missing one produces a map that works until somebody
   * else's server does not, so the build fails instead of shipping it.
   */
  it("catches an asset class the transform does not know about", () => {
    const style = upstreamStyle() as Record<string, unknown>;
    style.terrain = { source: `${OPENFREEMAP}/terrain` };

    const left = remainingUpstream(retargetStyle(style, BASE));

    expect(left).toEqual([`${OPENFREEMAP}/terrain`]);
  });

  it("reports every string, not just the first", () => {
    expect(remainingUpstream(upstreamStyle()).length).toBeGreaterThan(2);
  });
});

describe("fontStacks", () => {
  it("reads the stacks the layers actually name", () => {
    expect(fontStacks(upstreamStyle()).sort()).toEqual([
      "Noto Sans Bold",
      "Noto Sans Italic",
      "Noto Sans Regular",
    ]);
  });

  it("reaches into a data-driven text-font", () => {
    const style = upstreamStyle();
    style.layers.push({
      id: "expressive",
      type: "symbol",
      "source-layer": "place",
      layout: { "text-font": ["literal", ["Noto Sans Medium"]] },
    } as never);

    expect(fontStacks(style)).toContain("Noto Sans Medium");
  });

  it("finds nothing in a style with no labels", () => {
    expect(fontStacks({ layers: [{ id: "background", type: "background" }] })).toEqual(
      [],
    );
  });
});
