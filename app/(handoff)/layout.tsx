/**
 * The bare shell for a page the buyer only passes through on the way back from
 * somewhere off-site — today, `/checkout/done`.
 *
 * **Its own route group so it carries no marketing chrome.** The page is on
 * screen for as long as the next document takes to arrive, and in the marketing
 * group that was a navbar, a "Plans" eyebrow and a footer flashing up between
 * Stripe and the map editor: a page that looked like somewhere else entirely.
 * Nothing here but the background and a centred line.
 *
 * Route groups are not in URLs, so `/checkout/done` is unmoved — and still
 * outside `proxy.ts`'s matcher, which is the reason the page exists
 * (docs/notes/auth.md, "The SameSite trap").
 *
 * Annotated explicitly rather than with `LayoutProps<"/">`, for the reason the
 * auth and marketing layouts record: group layouts would share the key.
 */
export default function HandoffLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-4 py-12">
      {children}
    </main>
  );
}
