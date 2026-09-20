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
 * live snapshot. It is the same page that was always in the tree for testing the
 * embed by hand; the only thing missing was a way to reach it.
 *
 * `LinkButton` rather than a `Button` with `window.open`, because this is a
 * navigation: middle-click, copy-link-address and open-in-new-window all have to
 * work on a URL somebody will want to send to a colleague.
 */
export function TestPageLink({
  snapshotUrl,
  isMeasuring,
}: {
  snapshotUrl: string;
  /**
   * Measurement as the owner has it set *now*, used for the warning's wording
   * and nothing else. Whether anything is actually recorded depends on the live
   * snapshot, which the test page reads and reports for itself — a draft switched
   * on a second ago is not yet in a published snapshot, and claiming otherwise
   * here is the confusion this whole page exists to end.
   */
  isMeasuring: boolean;
}) {
  const origin = useOrigin();

  return (
    <>
      <LinkButton
        variant="secondary"
        size="sm"
        href={origin ? embedTestPageUrl(origin, snapshotUrl) : "#"}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={origin ? undefined : true}
        className={origin ? undefined : "pointer-events-none opacity-50"}
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        Open test page
        <span className="sr-only">(opens in a new tab)</span>
      </LinkButton>

      {/*
        A fragment, and `w-full` is what puts this on its own line: the caller's
        row is `flex flex-wrap`, so a full-width child breaks rather than sitting
        beside the copy button. Keeping the note here rather than in the caller is
        the point — it describes this link, and the two move together.
      */}
      <p className="w-full text-pretty text-xs text-muted">
        Opens the map you last published on a page of its own, the way a visitor
        sees it.
        {isMeasuring
          ? " Anything you do there is recorded against this map like a visitor's session."
          : null}
      </p>
    </>
  );
}
