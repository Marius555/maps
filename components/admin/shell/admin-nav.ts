import { Bell, CreditCard, LayoutDashboard, Mail, Map, PlugZap, Users } from "lucide-react";

import type { NavItem } from "@/components/layout/sidebar/sidebar-nav-item";

/**
 * The console's sections, in the customer sidebar's own row shape
 * (`SidebarNavItem`), so the two shells cannot drift apart: plain icons, the
 * same active fill, the same pending spinner. There used to be a tinted icon
 * chip per row in each section's KPI colour, which made the rail a second
 * design language and told the reader nothing.
 */
export const ADMIN_NAV: NavItem[] = [
  // Exact, or it would stay lit on every section below it.
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/apis", label: "APIs", icon: PlugZap },
  { href: "/admin/email", label: "Email", icon: Mail },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/content", label: "Maps & traffic", icon: Map },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
];
