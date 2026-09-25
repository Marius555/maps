import { notFound } from "next/navigation";

import { ThemeImageGenerator } from "@/components/maps/theme-images/theme-image-generator";

/**
 * Development only: renders the maps list's theme pictures (lib/map/theme-images.ts)
 * and saves them into `public/map-themes/`.
 *
 * Run it again when a theme's colours change or a theme is added. It 404s in a
 * production build, the same gate `app/dev/hero-map/page.tsx` uses. The tab must
 * stay visible while it runs: a hidden tab stops painting, and so stops rendering.
 */
export default function MapThemesDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <ThemeImageGenerator />;
}
