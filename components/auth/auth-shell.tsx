import Link from "next/link";

import { PRODUCT_NAME } from "@/lib/config";

/**
 * The right-hand column of every auth screen: what the page is, the form, and
 * the one link off it.
 *
 * Replaces the old `AuthCard`, which centred a 384px box in the middle of an
 * otherwise empty page. Two differences worth naming:
 *
 * - **Left-aligned.** A centred heading over left-aligned inputs gives the eye
 *   two different starting edges to track; once the form is a column in a split
 *   layout rather than an island, ragged-left is the only alignment that lines
 *   the title up with the first field.
 * - **The product mark only appears below `lg`.** Above it the panel on the left
 *   is already saying the name, and printing it twice on one screen reads as a
 *   template that forgot which half it was in.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <Link
        href="/"
        className="inline-block text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-muted lg:hidden"
      >
        {PRODUCT_NAME}
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
          {title}
        </h1>
        <p className="text-sm text-pretty text-muted">{description}</p>
      </div>

      {children}

      {footer ? <p className="text-sm text-muted">{footer}</p> : null}
    </div>
  );
}
