import type { LucideIcon } from "lucide-react";

/** A point's symbol on a platform page's split section: an icon in a soft square. */
export function PointSymbol({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-default text-foreground">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}
