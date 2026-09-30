import { Tooltip } from "@heroui/react";
import { Plug, Sigma, Waves, type LucideIcon } from "lucide-react";

import { SOURCE_LABEL, type DataSource, type SourceKind } from "@/lib/admin/source";

export const SOURCE_ICON: Record<SourceKind, LucideIcon> = {
  api: Plug,
  counted: Sigma,
  estimate: Waves,
};

/**
 * Where a figure comes from — a service's answer, our own tally, or an
 * estimate — as a small pill whose tooltip names the exact source.
 *
 * Neutral on purpose: colour on the console belongs to chart series
 * (docs/notes/admin.md). The icon and the word carry the kind; an estimate's
 * dashed outline says "approximate" without a hue.
 */
export function SourceBadge({ source }: { source: DataSource }) {
  const Icon = SOURCE_ICON[source.kind];
  const label = SOURCE_LABEL[source.kind];

  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger
        tabIndex={0}
        aria-label={`${label}: ${source.detail}`}
        className={`inline-flex h-5 shrink-0 cursor-help items-center gap-1 rounded-full border px-1.5 text-[11px] leading-none font-medium text-muted ${
          source.kind === "estimate" ? "border-dashed border-muted/60" : "border-border"
        }`}
      >
        <Icon aria-hidden="true" className="size-3" />
        {label}
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-72 text-xs text-pretty">{source.detail}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The kind alone, for places a tooltip cannot go (inside a tab, which is
 * already a button). The full badge is drawn beside the chart it heads.
 */
export function SourceMark({ kind }: { kind: SourceKind }) {
  const Icon = SOURCE_ICON[kind];

  return (
    <>
      <Icon aria-hidden="true" className="size-3 shrink-0 text-muted" />
      <span className="sr-only">({SOURCE_LABEL[kind]})</span>
    </>
  );
}
