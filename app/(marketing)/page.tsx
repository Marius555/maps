import { LinkButton } from "@/components/ui/link-button";
import { PRODUCT_TAGLINE } from "@/lib/config";

/**
 * Placeholder landing page. The real one is Week 4 work — this exists so `/`
 * resolves to something honest instead of create-next-app's template.
 */
export default function LandingPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
        {PRODUCT_TAGLINE}
      </h1>

      <p className="max-w-xl text-pretty text-muted">
        Import your locations, style the map, and paste one line of code into your
        site. No API keys, no per-view billing.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/signup">Get started</LinkButton>
        <LinkButton href="/login" variant="tertiary">
          Log in
        </LinkButton>
      </div>
    </section>
  );
}
