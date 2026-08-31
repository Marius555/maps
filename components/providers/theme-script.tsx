"use client";

/**
 * Applies the stored theme before the first paint.
 *
 * `useTheme` from @heroui/react owns the theme at runtime, but it can only read
 * localStorage after hydration — so without this the page paints light and then
 * snaps to dark, which is worse than not having dark mode. Reads the same
 * storage key the hook writes (`heroui-theme`) and sets both the class and the
 * attribute, because globals.css keys off `.dark` and `[data-theme="dark"]`.
 *
 * Wrapped in try/catch: localStorage throws outright in some privacy modes, and
 * a broken theme must not take the page down with it.
 *
 * `suppressHydrationWarning` on <html> is required — this script mutates the
 * element the server just rendered.
 */
const THEME_SCRIPT = `
(function(){try{
  var stored = localStorage.getItem("heroui-theme") || "system";
  var resolved = stored === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : stored;
  document.documentElement.classList.add(resolved);
  document.documentElement.setAttribute("data-theme", resolved);
}catch(e){}})();
`;

/**
 * The script above, in a form React will render on both sides of the wire.
 *
 * React never executes a <script> it creates on the client — it substitutes a
 * <div> and logs "Encountered a script tag while rendering React component".
 * That happens whenever the root layout is *rendered* rather than hydrated: a
 * hydration mismatch, an error-boundary recovery, a Strict Mode remount. The
 * `type` swap is Next's own answer to it (see
 * `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`):
 * `text/javascript` server-side, so the browser runs it while parsing <head>,
 * and `text/plain` client-side, which React treats as an inert data block and
 * says nothing about. `suppressHydrationWarning` absorbs the resulting mismatch;
 * React does not patch attributes while hydrating, so the live tag keeps the
 * type it was served with.
 *
 * "use client" is what makes that work and is not optional. app/layout.tsx is a
 * Server Component: leave this one on the server and `typeof window` is decided
 * once, during SSR, and `text/javascript` is baked into the RSC payload the
 * client re-renders from — which is the case the swap exists to cover.
 */
export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
