import { buttonVariants } from "@heroui/react";
import { Download } from "lucide-react";

import { PlatformIcon } from "@/components/marketing/integrations/platform-icon";
import { LinkButton } from "@/components/ui/link-button";
import { WORDPRESS_PLUGIN_URL } from "@/lib/marketing/integrations";
import { WordPressBlockArt } from "./wordpress-block-art";

/**
 * The top of /for/wordpress: what it is, the two ways in, and the drawing of
 * the block being set up. Words beside the drawing from `lg`, stacked under it.
 *
 * The download is a plain `<a download>`, not a `LinkButton`: it is a file, and
 * the router has no business prefetching a zip.
 */
export function WordPressHero() {
  return (
    <section className="px-5 pt-8 pb-16 sm:px-8 sm:pt-12 sm:pb-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        <div>
          <p className="mk-eyebrow inline-flex items-center gap-2 text-muted">
            <PlatformIcon icon="wordpress" className="size-3.5" />
            Integrations · WordPress
          </p>

          <h1 className="mk-display mt-5 max-w-xl text-4xl text-balance text-foreground sm:text-5xl">
            Your locations, on your <span className="text-accent">WordPress</span> site.
          </h1>

          <p className="mt-6 max-w-lg text-base/7 text-pretty text-muted sm:text-lg/8">
            A map block that sets itself up. Add it to a page, press one button,
            pick a map — no API key, no code, nothing to paste.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={WORDPRESS_PLUGIN_URL} download className={buttonVariants()}>
              <Download aria-hidden="true" className="size-4" />
              Download the plugin
            </a>
            <LinkButton href="/signup" variant="tertiary">
              Create a free map
            </LinkButton>
          </div>

          <p className="mt-4 text-xs text-muted">
            Free · Works with the block editor, the classic editor and page builders.
          </p>
        </div>

        <div className="mk-panel aspect-[3/2] w-full overflow-hidden rounded-2xl">
          <WordPressBlockArt />
        </div>
      </div>
    </section>
  );
}
