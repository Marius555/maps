import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { ThemeScript } from "@/components/providers/theme-script";
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
