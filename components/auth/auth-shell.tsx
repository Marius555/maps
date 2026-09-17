import { Lock } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";

/**
 * The right-hand column of every auth screen: what the page is, the form, and
 * the one link off it.
 *
 * Replaces the old `AuthCard`, which centred a 384px box in the middle of an
 * otherwise empty page. Three things worth naming:
 *
 * - **Centred, under a lock.** The heading block is the one centred thing in the
 *   column and the badge above it says "this is where you sign in" before a word
 *   is read. The fields below stay full-width, so there is still one edge to
 *   track once the eye reaches the form.
 * - **The subtitle is optional.** Log in and Sign up need none — the title is
 *   the whole sentence. Forgot, reset, confirm and the failure screens keep
 *   theirs, because there it is the instructions ("links last 24 hours").
 * - **The product mark only appears below `lg`.** Above it the panel on the left
 *   is already saying the name, and printing it twice on one screen reads as a
 *   template that forgot which half it was in.
 *
 * The back arrow is not here: it belongs to the column rather than to this
 * block, so `app/(auth)/layout.tsx` pins it to the column's corner.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <Link
        href="/"
        className="mx-auto block w-fit text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-muted lg:hidden"
      >
        <BrandLogo />
      </Link>

      <div className="flex flex-col items-center space-y-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <Lock aria-hidden="true" className="size-5" />
        </span>

        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
          {title}
        </h1>

        {description ? (
          <p className="text-sm text-pretty text-muted">{description}</p>
        ) : null}
      </div>

      {children}

      {footer ? (
        <p className="text-center text-sm text-muted">{footer}</p>
      ) : null}
    </div>
  );
}
