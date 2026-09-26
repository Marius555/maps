import { METERED_USD_PER_1000 } from "@/lib/marketing/cost";

import { Section } from "../section";
import { SplitBody } from "../split/split-body";
import { NoGoogleArt } from "./no-google-art";
import {
  NoKeySymbol,
  NoMeterSymbol,
  NoTrackingSymbol,
  OwnDataSymbol,
} from "./no-google-symbols";

/**
 * Nothing from Google loads with a published map.
 *
 * **Scoped to the visitor's map, and it has to stay scoped.** The dashboard
 * offers Google sign-in and imports from Google Sheets, and a card's
 * directions link can open Google Maps when a visitor presses it. None of that
 * is in the map a stranger loads: the embed fetches our script, the map's
 * snapshot and OpenFreeMap's tiles, and nothing else (CLAUDE.md §2). So every
 * line here is about that map and nothing wider.
 *
 * Google is named because it is the vendor whose terms and meter this product
 * exists to avoid (§12). The page's other rule — no *rival* is named — still
 * holds: those are store-locator products, and they stay categories.
 */
const POINTS = [
  {
    symbol: <NoKeySymbol />,
    title: "No API key to set up or leak",
    body: "No Google Cloud account, no billing card on file, no key restrictions to get wrong.",
  },
  {
    symbol: <NoMeterSymbol />,
    title: "No per-load bill",
    // lib/marketing/cost.ts has the source for the figure.
    body: `A Google map is billed by the load — about $${METERED_USD_PER_1000} per 1,000 past the free allowance. Yours is never billed per load.`,
  },
  {
    symbol: <NoTrackingSymbol />,
    title: "Your visitors aren't Google's data",
    body: "No Google script or cookie arrives with the map, so it adds nothing Google-shaped to your consent banner.",
  },
  {
    symbol: <OwnDataSymbol />,
    title: "Your locations stay yours",
    // CLAUDE.md §12: Google's terms forbid storing names and addresses.
    body: "Built on OpenStreetMap, so addresses and coordinates can be kept and published. Google's terms forbid storing them.",
  },
];

export function NoGoogle() {
  return (
    <Section
      screen
      eyebrow="Sources"
      title="Nothing from Google loads with your map."
      lede="Open map data, our own CDN, and no API key. The map on your site never calls Google."
    >
      <SplitBody art={<NoGoogleArt />} points={POINTS} />
    </Section>
  );
}
