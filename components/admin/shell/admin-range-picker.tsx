"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { SelectControl } from "@/components/ui/select-control";
import { ADMIN_RANGES, type AdminRange } from "@/lib/validation/admin.schema";

/**
 * The console's period, in the URL for the reason the Analytics range picker
 * gives: a figure is a fact about a period, and a link that drops the period
 * drops the meaning. The old numbers dim rather than vanish while the new ones
 * load.
 */
export function AdminRangePicker({ range }: { range: AdminRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="w-40" style={{ opacity: isPending ? 0.6 : 1 }} aria-busy={isPending}>
      <SelectControl
        label="Period"
        hideLabel
        value={String(range)}
        options={ADMIN_RANGES.map((days) => ({ id: String(days), label: `Last ${String(days)} days` }))}
        onChange={(value) => {
          if (value === String(range)) return;

          startTransition(() => {
            router.push(`${pathname}?range=${value}`, { scroll: false });
          });
        }}
      />
    </div>
  );
}
