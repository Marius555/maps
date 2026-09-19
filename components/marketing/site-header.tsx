import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";

/**
 * The public site's header.
 *
 * **Three deliberate absences**, and they are the whole design:
 *
 * 1. **No bottom rule and no background of its own.** It inherits the page's
 *    ground, so it reads as the top of the page rather than a strip laid on
 *    top of it. The header this replaced had `border-b border-border`, which
 *    on the landing page drew a line straight across the hero.
 * 2. **No button.** Every item is text. The sign-up CTA used to be a filled
 *    `LinkButton`, and a filled chip in a bar with nothing else in it is the
 *    loudest thing on a page whose loudest thing should be the map. "Sign up"
 *    carries its emphasis in the accent's *ink* and nothing else.
 * 3. **Not sticky.** A transparent bar that stays put while content scrolls
 *    under it is the one way a transparent header goes wrong — and a
 *    background is exactly what is ruled out, so there is no fixing it later.
 *    Conversion is carried by the hero's CTA and by the cost calculator's
 *    buttons, which are where somebody deciding actually is.
 *
 * `BrandLogo` is untouched, so setting `logo.light` in brand.json still swaps
 * the wordmark for an image with no change here.
 */
export function SiteHeader() {
  return (
    <header>
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-6 sm:px-8">
        <Link
          href="/"
          aria-label="Home"
          className="shrink-0 rounded-sm text-foreground transition-opacity hover:opacity-70"
        >
          <BrandLogo className="h-6" />
        </Link>

        <div className="flex items-center gap-5 sm:gap-7">
          {/*
            Hidden below `sm` rather than folded into a menu. Three links do not
            earn a hamburger, and the two that matter on a phone — the way in
            and the way to sign up — are the two that stay.
          */}
          <NavLink href="/#features" className="hidden sm:inline">
            Features
          </NavLink>
          <NavLink href="/pricing" className="hidden sm:inline">
            Pricing
          </NavLink>
          <NavLink href="/docs" className="hidden sm:inline">
            Documentation
          </NavLink>
          <NavLink href="/login">Log in</NavLink>

          <Link
            href="/signup"
            className="rounded-sm text-sm font-medium text-accent transition-opacity hover:opacity-80"
          >
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-sm text-sm text-muted transition-colors hover:text-foreground ${className}`}
    >
      {children}
    </Link>
  );
}
