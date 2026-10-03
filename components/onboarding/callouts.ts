import type { TutorialId } from "@/lib/onboarding/tutorials";

import type { CalloutSide } from "./tutorial-layout";

/**
 * What each onboarding overlay points at, and what it says there.
 *
 * Each callout lists its targets in order of preference and uses the first one
 * that is on screen. The import callout needs two: from `md` up the Locations
 * link is in the sidebar, and below it the sidebar is a closed drawer, so the
 * arrow points at the button that opens it and the copy says so.
 *
 * Targets are `data-tutorial` attributes on the controls themselves — the
 * overlay reads where they ended up rather than knowing the layout.
 */
export type CalloutTarget = {
  selector: string;
  side: CalloutSide;
  title: string;
  body: string;
};

export type Callout = { id: string; targets: readonly CalloutTarget[] };

const MAPS: readonly Callout[] = [
  {
    id: "create-map",
    targets: [
      {
        selector: "create-map",
        side: "below",
        title: "Create your first map",
        body: "Name it, then add your locations.",
      },
    ],
  },
];

const IMPORT: Callout = {
  id: "import",
  targets: [
    {
      selector: "locations-link",
      side: "right",
      title: "Have a list of locations?",
      body: "CSV, Excel, XML or a Google Sheet.",
    },
    {
      selector: "nav-menu",
      side: "right",
      title: "Import a list",
      body: "Menu, then Locations. CSV, Excel, XML or a Google Sheet.",
    },
  ],
};

const EDITOR: readonly Callout[] = [
  {
    id: "add-location",
    targets: [
      {
        selector: "add-location",
        side: "below",
        title: "Drop Your First Location",
        body: "Press the pin, then click the map.",
      },
    ],
  },
  IMPORT,
];

/**
 * The same overlay on a map that already has locations — imported from the
 * Locations page before the editor was ever opened. "Your first" would be
 * false there; the controls it points at are the same.
 */
export const EDITOR_WITH_PLACES: readonly Callout[] = [
  {
    id: "add-location",
    targets: [
      {
        selector: "add-location",
        side: "below",
        title: "Add a Location",
        body: "Press the pin, then click the map.",
      },
    ],
  },
  IMPORT,
];

// The only arrow on screen, so it can afford to say what a card is for.
const CARD_BODY =
  "The card is what visitors see when they click a pin. Choose what it shows — photos, address, opening hours, a directions button — and style it to match your brand.";

const CARD: readonly Callout[] = [
  {
    id: "card",
    targets: [
      {
        selector: "card-link",
        side: "right",
        title: "Design your pin cards",
        body: CARD_BODY,
      },
      {
        selector: "nav-menu",
        side: "right",
        title: "Design your pin cards",
        body: `Menu, then Card. ${CARD_BODY}`,
      },
    ],
  },
];

const PUBLISH_BODY =
  "Get one line of code to paste into your website, and your map goes live there.";

const PUBLISH: readonly Callout[] = [
  {
    id: "publish",
    targets: [
      {
        selector: "publish-link",
        side: "right",
        title: "Ready to publish?",
        body: PUBLISH_BODY,
      },
      {
        selector: "nav-menu",
        side: "right",
        title: "Ready to publish?",
        body: `Menu, then Publish. ${PUBLISH_BODY}`,
      },
    ],
  },
];

export const CALLOUTS: Record<TutorialId, readonly Callout[]> = {
  maps: MAPS,
  editor: EDITOR,
  card: CARD,
  publish: PUBLISH,
};
