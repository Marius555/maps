import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { redirectIfSignedIn } from "@/lib/auth/redirect-if-signed-in";
import { safeRedirect } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const { next } = await props.searchParams;
  // Null when absent: a plain signup still goes to "check your inbox".
  const redirectTo = next ? safeRedirect(next) : null;

  await redirectIfSignedIn(redirectTo ?? undefined);

  return (
    <AuthShell title="Create your account">
      <SignupForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
