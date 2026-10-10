import { PlatformIcon } from "@/components/marketing/integrations/platform-icon";
import { HtmlBlockArt } from "@/components/marketing/integrations/wordpress/art/html-block-art";
import { LinkButton } from "@/components/ui/link-button";

/**
 * The top of /for/any-website: the promise in one line, and the drawing of the
 * line going in — the WordPress page's Custom HTML drawing, labelled "Embed",
 * because that is what most builders call the block it stands for.
 */
export function AnyWebsiteHero() {
  return (
    <section className="px-5 pt-8 pb-16 sm:px-8 sm:pt-12 sm:pb-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
        <div>
          <p className="mk-eyebrow inline-flex items-center gap-2 text-muted">
            <PlatformIcon icon="code" className="size-3.5" />
            Integrations · Any website
          </p>

          <h1 className="mk-display mt-5 max-w-xl text-4xl text-balance text-foreground sm:text-5xl">
            One line on <span className="text-accent">any website</span>.
          </h1>

          <p className="mt-6 max-w-lg text-base/7 text-pretty text-muted sm:text-lg/8">
            Paste one script tag where the map should go. It keeps showing your
            latest publish.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <LinkButton href="/signup">Create a free map</LinkButton>
            <LinkButton href="/docs/publishing-and-embedding#embed-code" variant="tertiary">
              Read the guide
            </LinkButton>
          </div>
        </div>

        <div className="mk-panel aspect-[3/2] w-full overflow-hidden rounded-2xl">
          <HtmlBlockArt label="Embed" />
        </div>
      </div>
    </section>
  );
}
