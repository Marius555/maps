import {
  ChartColumn,
  CodeXml,
  CreditCard,
  LayoutTemplate,
  List,
  Map as MapIcon,
  Rocket,
  Shapes,
  Sheet,
  Tags,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Every guide there is, in the order they should be read.
 *
 * One list rather than a page each, because the hub's cards and the shell's nav
 * are two views of the same set and a second copy is how a guide ends up listed
 * in one and missing from the other. Adding a guide is an entry here plus a
 * `page.tsx` at the matching slug.
 *
 * `summary` is written to be read on its own: it is the card's body, the nav's
 * tooltip-less second line, and the page's `<meta name="description">`.
 *
 * `group` is the heading a guide sits under in both views. The order of
 * `DOCS_GROUPS` is the order they are drawn in; guides keep this list's order
 * inside their group.
 */
export const DOCS_GROUPS = ["Start", "Build", "Publish", "Account"] as const;

export type DocsGroup = (typeof DOCS_GROUPS)[number];

export type DocsArticle = {
  /**the last segment of `/docs/<slug>`. */
  slug: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  group: DocsGroup;
};

export const DOCS_ARTICLES: DocsArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary:
      "Create an account, make your first map, put a location on it and get it onto your website.",
    icon: Rocket,
    group: "Start",
  },
  {
    slug: "importing-locations",
    title: "Importing locations",
    summary:
      "Bring your locations in from a spreadsheet, an XML feed or a Google Sheet, and check where they landed before anything is saved.",
    icon: Upload,
    group: "Build",
  },
  {
    slug: "managing-locations",
    title: "Managing locations",
    summary:
      "Find, filter and fix your locations, and fill in their contact details, opening hours, photos and logo.",
    icon: List,
    group: "Build",
  },
  {
    slug: "map-editor",
    title: "The map editor",
    summary:
      "Add and move locations on the map, choose how the map looks, and export it as an image or a PDF.",
    icon: MapIcon,
    group: "Build",
  },
  {
    slug: "tags-pins-and-groups",
    title: "Tags, pins and groups",
    summary:
      "Sort your locations with tags, give them pins in your own colours or with your logo, and keep a big map tidy with groups.",
    icon: Tags,
    group: "Build",
  },
  {
    slug: "shapes-and-routes",
    title: "Shapes and routes",
    summary:
      "Draw delivery areas, zones and lines on your map, import them from a GIS file, and draw driving routes between locations.",
    icon: Shapes,
    group: "Build",
  },
  {
    slug: "designing-the-card",
    title: "Designing the card",
    summary:
      "Choose what a visitor sees when they open a location, lay it out block by block, and change it for one location only.",
    icon: LayoutTemplate,
    group: "Build",
  },
  {
    slug: "publishing-and-embedding",
    title: "Publishing and embedding",
    summary:
      "Design how your published map behaves, publish it, and paste one line of code into your website.",
    icon: CodeXml,
    group: "Publish",
  },
  {
    slug: "google-sheets-sync",
    title: "Google Sheets sync",
    summary:
      "Keep a map in step with a Google Sheet, so editing the sheet is how you edit the map.",
    icon: Sheet,
    group: "Publish",
  },
  {
    slug: "visitor-analytics",
    title: "Visitor analytics",
    summary:
      "See what visitors to your published map search for, which locations they open and where they come from.",
    icon: ChartColumn,
    group: "Publish",
  },
  {
    slug: "plans-and-billing",
    title: "Plans and billing",
    summary:
      "What each plan includes, what an address lookup is, and how to upgrade, change or cancel your plan.",
    icon: CreditCard,
    group: "Account",
  },
  {
    slug: "your-account",
    title: "Your account",
    summary:
      "Change your name, theme and password, sign out other devices, reset a forgotten password or delete your account.",
    icon: UserRound,
    group: "Account",
  },
];

export function docsHref(slug: string): string {
  return `/docs/${slug}`;
}

export function findArticle(slug: string): DocsArticle | undefined {
  return DOCS_ARTICLES.find((article) => article.slug === slug);
}

/** The guides under one heading, in reading order. */
export function articlesInGroup(group: DocsGroup): DocsArticle[] {
  return DOCS_ARTICLES.filter((article) => article.group === group);
}
