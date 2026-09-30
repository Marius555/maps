import { buttonVariants } from "@heroui/react";
import { ArrowUpRight } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";

/**
 * The notification's one action.
 *
 * An in-app path is a Next `Link`, so it keeps the shell and the query cache. An
 * outside address opens in a new tab: the owner was reading their own
 * dashboard, and replacing it with somebody's blog post makes Back the only way
 * home. The address was checked on write and again in `toNotification`.
 */
export function NotificationLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith("/")) {
    return (
      <LinkButton href={href} variant="secondary" size="sm">
        {label}
      </LinkButton>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      className={buttonVariants({ variant: "secondary", size: "sm" })}
    >
      {label}
      <ArrowUpRight aria-hidden="true" className="size-4" />
    </a>
  );
}
