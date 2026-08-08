import Link from "next/link";

import { LinkButton } from "@/components/ui/link-button";
import { PRODUCT_NAME } from "@/lib/config";

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
            {PRODUCT_NAME}
          </Link>

          <div className="flex items-center gap-3">
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
    </div>
  );
}
