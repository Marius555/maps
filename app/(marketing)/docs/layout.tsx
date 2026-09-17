import { DocsShell } from "@/components/docs/docs-shell";

/**
 * Public, and deliberately inside `(marketing)` rather than `(dashboard)`.
 *
 * `proxy.ts` matches only `/maps` and `/account`, so nothing here needs a
 * session — which is the point. A guide that a signed-out visitor, a support
 * reply or a search engine cannot open is half a guide.
 *
 * Annotated explicitly rather than with `LayoutProps<"/docs">`: route groups are
 * stripped from the generated route literals, so this and the marketing layout
 * above it would claim the same key.
 */
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DocsShell>{children}</DocsShell>;
}
