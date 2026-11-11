import { Gauge, KeyRound, Layers, Receipt } from "lucide-react";

import { Section } from "@/components/marketing/section";
import type { Point } from "@/components/marketing/split/point-list";
import { SplitBody } from "@/components/marketing/split/split-body";

import { PointSymbol } from "../point-symbol";
import { SyncScene } from "../stage/sync-scene-loader";

/**
 * What the plugin does not ask of a site owner, beside a drawing of the one
 * thing it does: a change made on Pinglide reaching the page by itself.
 *
 * Each point is true of what ships: no key is stored (distribution.md, "No
 * secret lives in a plugin"), the page loads static files from the CDN and
 * never calls us (CLAUDE.md §2), the embed waits until it is scrolled near
 * (`data-eager` is off), and every block holds its own slot.
 */
const POINTS: readonly Point[] = [
  { symbol: <PointSymbol icon={KeyRound} />, title: "No API key", body: "Nothing to copy, nothing to keep secret." },
  { symbol: <PointSymbol icon={Receipt} />, title: "No per-view charge", body: "Served from a CDN. Busy months cost nothing extra." },
  { symbol: <PointSymbol icon={Gauge} />, title: "Keeps your page fast", body: "The map loads when a visitor scrolls near it." },
  { symbol: <PointSymbol icon={Layers} />, title: "As many maps as you need", body: "Every block shows its own map." },
];

export function WordPressWhy() {
  return (
    <Section
      screen
      eyebrow="Why a block"
      title={
        <>
          Change it once, <span className="text-accent">every page follows</span>
        </>
      }
    >
      <SplitBody art={<SyncScene site="wordpress" action="Publish" />} points={POINTS} />
    </Section>
  );
}
