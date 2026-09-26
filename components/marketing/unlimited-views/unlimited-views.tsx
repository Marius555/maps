import { Section } from "../section";
import { SplitBody } from "../split/split-body";
import { ViewsArt } from "./views-art";
import {
  FlatLineSymbol,
  NoServerSymbol,
  PublishedFileSymbol,
} from "./views-symbols";

/**
 * Why views are unlimited: the mechanism, one screen before the calculator
 * shows what it does to a bill.
 *
 * It is CLAUDE.md §2 said to a customer. Publishing writes a static file, the
 * embed reads that file and static tiles, and nothing we are billed for runs
 * when a visitor opens the map — so there is nothing per view to count, and
 * "unlimited" is a description rather than a promise we are subsidising.
 */
const POINTS = [
  {
    symbol: <PublishedFileSymbol />,
    title: "Published once, read by everyone",
    // lib/snapshot/**
    body: "Press Publish and your map is written to one file on a CDN. Every visitor after that reads the same file.",
  },
  {
    symbol: <NoServerSymbol />,
    title: "Nothing is looked up when it loads",
    // embed/src/** — CLAUDE.md §2. "Loads" on purpose: the analytics beacon,
    // when an owner switches it on, is one report at the end of a visit.
    body: "Loading the map queries no database and calls no paid API. Search and “nearest to me” run in the visitor's browser.",
  },
  {
    symbol: <FlatLineSymbol />,
    title: "The same price at any traffic",
    body: "A thousand views or a million, on every plan — Free included. Views are never billed and never capped.",
  },
];

export function UnlimitedViews() {
  return (
    <Section
      screen
      eyebrow="Circulation"
      title="A million views cost what ten do."
      lede="Map platforms bill every time your map loads. Yours is a published file, so there is nothing to bill per view."
    >
      <SplitBody art={<ViewsArt />} points={POINTS} artSide="right" />
    </Section>
  );
}
