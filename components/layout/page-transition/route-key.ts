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
