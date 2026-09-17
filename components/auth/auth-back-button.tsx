"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { IconButton } from "@/components/ui/icon-button";

/**
 * Back to wherever the visitor came from — the browser's own Back, with a floor.
 *
 * It goes home instead in two cases, both of which Back would get wrong:
 *
 * - **Nothing to go back to.** A fresh tab, or a link opened from an email
 *   (reset, confirm), has a history of one entry, and `router.back()` there does
 *   nothing at all.
 * - **Bounced here by `proxy.ts`**, which is what `?next=` means. The entry
 *   behind this one is the protected page that sent the visitor here, and going
 *   back to it only redirects them straight back to this form.
 *
 * `location` is read inside the handler rather than through `useSearchParams`,
 * so the auth layout needs no Suspense boundary for a value that only matters
 * at the moment of the press.
 */
export function AuthBackButton() {
  const router = useRouter();

  return (
    <IconButton
      label="Go back"
      icon={ArrowLeft}
      variant="ghost"
      size="md"
      placement="right"
      onPress={() => {
        const bounced = new URLSearchParams(window.location.search).has("next");

        if (bounced || window.history.length <= 1) {
          router.push("/");
        } else {
          router.back();
        }
      }}
    />
  );
}
