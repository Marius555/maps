import { Gauge, Layers, Receipt, Store } from "lucide-react";

import { Section } from "@/components/marketing/section";
import type { Point } from "@/components/marketing/split/point-list";
import { SplitBody } from "@/components/marketing/split/split-body";

import { PointSymbol } from "../point-symbol";
import { SyncScene } from "../stage/sync-scene-loader";

/**
 * What the app does not ask of a merchant, beside a drawing of the one thing
 * it does: a change made in the app reaching the store by itself.
 *
 * Each point is true of what ships (docs/notes/shopify.md): billing is Shopify
 * App Pricing, nothing runs per storefront visitor (the block reads a metafield
 * and loads static files — CLAUDE.md §2), every block picks its own map, and
 * the block waits until it is scrolled near unless told otherwise.
 */
const POINTS: readonly Point[] = [
  { symbol: <PointSymbol icon={Store} />, title: "Billed through Shopify", body: "On your Shopify invoice, changed from inside the app." },
  { symbol: <PointSymbol icon={Receipt} />, title: "No per-view charge", body: "Served from a CDN. Busy sales cost nothing extra." },
  { symbol: <PointSymbol icon={Gauge} />, title: "Keeps your store fast", body: "The map loads when a shopper scrolls near it." },
  { symbol: <PointSymbol icon={Layers} />, title: "A map per page", body: "Every block picks its own map, by name." },
];

export function ShopifyWhy() {
  return (
    <Section
      screen
      eyebrow="Why an app block"
      title={
        <>
          Change it once, <span className="text-accent">your store follows</span>
        </>
      }
    >
      <SplitBody art={<SyncScene site="shopify" action="Redeploy" />} points={POINTS} />
    </Section>
  );
}
