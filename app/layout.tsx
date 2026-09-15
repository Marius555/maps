import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";

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
      className={`${instrumentSans.variable} h-full antialiased`}
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
