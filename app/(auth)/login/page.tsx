import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { redirectIfSignedIn } from "@/lib/auth/redirect-if-signed-in";
import { safeRedirect } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const redirectTo = safeRedirect(next);

  await redirectIfSignedIn(redirectTo);

  return (
    <AuthShell title="Log in">
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
