import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: PRODUCT_TAGLINE,
};

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
const themeScript = `
(function(){try{
  var stored = localStorage.getItem("heroui-theme") || "system";
  var resolved = stored === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : stored;
  document.documentElement.classList.add(resolved);
  document.documentElement.setAttribute("data-theme", resolved);
}catch(e){}})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
