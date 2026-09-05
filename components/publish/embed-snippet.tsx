"use client";

import { Button, toast } from "@heroui/react";
import { Copy } from "lucide-react";
import { useSyncExternalStore } from "react";

import { embedScriptUrl, embedSnippet } from "@/lib/embed/snippet";

/**
 * The origin is an external value, not React state, so it is read with
 * useSyncExternalStore rather than set from an effect. It never changes, hence
 * the no-op subscribe; the server snapshot is null so SSR and the first
 * hydration render agree.
 */
const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => null;

/**
 * The one line the customer pastes into their site.
 *
 * The script URL is derived from the browser's own origin, so a self-hosted or
 * preview deployment hands out a snippet that actually points at itself. That
 * has to happen after mount — during SSR there is no origin to read, and
 * guessing one would put a wrong URL on the customer's clipboard.
 */
export function EmbedSnippet({ snapshotUrl }: { snapshotUrl: string }) {
  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);

  const snippet = origin
    ? embedSnippet({ scriptUrl: embedScriptUrl(origin), snapshotUrl })
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

      <pre className="overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs text-foreground">
        <code className="whitespace-pre">
          {snippet ?? "Loading the snippet…"}
        </code>
      </pre>

      <Button
        variant="secondary"
        size="sm"
        onPress={onCopy}
        isDisabled={!snippet}
      >
        <Copy aria-hidden="true" className="size-4" />
        Copy embed code
      </Button>
    </div>
  );
}
