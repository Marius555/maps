import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { ThemeScript } from "@/components/providers/theme-script";
import { BRAND } from "@/lib/brand";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/config";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The display face, and the two faces below are the marketing pages' only.
 *
 * Declared here rather than in `app/(marketing)/layout.tsx` because next/font
 * hangs its variables on an element, and `<html>` is the one element every
 * route group shares. Nothing in the dashboard uses `font-display` or
 * `font-mono`, so nothing there pays for them beyond two `<link rel=preload>`
 * lines — and hanging them on a marketing wrapper instead would put the fonts
 * one element *inside* the page, where a `position: fixed` child could escape
 * them.
 *
 * `wdth` is the axis this is here for. An expanded grotesque is the lettering
 * of wayfinding and of a printed map sheet's own title, which is the one place
 * the landing page's type is allowed to be loud; Instrument Sans stays the
 * voice of everything that is read rather than seen.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

/** Coordinates, the snippet, and the marginalia down the side of a map sheet. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: PRODUCT_NAME,
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: PRODUCT_TAGLINE,
  // brand.json's favicon. The default file lives in /public rather than at
  // app/favicon.ico, because the file convention would add a second
  // <link rel="icon"> that no edit to brand.json could remove.
  icons: BRAND.favicon ? { icon: BRAND.favicon } : undefined,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before the first paint; see the file for why
            it is a client component and why its `type` changes across the wire. */}
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
