import { distanceKm, type Located } from "@/packages/shared/geo";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * The map in the landing page's hero: a picture of a map, with pins on it.
 *
 * **A picture, not a running map.** It used to be the real embed bundle, and it
 * was cut: a live store locator squeezed into a hero brought its search panel,
 * its toolbar and two toggles under it, and read as a busy screenshot of the
 * product rather than as a map. This is the editor's basemap drawn once, off
 * screen, and committed as an image — no MapLibre, no tiles and no WebGL on the
 * landing page. What moves on it (the card, the filters, "nearest to me") is
 * a few hand-picked pieces laid over that picture, and the geometry they need
 * is at the bottom of this file.
 *
 * The basemap and the pins are separate on purpose. The image is only the
 * ground; the pins are the editor's own marker markup laid over it
 * (components/marketing/hero/hero-map/hero-pin-marker.tsx), so they stay sharp at every density
 * and look exactly like the ones on `/maps/[id]`. They line up because the
 * generator (`/dev/hero-map`) and `projectPin` read the one camera below — change
 * it and the images have to be rendered again.
 */

/** Where the picture looks. London, where the demo coffee chain is. */
export const HERO_CAMERA = {
  center: { lng: -0.108, lat: 51.508 },
  zoom: 10.8,
} as const;

/**
 * The picture's size in CSS pixels, at 1×. 2:1 — the frame on the page is
 * wider than it is tall at every width but a phone's, where it is cropped to
 * the middle rather than letterboxed.
 */
export const HERO_SIZE = { width: 1440, height: 720 } as const;

/** Some labels and no POI icons: a map to put pins on, not a guidebook. */
export const HERO_APPEARANCE = {
  labels: "some",
  layers: { poi: false },
} as const;

/**
 * Positron for the light site, Carbon for the dark one.
 *
 * `file` is the stem under `/public/marketing/`; each look ships at 1× and 2×
 * (`<file>.webp`, `<file>@2x.webp`). The paths are written out again in
 * globals.css (`.mk-hero-map__stage`), because a background image set per theme
 * is the only way to have the browser fetch just the one it shows.
 */
export const HERO_LOOKS = [
  { theme: "light", style: "positron", file: "hero-positron" },
  { theme: "dark", style: "carbon", file: "hero-carbon" },
] as const;

export const HERO_PIXEL_RATIOS = [1, 2] as const;

export type HeroPinKind = "cafe" | "pickup" | "flagship";

export type HeroPin = {
  name: string;
  lng: number;
  lat: number;
  kind: HeroPinKind;
  /** What the pin's card says under its name. */
  street: string;
};

/** The demo's tag colours: a café, a pickup point, a roastery. */
export const HERO_PIN_COLORS: Record<HeroPinKind, string> = {
  cafe: "#7048e8",
  pickup: "#1c7ed6",
  flagship: "#f54600",
};

/**
 * The two custom pins the demo map carries, as the editor stores them. Cafés
 * have none and are drawn as the plain ball.
 */
export const HERO_PIN_ICONS: readonly CustomPinIcon[] = [
  {
    id: "flagship",
    label: "Roastery",
    color: HERO_PIN_COLORS.flagship,
    glyph: "landmark",
    image: "",
    size: "lg",
  },
  {
    id: "pickup",
    label: "Pickup point",
    color: HERO_PIN_COLORS.pickup,
    glyph: "store",
    image: "",
  },
];

/**
 * A coffee chain's London shops, each at a real street address — so no pin
 * lands in the Thames. Scattered on purpose: the city centre is left sparse
 * enough that the basemap under it still reads.
 */
export const HERO_PINS: readonly HeroPin[] = [
  { name: "Shoreditch", lng: -0.0827, lat: 51.52787, kind: "flagship", street: "Shoreditch High Street" },
  { name: "Soho", lng: -0.13354, lat: 51.51006, kind: "cafe", street: "Old Compton Street" },
  { name: "Clerkenwell", lng: -0.10163, lat: 51.52099, kind: "cafe", street: "Exmouth Market" },
  { name: "Borough", lng: -0.08749, lat: 51.50413, kind: "cafe", street: "Borough High Street" },
  { name: "Bermondsey", lng: -0.05886, lat: 51.49901, kind: "pickup", street: "Bermondsey Street" },
  { name: "Peckham", lng: -0.07325, lat: 51.47032, kind: "cafe", street: "Rye Lane" },
  { name: "Brixton", lng: -0.12033, lat: 51.46063, kind: "cafe", street: "Atlantic Road" },
  { name: "Clapham", lng: -0.13812, lat: 51.46232, kind: "flagship", street: "Clapham High Street" },
  { name: "Battersea", lng: -0.16083, lat: 51.47377, kind: "cafe", street: "Battersea Park Road" },
  { name: "Chelsea", lng: -0.1638, lat: 51.48957, kind: "pickup", street: "King's Road" },
  { name: "South Kensington", lng: -0.17905, lat: 51.49143, kind: "cafe", street: "Old Brompton Road" },
  { name: "Notting Hill", lng: -0.20001, lat: 51.51296, kind: "cafe", street: "Portobello Road" },
  { name: "Paddington", lng: -0.17603, lat: 51.51753, kind: "cafe", street: "Praed Street" },
  { name: "Fitzrovia", lng: -0.13888, lat: 51.52342, kind: "pickup", street: "Charlotte Street" },
  { name: "Bloomsbury", lng: -0.12613, lat: 51.52247, kind: "flagship", street: "Lamb's Conduit Street" },
  { name: "Islington", lng: -0.09766, lat: 51.53658, kind: "cafe", street: "Upper Street" },
  { name: "Dalston", lng: -0.0785, lat: 51.54808, kind: "cafe", street: "Kingsland High Street" },
  { name: "Hackney", lng: -0.05331, lat: 51.54545, kind: "pickup", street: "Mare Street" },
  { name: "Bethnal Green", lng: -0.06044, lat: 51.52829, kind: "cafe", street: "Roman Road" },
  { name: "Canary Wharf", lng: -0.02001, lat: 51.50209, kind: "cafe", street: "Canada Square" },
  { name: "Greenwich", lng: -0.00852, lat: 51.47964, kind: "flagship", street: "Greenwich Church Street" },
  { name: "Deptford", lng: -0.02739, lat: 51.47896, kind: "pickup", street: "Deptford High Street" },
  { name: "Camden", lng: -0.138, lat: 51.535, kind: "cafe", street: "Camden High Street" },
  { name: "Kentish Town", lng: -0.14118, lat: 51.5473, kind: "cafe", street: "Kentish Town Road" },
  { name: "Highbury", lng: -0.09606, lat: 51.55136, kind: "cafe", street: "Highbury Park" },
  { name: "Stoke Newington", lng: -0.07878, lat: 51.56588, kind: "cafe", street: "Church Street" },
  { name: "Hampstead", lng: -0.17485, lat: 51.55779, kind: "pickup", street: "Hampstead High Street" },
  { name: "Shepherds Bush", lng: -0.23072, lat: 51.50434, kind: "flagship", street: "Uxbridge Road" },
  { name: "Hammersmith", lng: -0.22899, lat: 51.4896, kind: "cafe", street: "King Street" },
  { name: "Fulham", lng: -0.19222, lat: 51.47961, kind: "cafe", street: "Fulham Road" },
  { name: "Putney", lng: -0.21833, lat: 51.46485, kind: "pickup", street: "Putney High Street" },
  { name: "Wandsworth", lng: -0.19449, lat: 51.46036, kind: "cafe", street: "Garratt Lane" },
  { name: "Balham", lng: -0.14679, lat: 51.44276, kind: "cafe", street: "Balham High Road" },
  { name: "Dulwich", lng: -0.08876, lat: 51.44715, kind: "cafe", street: "Lordship Lane" },
  { name: "Lewisham", lng: -0.0118, lat: 51.46277, kind: "cafe", street: "Lewisham High Street" },
  { name: "Stratford", lng: 0.0003, lat: 51.54062, kind: "cafe", street: "The Broadway" },
  { name: "Southbank", lng: -0.11927, lat: 51.50427, kind: "pickup", street: "Upper Ground" },
  { name: "Victoria", lng: -0.1391, lat: 51.49314, kind: "cafe", street: "Wilton Road" },
];

/**
 * MapLibre's world is 512 pixels wide at zoom 0 — its tiles are 512px, not the
 * 256 of the older raster convention — so this is the number that makes a zoom
 * here mean the same as the zoom the picture was rendered at.
 */
const WORLD_SIZE_AT_Z0 = 512;

function worldPixels(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const size = WORLD_SIZE_AT_Z0 * 2 ** zoom;
  const phi = (lat * Math.PI) / 180;

  return {
    x: ((lng + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * size,
  };
}

/**
 * Where a point sits on the picture, as a percentage of its width and height.
 *
 * Web Mercator, which is what MapLibre draws, so a pin placed by this is on
 * the same street it is on in the image. Percentages rather than pixels because
 * the picture is scaled to its frame; the pins scale their positions with it
 * and keep their own size.
 */
export function projectPin(
  point: { lng: number; lat: number },
  camera: { center: { lng: number; lat: number }; zoom: number } = HERO_CAMERA,
  size: { width: number; height: number } = HERO_SIZE,
): { x: number; y: number } {
  const centre = worldPixels(camera.center.lng, camera.center.lat, camera.zoom);
  const at = worldPixels(point.lng, point.lat, camera.zoom);

  return {
    x: 50 + ((at.x - centre.x) / size.width) * 100,
    y: 50 + ((at.y - centre.y) / size.height) * 100,
  };
}

/*
 * ---------------------------------------------------------------------------
 * The live layer: what the hero's card, filters and "nearest to me" need.
 * ---------------------------------------------------------------------------
 */

/** How a card names each kind of location, and when it says the place closes. */
export const HERO_KINDS: Record<
  HeroPinKind,
  { one: string; many: string; closes: string }
> = {
  cafe: { one: "Café", many: "Cafés", closes: "18:00" },
  pickup: { one: "Pickup point", many: "Pickup points", closes: "20:00" },
  flagship: { one: "Roastery", many: "Roasteries", closes: "17:00" },
};

/** The order the filter chips offer the kinds in. */
export const HERO_KIND_ORDER: readonly HeroPinKind[] = ["cafe", "pickup", "flagship"];

export type HeroFilter = "all" | HeroPinKind;

export function matchesFilter(pin: HeroPin, filter: HeroFilter): boolean {
  return filter === "all" || pin.kind === filter;
}

/**
 * The pins the card walks between while nobody is touching the map.
 *
 * Every one of them sits between 32% and 68% across the picture. A phone crops
 * the picture to its middle — a 350px frame shows only the centre half of it —
 * and a tour stop outside that band would open a card on a pin nobody can see.
 * The order hops across the map rather than along it, so each move reads as a
 * move. Mixed kinds, so the tour shows the three pins as well as the card.
 */
export const HERO_TOUR: readonly string[] = [
  "Shoreditch",
  "Victoria",
  "Bermondsey",
  "Soho",
  "Borough",
  "Bloomsbury",
];

/**
 * Where "Nearest to me" says the visitor is: Kennington, south of the river and
 * clear of every pin. A fixed point, never the browser's geolocation — this is a
 * picture of the feature, and asking a stranger for their position to decorate a
 * landing page is exactly the kind of prompt people learn to refuse.
 */
export const HERO_YOU_ARE_HERE: Located = { lng: -0.1115, lat: 51.4886 };

export type FrameSize = { width: number; height: number };
export type FramePoint = { x: number; y: number };

/**
 * The picture's box inside the frame, in the frame's pixels.
 *
 * `.mk-hero-map__stage` in globals.css, in numbers: the picture keeps its own
 * aspect ratio and grows until it covers the frame, then sits centred — which is
 * `object-fit: cover`. The CSS is what the visitor sees; this has to agree with
 * it, or everything drawn in pixels lands off its pin.
 */
export function stageBox(
  frame: FrameSize,
  size: FrameSize = HERO_SIZE,
): { left: number; top: number; width: number; height: number } {
  const ratio = size.width / size.height;
  const width = Math.max(frame.width, frame.height * ratio);
  const height = Math.max(frame.height, frame.width / ratio);

  return {
    left: (frame.width - width) / 2,
    top: (frame.height - height) / 2,
    width,
    height,
  };
}

/** A point on the picture (percentages, as `projectPin` returns) in frame pixels. */
export function pinInFrame(point: FramePoint, frame: FrameSize): FramePoint {
  const stage = stageBox(frame);

  return {
    x: stage.left + (point.x / 100) * stage.width,
    y: stage.top + (point.y / 100) * stage.height,
  };
}

/** How far a card sits from its pin — the editor anchors a real card at 22px. */
export const CARD_GAP = 22;

export type CardInsets = { top: number; right: number; bottom: number; left: number };

export type CardPlacement = FramePoint & {
  side: "right" | "left" | "below" | "above";
};

/**
 * Where a card goes: beside its pin, and never off the frame.
 *
 * Right of the pin and centred on it first, which is where the editor opens a
 * card. Left when the right would run off the frame. On a frame too narrow for
 * either — a phone, with the pin anywhere near the middle — below the pin, or
 * above it when below does not fit. The pin itself is never covered: whichever
 * side wins, the card starts `CARD_GAP` away from it on that side.
 *
 * `prefer: "left"` tries the left first. "Nearest to me" asks for it when the
 * visitor's dot is to the right of the pin: a card on the default side would sit
 * squarely on the dot and the line to it, which are the whole of what that
 * feature has to show.
 *
 * `insets` keep the card off the controls laid over the frame's edges.
 */
export function placeCard(
  anchor: FramePoint,
  card: FrameSize,
  frame: FrameSize,
  insets: CardInsets,
  prefer: "right" | "left" = "right",
): CardPlacement {
  const minX = insets.left;
  const maxX = frame.width - insets.right - card.width;
  const minY = insets.top;
  const maxY = frame.height - insets.bottom - card.height;
  const besideY = clamp(anchor.y - card.height / 2, minY, maxY);

  const right: CardPlacement | null =
    anchor.x + CARD_GAP <= maxX ? { x: anchor.x + CARD_GAP, y: besideY, side: "right" } : null;
  const left: CardPlacement | null =
    anchor.x - CARD_GAP - card.width >= minX
      ? { x: anchor.x - CARD_GAP - card.width, y: besideY, side: "left" }
      : null;

  const beside = prefer === "left" ? (left ?? right) : (right ?? left);
  if (beside) return beside;

  const x = clamp(anchor.x - card.width / 2, minX, maxX);

  if (anchor.y + CARD_GAP <= maxY) {
    return { x, y: anchor.y + CARD_GAP, side: "below" };
  }

  return { x, y: clamp(anchor.y - CARD_GAP - card.height, minY, maxY), side: "above" };
}

/**
 * The closest of `pins` to `from`, and how far it is — the embed's "nearest to
 * me", on the same great-circle distance (packages/shared/geo.ts).
 */
export function nearestPin<T extends Located>(
  from: Located,
  pins: readonly T[],
): { pin: T; km: number } | null {
  let best: { pin: T; km: number } | null = null;

  for (const pin of pins) {
    const km = distanceKm(from, pin);
    if (!best || km < best.km) best = { pin, km };
  }

  return best;
}

/**
 * Each pin's place in the landing order: nearest the centre first, so the pins
 * arrive as one wave spreading outwards rather than in the list's order, which
 * is alphabetical by nothing and reads as noise.
 */
export function dropRanks(
  pins: readonly Located[],
  centre: Located = HERO_CAMERA.center,
): number[] {
  const order = pins
    .map((pin, index) => ({ index, km: distanceKm(centre, pin) }))
    .sort((a, b) => a.km - b.km);

  const ranks = new Array<number>(pins.length);
  order.forEach(({ index }, rank) => {
    ranks[index] = rank;
  });

  return ranks;
}

/** `min` wins when the range is empty — a frame smaller than the card. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
