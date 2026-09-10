import { Monitor, Smartphone, Tablet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The three widths the designer can hold the preview at.
 *
 * These are widths of **the embed's own box**, not of a viewport, and that is
 * the only reason three fixed numbers can stand in for three devices at all:
 * `.lm-root` declares `container-type: inline-size` and every responsive rule in
 * embed/src/styles.css is a `@container` query against it. So narrowing the
 * frame produces the same layout a phone produces, on any monitor — which is
 * exactly the question this control exists to answer, and the reason it needs no
 * device emulation, no user-agent and no second document.
 *
 * The numbers are chosen against the three breakpoints that exist: 768px, where
 * a map with the drawer switched on takes the panel out of the flow and parks it
 * off the edge; 640px, where a map *without* it stops sitting the panel beside
 * the map and makes it the bottom half; and 480px, where the floating toolbar
 * spans the top.
 *
 * - **Desktop** is unconstrained, so it is whatever the designer's own window
 *   gives it — the honest answer, since a customer's page decides this.
 * - **Tablet** is 768px: the widest screen the drawer answers for, and the one
 *   the owner is least likely to check on real hardware. Below it a `panelDrawer`
 *   map is a map with a trigger on it; a map without the setting still draws the
 *   panel beside the map here, which is the comparison this tile is for.
 * - **Phone** is 390px: under all three, so it stacks (or drawers) *and* spreads
 *   the toolbar.
 *
 * `null` rather than a large number for Desktop, because a cap of 1600px on a
 * 1200px pane is a cap that silently does nothing on one machine and clips on
 * another.
 */
export type DeviceId = "desktop" | "tablet" | "phone";

export const DEVICES: readonly {
  value: DeviceId;
  label: string;
  icon: LucideIcon;
  /** Maximum width for the preview frame, or `null` for the full pane. */
  width: number | null;
}[] = [
  { value: "desktop", label: "Desktop", icon: Monitor, width: null },
  { value: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { value: "phone", label: "Phone", icon: Smartphone, width: 390 },
];

export const DEFAULT_DEVICE: DeviceId = "desktop";

export function deviceWidth(id: DeviceId): number | null {
  return DEVICES.find((device) => device.value === id)?.width ?? null;
}
