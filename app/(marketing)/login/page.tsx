import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeRedirect } from "@/lib/utils/safe-redirect";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;

  return (
    <AuthCard
      title="Log in"
      description="Pick up where you left off."
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="text-foreground underline">
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm redirectTo={safeRedirect(next)} />
    </AuthCard>
  );
}
