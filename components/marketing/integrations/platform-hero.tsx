import { ScrollCue } from "@/components/marketing/hero/scroll-cue";
import type { Integration } from "@/lib/marketing/integrations";

import { PlatformIcon } from "./platform-icon";

/**
 * The first screen of a `/for/*` platform page: what it is and the ways in,
 * beside a drawing of it happening. Words beside the drawing from `lg`,
 * stacked over it below.
 *
 * **Shaped like the landing page's hero, because it does the same job.** It
 * holds the first screen with the header (`--mk-header` subtracted, see
 * `Hero`), it stands on the graticule, and it ends on the scroll cue that says
 * the page moves a screen at a time — `SnapPage` is what makes it so. Its type
 * steps down between `lg` and `xl`, where the words get the narrower column:
 * measured at 1024×704, the full sizes ran the screen 55px long. The
 * drawing stands on the page (`.mk-ground`), not on a grey panel: the landing
 * page has none, and the platform pages are the same site.
 */
export function PlatformHero({
  icon,
  platform,
  title,
  lede,
  actions,
  note,
  art,
}: {
  icon: Integration["icon"];
  platform: string;
  title: React.ReactNode;
  lede: string;
  actions: React.ReactNode;
  note?: React.ReactNode;
  art: React.ReactNode;
}) {
  return (
    <section className="relative flex min-h-[calc(100svh-var(--mk-header))] flex-col px-5 pt-8 pb-8 sm:px-8 sm:pt-10 sm:pb-12">
      <div aria-hidden="true" className="mk-graticule pointer-events-none absolute inset-0" />

      <div className="relative mx-auto grid w-full max-w-6xl flex-1 content-center items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-10 xl:grid-cols-[1fr_1.15fr] xl:gap-12">
        <div>
          <p className="mk-eyebrow inline-flex items-center gap-2 text-muted">
            <PlatformIcon icon={icon} className="size-3.5" />
            Integrations · {platform}
          </p>

          <h1 className="mk-display mt-5 max-w-xl text-[2.5rem] text-balance text-foreground sm:text-5xl xl:text-[3.5rem]">
            {title}
          </h1>

          <p className="mt-6 max-w-lg text-base/7 text-pretty text-muted sm:text-lg/8 lg:mt-5 lg:text-base/7 xl:mt-6 xl:text-lg/8">
            {lede}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>

          {note ? <p className="mt-4 text-xs text-muted">{note}</p> : null}
        </div>

        <div className="mk-ground relative aspect-[3/2] w-full">{art}</div>
      </div>

      <ScrollCue label="See how it works" />
    </section>
  );
}
