"use client";

import { Button, toast } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { HighlightedCode } from "@/components/ui/highlighted-code";

type CopyState = "idle" | "copied";

/**
 * The one line, on the dark code surface, with its copy button in the bar above
 * it — the shape the marketing pages' `CodeBlock` gives every snippet, so the
 * code a customer copies here looks like the code they read about there.
 *
 * Long lines wrap rather than scroll: a sideways scrollbar under one line of
 * code is the least finished thing a dialog can show, and the button is what
 * carries the code across intact.
 *
 * The button says "Copied" in place for a moment. A refused clipboard (plain
 * http, some in-app browsers) is a toast instead, because the fix — select it
 * and copy — needs a sentence.
 */
export function SnippetCode({
  snippet,
  onCopied,
}: {
  /** Null until the origin is known after mount (`useOrigin`). */
  snippet: string | null;
  onCopied?: () => void;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);

  const onCopy = async () => {
    if (!snippet) return;

    try {
      await navigator.clipboard.writeText(snippet);
      setState("copied");
      toast.success("Copied", { description: "Paste it into your page's HTML." });
      onCopied?.();
    } catch {
      toast.warning("Couldn't copy", {
        description: "Select the code and copy it manually.",
      });
    }
  };

  return (
    <div className="steady code-surface overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 pr-1.5 pl-4">
        <span className="font-mono text-xs text-[var(--code-dim)]">HTML</span>
        <Button
          size="sm"
          variant="ghost"
          onPress={onCopy}
          isDisabled={!snippet}
          // The ghost button's own fills are light greys, drawn for a light
          // page; on this ground they would swallow the label.
          className="text-[var(--code-ink)] hover:bg-white/10 data-[pressed=true]:bg-white/10"
        >
          {state === "copied" ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {state === "copied" ? "Copied" : "Copy embed code"}
        </Button>
      </div>

      <pre className="p-4 text-xs/6">
        {snippet ? (
          <HighlightedCode
            code={snippet}
            lang="html"
            className="whitespace-pre-wrap [overflow-wrap:anywhere]"
          />
        ) : (
          <code className="text-[var(--code-dim)]">Loading the code…</code>
        )}
      </pre>
    </div>
  );
}
