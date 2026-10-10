/**
 * Which "page" a pathname is, as far as the shell's fade is concerned.
 *
 * Every settings section is one page to the shell: switching between them
 * swaps only the pane beside the settings nav, which fades itself
 * (`SettingsPane`). Fading the whole of `<main>` there would blink the nav the
 * person just clicked in.
 */
export function shellRouteKey(pathname: string): string {
  return pathname.startsWith("/settings/") ? "/settings" : pathname;
}

/**
 * The same, for the public site. Every guide is one page to `MarketingMain`:
 * moving between them swaps only the article beside the guides' nav, which
 * fades itself (`DocsPane`). Fading the whole of `<main>` there lifted the nav
 * the reader had just clicked in, along with everything else.
 */
export function marketingRouteKey(pathname: string): string {
  return pathname === "/docs" || pathname.startsWith("/docs/") ? "/docs" : pathname;
}
