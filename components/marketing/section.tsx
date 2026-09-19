import { Reveal } from "./reveal";

/**
 * One section of the landing page.
 *
 * The marketing pages use their own measure (`max-w-6xl`) rather than
 * `components/ui/container.tsx`'s three. That container exists to stop the
 * *dashboard's* pages inventing a seventh width each; this is a different room
 * with one page in it, and the landing page's hero needs to be wider than the
 * 5xl the app's centred pages use or the map comes out letterboxed.
 *
 * The graticule ground belongs to the hero alone. It was offered here as a
 * prop and used on two sections; ruling the ground behind a grid of cards put
 * a grid behind a grid, and the section that had it read as busier rather than
 * as more considered.
 *
 * `eyebrow` is set in mono and uppercase, the way a map sheet labels its
 * margins. It is not decoration: each one names what kind of thing the section
 * is — a key, a sequence, a scale, a survey, a table of plans — so the page can
 * be read by its labels alone.
 *
 * `screen` is the landing page's own shape: the section holds a viewport and
 * centres what is in it, so scrolling moves one argument at a time (the snap
 * itself is `.mk-snap` in globals.css, which is on the page rather than here —
 * a section does not get to decide how the page scrolls). `100svh` and not
 * `100vh`: on a phone the large viewport is the one that is only true once the
 * address bar has gone, and a section measured against it is cut off on
 * arrival. Off by default, so /pricing — one section long, under a header — is
 * unchanged.
 *
 * **`min-h` is a floor, and the landing page needs it to be the ceiling too.**
 * Three of the four screen sections measured *taller* than the viewport on an
 * ordinary laptop — 865px against 732px — which is why the snap rule had been
 * backed off to `proximity` below 56rem of window. So `screen` also runs the
 * tighter of two type and spacing scales: smaller padding, a smaller title, and
 * a smaller gap to the content. /pricing keeps the roomier one, because it is a
 * document rather than a slide. The per-section budget and where each section
 * found its pixels are in docs/notes/marketing.md — re-measure before adding a
 * row to any of them.
 */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  headingLevel = "h2",
  screen = false,
  className = "",
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  /** `h1` when the section *is* the page — /pricing is one section long. */
  headingLevel?: "h1" | "h2";
  /** Hold a whole viewport and centre the contents in it. */
  screen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Heading = headingLevel;

  return (
    <section
      id={id}
      /*
       * `scroll-mt` because the header is not sticky but a `#features` jump
       * still lands better with the eyebrow clear of the viewport edge — except
       * on a section that holds the whole screen, where a scroll margin is also
       * the snap offset and would rest every section 48px short of its own top,
       * cutting the same 48px off the bottom.
       */
      className={`relative px-5 sm:px-8 ${
        screen
          ? "flex min-h-[100svh] flex-col justify-center py-10 sm:py-12"
          : "scroll-mt-12 py-20 sm:py-28"
      } ${className}`}
    >
      <div className="relative mx-auto w-full max-w-6xl">
        <Reveal>
          <p className="mk-eyebrow text-muted">{eyebrow}</p>
          <Heading
            className={`mk-display mt-4 max-w-3xl text-3xl text-balance text-foreground ${
              screen ? "sm:text-4xl" : "sm:text-5xl"
            }`}
          >
            {title}
          </Heading>
          {lede ? (
            <p
              className={`max-w-2xl text-pretty text-muted ${
                screen ? "mt-4 text-sm/6 sm:text-base/7" : "mt-5 text-base/7"
              }`}
            >
              {lede}
            </p>
          ) : null}
        </Reveal>

        <div className={screen ? "mt-7 sm:mt-8" : "mt-12 sm:mt-16"}>{children}</div>
      </div>
    </section>
  );
}
