import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar/sidebar-context";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * The real guard. proxy.ts only checks whether a session cookie is present —
 * this asks Appwrite whether it means anything.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Read server-side so the sidebar renders at its stored width on the first
  // paint. Doing this on the client would render expanded and then snap shut.
  const isCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell user={user} defaultCollapsed={isCollapsed}>
      {children}
    </AppShell>
  );
}
