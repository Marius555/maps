"use client";

import { Button, toast } from "@heroui/react";
import { Copy } from "lucide-react";
import { useState } from "react";

import { embedScriptUrl, embedSnippet } from "@/lib/embed/snippet";
import type { MapTagGroup } from "@/lib/repositories/types";
import { SnippetTagFilter } from "./snippet-tag-filter";
import { TestPageLink } from "./share-dialog/test-page-link";
import { useOrigin } from "./use-origin";

/**
 * The one line the customer pastes into their site.
 *
 * The script URL is derived from the browser's own origin, so a self-hosted or
 * preview deployment hands out a snippet that actually points at itself. That
 * has to happen after mount — during SSR there is no origin to read, and
 * guessing one would put a wrong URL on the customer's clipboard. `useOrigin`
 * holds that, shared with the test page link beside the copy button.
 */
export function EmbedSnippet({
  snapshotUrl,
  isMeasuring,
  tagGroups,
}: {
  snapshotUrl: string;
  isMeasuring: boolean;
  tagGroups: MapTagGroup[];
}) {
  const origin = useOrigin();
  // Local, not saved: the choice belongs to the copy being pasted, not the map.
  const [tags, setTags] = useState<ReadonlySet<string>>(new Set());

  const snippet = origin
    ? embedSnippet({
        scriptUrl: embedScriptUrl(origin),
        snapshotUrl,
        tags: [...tags],
      })
    : null;

  const onCopy = async () => {
    if (!snippet) return;

    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Copied", { description: "Paste it into your page's HTML." });
    } catch {
      // Clipboard access is refused over plain http and in some embedded
      // browsers. The snippet is selectable on screen, so say that rather than
      // pretending it worked.
      toast.warning("Couldn't copy", {
        description: "Select the snippet and copy it manually.",
      });
    }
  };

  /*
   * No `SectionPanel` around this any more: it is folded into the design
   * sidebar, where the disclosure already carries the heading and a second
   * bordered box inside a 320px column is a frame around a frame.
   */
  return (
    <div className="space-y-2">
      <p className="text-pretty text-xs text-muted">
        Paste this into your page where the map should appear. It keeps working
        after you publish again — you only paste it once.
      </p>

      <SnippetTagFilter groups={tagGroups} selected={tags} onChange={setTags} />

      <pre className="overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs text-foreground">
        <code className="whitespace-pre">
          {snippet ?? "Loading the snippet…"}
        </code>
      </pre>

      {/* Wraps rather than shrinks: two buttons and a line of prose do not fit
          one row at 390px. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onPress={onCopy}
          isDisabled={!snippet}
        >
          <Copy aria-hidden="true" className="size-4" />
          Copy embed code
        </Button>

        <TestPageLink snapshotUrl={snapshotUrl} isMeasuring={isMeasuring} />
      </div>
    </div>
  );
}
