"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { ErrorMessage } from "@/components/ui/error-message";
import { useLogin } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { loginSchema, type LoginInput } from "@/lib/validation/auth.schema";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const login = useLogin();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      router.replace(redirectTo);
      // The dashboard is server-rendered, so the new session has to reach the
      // server before the redirect paints.
      router.refresh();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {login.error && !errors.email && !errors.password ? (
        <ErrorMessage error={login.error} />
      ) : null}

      <FormTextField
        control={control}
        name="email"
        label="Email"
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
      />

      <FormTextField
        control={control}
        name="password"
        label="Password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
      />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Log in
      </Button>
    </form>
  );
}
