"use client";

import { buttonVariants, Spinner, type ButtonVariants } from "@heroui/react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/**
 * A plan button that opens the checkout without a blank page in between.
 *
 * **A plain `<a>`, not `next/link`, and that is the whole fix.** `/upgrade` is a
 * dynamic page that reads the session and waits on the provider to create a
 * checkout before it redirects. Reached by a *client* navigation, the router
 * swapped the page out first — the marketing layout faded to nothing — and only
 * then handed the external redirect to `location.assign`, so the buyer watched an
 * empty page for as long as the provider took. A document navigation keeps the
 * page they pressed on screen until the response arrives, and the response is a
 * plain 307 to the checkout (no Suspense boundary or `loading.tsx` above
 * `/upgrade` flushes anything first — keep it that way). So the browser goes
 * from this page straight to the provider's.
 *
 * The press is still answered at once: a spinner and "Opening checkout…" on the
 * button, which ignores a second press. A modified click (new tab or window) is
 * left to the browser and spins nothing.
 *
 * **Back from the checkout restores this page from the bfcache with its state
 * intact** — a button still spinning on a page nothing is loading. `pageshow`
 * with `persisted` is the one signal that happened, and resets it.
 */
export function CheckoutLink({
  href,
  children,
  className,
  variant,
  fullWidth,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: ButtonVariants["variant"];
  fullWidth?: boolean;
}) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };

    window.addEventListener("pageshow", reset);

    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pending) {
      event.preventDefault();
      return;
    }

    const modified =
      event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

    if (!modified) setPending(true);
  };

  return (
    <a
      href={href}
      onClick={onClick}
      aria-busy={pending || undefined}
      className={buttonVariants({ variant, fullWidth, className })}
    >
      {pending ? (
        <>
          <Spinner size="sm" color="current" aria-hidden="true" />
          <span aria-live="polite">Opening checkout…</span>
        </>
      ) : (
        children
      )}
    </a>
  );
}
