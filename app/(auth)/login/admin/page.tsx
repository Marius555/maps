import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/login/admin-login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { adminConsoleExists, isAdminSession } from "@/lib/admin/auth/guard";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * The operator console's door. A 404 while the console is not configured, so an
 * install without the `ADMIN_*` values has nothing here to find; a signed-in
 * admin goes straight through. The redirect lives here rather than in
 * `proxy.ts`, which only ever redirects towards a login (docs/notes/auth.md).
 */
export default async function AdminLoginPage() {
  if (!adminConsoleExists()) notFound();
  if (await isAdminSession()) redirect("/admin");

  return (
    <AuthShell title="Admin" description="The operator console. One account, configured on the server.">
      <AdminLoginForm />
    </AuthShell>
  );
}
