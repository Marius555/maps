import { LinkButton } from "@/components/ui/link-button";

/**
 * The foot of a platform page: one sentence and the two ways in. Same buttons
 * as the landing page's hero, so "Create a free map" means one thing site-wide.
 */
export function IntegrationCta({ title, lede }: { title: React.ReactNode; lede: string }) {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <div className="mk-panel mx-auto flex w-full max-w-6xl flex-col items-start gap-6 rounded-3xl p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="mk-display text-3xl text-balance text-foreground sm:text-4xl">{title}</h2>
          <p className="mt-3 text-base/7 text-pretty text-muted">{lede}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          <LinkButton href="/signup">Create a free map</LinkButton>
          <LinkButton href="/pricing" variant="tertiary">
            See pricing
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
