import { HeroMap } from "./hero-map/hero-map";

/**
 * The map, given the screen it was always asking for.
 *
 * **Not a `Section`.** Every other section on this page opens with an eyebrow, a
 * title and a lede, which together are about 175px — a sixth of the screen spent
 * describing the one thing on the page that describes itself. The hero above it
 * has just said what this is; this screen is the demonstration.
 *
 * **No graticule.** The ruled ground belongs to the hero alone (see
 * ../section.tsx): putting a grid behind a map is putting a grid behind a grid.
 *
 * The chain that gives the map its height is three links and every one of them
 * is load bearing: this section is `flex` and a screen tall, the column inside
 * it is `flex-1` with `min-h-0`, and `.mk-hero-map` is `flex: 1 1 auto` with
 * `container-type: size`. Drop `min-h-0` and Chrome resolves the map's
 * percentage height against a parent that was itself grown by `flex-grow`, which
 * is `auto` — and the map falls back to its 15rem floor, which is exactly the
 * 240px letterbox this screen exists to end.
 */
export function MapShowcase() {
  return (
    <section className="flex min-h-[100svh] flex-col justify-center px-5 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        <HeroMap />
      </div>
    </section>
  );
}
