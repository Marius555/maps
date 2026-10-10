"use client";

import { Button } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { HighlightedCode } from "@/components/ui/highlighted-code";
import type { CodeLanguage } from "@/lib/code/highlight";

type CopyState = "idle" | "copied" | "failed";

/**
 * A block of code on the public site, with a Copy button.
 *
 * On `.code-surface`, a dark ground in both themes, with its syntax coloured by
 * `lib/code/highlight.ts` (`lang`, HTML unless told otherwise). Long lines
 * wrap rather than scroll: a sideways scrollbar under one line of code was the
 * ugliest thing on the page, and the
 * Copy button is what carries the code across intact, not the reader's eye.
 * Line breaks the code has are kept (`pre-wrap`).
 *
 * The button says what happened in place — "Copied", or "Select it and copy"
 * when the clipboard is refused (plain http, some in-app browsers), the same
 * fallback `components/publish/embed-snippet.tsx` gives. It sits in `.steady`,
 * so it does not shrink when pressed. It sits alone at the end of its bar, so a
 * label changing width moves nothing else.
 */
export function CodeBlock({
  code,
  label = "Code",
  lang = "html",
}: {
  code: string;
  label?: string;
  lang?: CodeLanguage;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = window.setTimeout(() => setState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="steady code-surface overflow-hidden rounded-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 py-1.5 pr-1.5 pl-4">
        <span className="font-mono text-xs text-[var(--code-dim)]">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          onPress={onCopy}
          aria-live="polite"
          // The ghost button's own hover and press fills are light greys,
          // drawn for a light page; on this ground they would swallow the label.
          className="text-[var(--code-ink)] hover:bg-white/10 data-[pressed=true]:bg-white/10"
        >
          {state === "copied" ? (
            <Check aria-hidden="true" className="size-3.5" />
          ) : (
            <Copy aria-hidden="true" className="size-3.5" />
          )}
          {state === "copied" ? "Copied" : state === "failed" ? "Select it and copy" : "Copy"}
        </Button>
      </div>

      <pre className="p-4 text-xs/6">
        <HighlightedCode
          code={code}
          lang={lang}
          className="whitespace-pre-wrap [overflow-wrap:anywhere]"
        />
      </pre>
    </div>
  );
}
