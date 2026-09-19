import { notFound } from "next/navigation";

import { HeroMapGenerator } from "@/components/marketing/hero/generator/hero-map-generator";
import { HeroRouteGenerator } from "@/components/marketing/hero/generator/hero-route-generator";

/**
 * Development only: renders the landing page hero's basemap images.
 *
 * The images are committed (`public/marketing/`) so the landing page runs no
 * map library at all; this page is how they are made again when the camera,
 * the size or a look changes (lib/marketing/hero-map.ts). It 404s in a
 * production build, the same gate `components/legal/legal-page.tsx` uses.
 *
 * The routes under "Nearest to me" are committed for the same reason and are
 * made again here too (lib/marketing/hero-routes.ts).
 */
export default function HeroMapDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="space-y-16 pb-16">
      <HeroMapGenerator />
      <div className="mx-auto max-w-6xl px-5">
        <HeroRouteGenerator />
      </div>
    </div>
  );
}
