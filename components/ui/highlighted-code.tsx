import { highlight, type CodeLanguage } from "@/lib/code/highlight";

/**
 * Code with its syntax coloured, for inside a `<pre>` on a `.code-surface`.
 *
 * Renders spans only, never markup from the code itself, so a snippet is shown
 * exactly as it will be pasted. No `"use client"`: it is a pure function of its
 * props, usable from a server page or a client component alike.
 */
export function HighlightedCode({
  code,
  lang,
  className = "",
}: {
  code: string;
  lang: CodeLanguage;
  className?: string;
}) {
  return (
    <code className={`font-mono ${className}`}>
      {highlight(code, lang).map((token, index) =>
        token.kind ? (
          // Tokens are positional and the list is rebuilt whole from `code`.
          <span key={index} className={`code-tok-${token.kind}`}>
            {token.text}
          </span>
        ) : (
          token.text
        ),
      )}
    </code>
  );
}
