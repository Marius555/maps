import type { NewPlace } from "../support/api";

/**
 * The map every docs screenshot shows: a made-up coffee roaster's London
 * stockists. Coordinates are in the file so the capture never spends a lookup.
 *
 * Invented brand, ordinary streets. It is what the target customer (CLAUDE.md
 * §1) would actually build, which is the whole point of showing it.
 */

export const DEMO_MAP_NAME = "Fieldwork Coffee stockists";

export const DEMO_TAGS = [
  { id: "cafe", label: "Café", color: "#d9480f" },
  { id: "roastery", label: "Roastery", color: "#5f3dc4" },
  { id: "stockist", label: "Stockist", color: "#2b8a3e" },
  { id: "sundays", label: "Open Sundays", color: "#1c7ed6" },
] as const;

type TagId = (typeof DEMO_TAGS)[number]["id"];

const place = (
  name: string,
  address: string,
  lat: number,
  lng: number,
  tags: TagId[],
  phone: string,
): NewPlace => ({ name, address, lat, lng, tags: [...tags], phone });

export const DEMO_PLACES: NewPlace[] = [
  place("Fieldwork Covent Garden", "34 Neal Street, London WC2H 9PS", 51.5145, -0.1255, ["cafe", "sundays"], "+44 20 7946 0101"),
  place("Fieldwork Shoreditch", "12 Redchurch Street, London E2 7DJ", 51.5243, -0.0763, ["cafe", "sundays"], "+44 20 7946 0102"),
  place("Fieldwork Roastery", "Unit 4, Hackney Wick, London E9 5EN", 51.5432, -0.0254, ["roastery"], "+44 20 7946 0103"),
  place("Fieldwork Camden", "88 Parkway, London NW1 7AN", 51.5381, -0.1453, ["cafe"], "+44 20 7946 0104"),
  place("Fieldwork Islington", "201 Upper Street, London N1 1RQ", 51.5414, -0.1028, ["cafe", "sundays"], "+44 20 7946 0105"),
  place("Fieldwork Brixton", "5 Coldharbour Lane, London SW9 8LF", 51.4622, -0.1137, ["cafe"], "+44 20 7946 0106"),
  place("Fieldwork Borough", "9 Stoney Street, London SE1 9AA", 51.5054, -0.0913, ["cafe", "sundays"], "+44 20 7946 0107"),
  place("Fieldwork Notting Hill", "142 Portobello Road, London W11 2DZ", 51.5155, -0.2049, ["cafe"], "+44 20 7946 0108"),
  place("Corner Larder", "61 Lordship Lane, London SE22 8EP", 51.4565, -0.0745, ["stockist"], "+44 20 7946 0109"),
  place("Greenwich Grocer", "17 Nelson Road, London SE10 9JB", 51.4817, -0.0089, ["stockist", "sundays"], "+44 20 7946 0110"),
  place("Hampstead Pantry", "8 Flask Walk, London NW3 1HE", 51.5571, -0.1777, ["stockist"], "+44 20 7946 0111"),
  place("Clapham Deli", "44 Old Town, London SW4 0LB", 51.4644, -0.1406, ["stockist", "sundays"], "+44 20 7946 0112"),
  place("Richmond Provisions", "3 King Street, Richmond TW9 1ND", 51.4600, -0.3062, ["stockist"], "+44 20 7946 0113"),
  place("Walthamstow Market Shop", "250 High Street, London E17 7JH", 51.5838, -0.0237, ["stockist"], "+44 20 7946 0114"),
  place("Fulham Fine Foods", "590 King's Road, London SW6 2DX", 51.4787, -0.1863, ["stockist"], "+44 20 7946 0115"),
];

/** Shoreditch and Covent Garden's same-day delivery zone, and a pickup area. */
export const DEMO_SHAPES = [
  {
    name: "Same-day delivery",
    geometry: { kind: "circle", lng: -0.1, lat: 51.52, radius: 3500 },
    color: "#d9480f",
    opacity: 0.15,
  },
  {
    name: "East London pickup",
    geometry: {
      kind: "polygon",
      points: [
        [-0.06, 51.555],
        [-0.005, 51.56],
        [0.01, 51.53],
        [-0.03, 51.515],
        [-0.07, 51.53],
      ],
    },
    color: "#5f3dc4",
    opacity: 0.18,
  },
];
