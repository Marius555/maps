import { Lock } from "lucide-react";

/**
 * The right-hand column of every auth screen: what the page is, the form, and
 * the one link off it.
 *
 * Replaces the old `AuthCard`, which centred a 384px box in the middle of an
 * otherwise empty page. Two things worth naming:
 *
 * - **Centred, under a lock.** The heading block is the one centred thing in the
 *   column and the badge above it says "this is where you sign in" before a word
 *   is read. The fields below stay full-width, so there is still one edge to
 *   track once the eye reaches the form.
 * - **The subtitle is optional.** Log in and Sign up need none — the title is
 *   the whole sentence. Forgot, reset, confirm and the failure screens keep
 *   theirs, because there it is the instructions ("links last 24 hours").
 *
 * The back arrow and the product's name are not here: they belong to the column
 * rather than to this block, so `app/(auth)/layout.tsx` pins them to its top
 * corners (`AuthBackButton`, `AuthBrand`) at every width.
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
