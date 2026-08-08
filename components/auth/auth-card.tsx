import Link from "next/link";

import { PRODUCT_NAME } from "@/lib/config";

/** Shared shell for the login and signup pages. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <Link
            href="/"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            {PRODUCT_NAME}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-sm text-muted">{description}</p>
        </div>

        {children}

        <p className="text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}
