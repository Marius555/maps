"use client";

import { useState } from "react";

import { embedScriptUrl, embedSnippet } from "@/lib/embed/snippet";
import type { MapTagGroup, Place } from "@/lib/repositories/types";
import { useOrigin } from "../use-origin";
import { SnippetCode } from "./snippet-code";
import { SnippetTagRow } from "./snippet-tag-row";
import { TestPageLink } from "./test-page-link";

/**
 * The one line the customer pastes into their site, and the two things that go
 * with it: which tags this copy shows, and the test page.
 *
 * The script URL is derived from the browser's own origin, so a self-hosted or
 * preview deployment hands out a snippet that actually points at itself. That
 * has to happen after mount — during SSR there is no origin to read, and
 * guessing one would put a wrong URL on the customer's clipboard. `useOrigin`
 * holds that, shared with the test page link.
 *
 * The tag choice is local, not saved: it belongs to the copy being pasted, not
 * the map.
 */
export function WebsiteTab({
  snapshotUrl,
  tagGroups,
  places,
  onCopied,
}: {
  snapshotUrl: string;
  tagGroups: MapTagGroup[];
  places: Place[];
  /** A copy reached the clipboard — the "Your website" stepper's embed step
      counts that as done (`WebsiteStepper`). */
  onCopied?: () => void;
}) {
  const origin = useOrigin();
  const [tags, setTags] = useState<ReadonlySet<string>>(new Set());

  const snippet = origin
    ? embedSnippet({
        scriptUrl: embedScriptUrl(origin),
        snapshotUrl,
        tags: [...tags],
      })
    : null;

  return (
    <div className="space-y-4">
      <SnippetCode snippet={snippet} onCopied={onCopied} />

      <SnippetTagRow
        groups={tagGroups}
        places={places}
        selected={tags}
        onChange={setTags}
      />

      <TestPageLink snapshotUrl={snapshotUrl} tags={[...tags]} />
    </div>
  );
}
