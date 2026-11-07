"use client";

import { ExternalLink } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import { embedTestPageUrl } from "@/lib/embed/snippet";
import { useOrigin } from "../use-origin";

/**
 * The map on a page of its own, so the owner can see what they published.
 *
 * Before this, everything after Publish was a `<script>` tag: the only way to
 * find out what a visitor would get was to paste the snippet into a real site.
 * The designer's preview is not that — it renders a snapshot built in the
 * browser, in a `srcdoc` frame on the dashboard's own origin, with no collector
 * URL, so it can prove a colour and can never prove a publish.
 *
 * This opens `/embed/live.html`, which points the real built bundle at the real
 * live snapshot.
 *
 * **No note under it any more** (2026-11-07). It carried a sentence about what
 * the page is and, with analytics on, a warning that visits there are recorded.
 * The test page now says both itself, in its title and its Analytics status
 * card, where they are true of the snapshot actually loaded rather than of the
 * designer's draft.
 *
 * `LinkButton` rather than a `Button` with `window.open`, because this is a
 * navigation: middle-click, copy-link-address and open-in-new-window all have to
 * work on a URL somebody will want to send to a colleague.
 */
export function TestPageLink({
  snapshotUrl,
  tags,
}: {
  snapshotUrl: string;
  /** The snippet's tag choice, so the test page narrows the same way. */
  tags: readonly string[];
}) {
  const origin = useOrigin();

  return (
    <LinkButton
      variant="secondary"
      size="sm"
      href={origin ? embedTestPageUrl(origin, snapshotUrl, tags) : "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={origin ? undefined : true}
      className={origin ? undefined : "pointer-events-none opacity-50"}
    >
      <ExternalLink aria-hidden="true" className="size-4" />
      Open test page
      <span className="sr-only">(opens in a new tab)</span>
    </LinkButton>
  );
}
