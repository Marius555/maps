import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/brand/site-footer";
import { LinkButton } from "@/components/ui/link-button";

// Annotated explicitly rather than with LayoutProps<"/">: route groups are
// stripped from the generated route literals, so both group layouts would claim
// the same key.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="font-semibold tracking-tight text-foreground">
            <BrandLogo className="h-7" />
          </Link>

          <div className="flex items-center gap-3">
            {/* Ahead of Log in, because it is the one thing on this header a
                visitor can use before having an account. */}
            <Link
              href="/docs"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Guides
            </Link>
            <Link
              href="/login"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              Log in
            </Link>
            <LinkButton href="/signup" size="sm">
              Sign up
            </LinkButton>
          </div>
        </nav>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <SiteFooter />
    </div>
  );
}
