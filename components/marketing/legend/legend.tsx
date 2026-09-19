import { Section } from "../section";
import { Reveal } from "../reveal";
import {
  AreaSymbol,
  CardSymbol,
  ClusterSymbol,
  FilterSymbol,
  NearestSymbol,
  PanelSymbol,
  SearchSymbol,
} from "./legend-symbols";

/**
 * What a visitor to the customer's site gets.
 *
 * Laid out as a **key**, because that is genuinely what it is: a list of the
 * marks on the map above and what each one does. Nothing in this list happens
 * before anything else, which is why it is a two-column list of symbols and the
 * section below it — which *is* a sequence — is three panels in a row.
 *
 * Everything here is in the shipped bundle today; the file each line comes from
 * is named in the comment beside it, so a claim that stops being true has
 * somewhere to be checked against.
 */
const ENTRIES = [
  {
    symbol: <SearchSymbol />,
    title: "Search that knows the map",
    // embed/src/search.ts, embed/src/gazetteer.ts
    body: "Filters by name, address and category as it is typed. Towns and postcodes resolve too — “SW1A” becomes a point to measure from, with no geocoding call.",
  },
  {
    symbol: <NearestSymbol />,
    title: "Nearest to me",
    // embed/src/search.ts
    body: "Sorts every location by distance and opens the closest. Asks for a position only when pressed, and says plainly what happened if the browser refuses.",
  },
  {
    symbol: <ClusterSymbol />,
    title: "Hundreds of pins, still readable",
    // embed/src/map.ts
    body: "Nearby locations gather into a counted bubble and open when you press one. A 3,000-pin map behaves the same as a twelve-pin one.",
  },
  {
    symbol: <CardSymbol />,
    title: "Cards worth opening",
    // embed/src/popup.ts
    body: "Photos, opening hours that open on today, tap-to-call, a directions link, your own buttons. The card measures the room the panel leaves, so it never opens underneath it.",
  },
  {
    symbol: <PanelSymbol />,
    title: "A results list beside the map",
    // embed/src/list.ts
    body: "What turns a map with pins on it into a store locator. Press a row and the map flies there; press a pin and its row scrolls in. On a phone, a drawer you can drag.",
  },
  {
    symbol: <FilterSymbol />,
    title: "Categories that combine properly",
    // packages/shared/tags.ts
    body: "Any of the tags inside a group, and all the groups at once — “sells bikes or skis, and open on Sundays”. You name the groups; visitors just get the right answer.",
  },
  {
    symbol: <AreaSymbol />,
    title: "Areas and routes",
    // packages/shared/shapes.ts, embed/src/directions.ts
    body: "Draw a delivery zone, a catchment, a trail, or a route between stops. A route carries its real distance and drive time — “8.4 km · 39 min” — measured when you drew it.",
  },
];

export function Legend() {
  return (
    <Section
      screen
      id="features"
      eyebrow="Key"
      title="What the people on your site get."
      lede="All of it ships in every published map, on every plan."
    >
      {/* Three columns on a large screen, not two. Seven entries over two
            columns is four rows, and four rows is what put this section 133px
            past the screen it is supposed to hold; three columns is three rows
            and the same seven entries. Two columns survive from `sm` to `lg`,
            because three columns of this measure below that width is three
            columns of broken lines. */}
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
        {ENTRIES.map((entry, index) => (
          <li key={entry.title}>
            {/* Reveal inside the <li>, never around it: a <ul> may only have
                <li> children, and a motion wrapper in between is a div. */}
            <Reveal
              className="flex gap-4"
              // A stagger short enough to read as one movement rather than a
              // queue, and capped so the last row is not left waiting.
              delay={Math.min(index, 3) * 0.05}
            >
              <span className="mt-0.5">{entry.symbol}</span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  {entry.title}
                </h3>
                <p className="mt-1 text-sm/5.5 text-pretty text-muted">
                  {entry.body}
                </p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
