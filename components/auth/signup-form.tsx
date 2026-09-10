"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleButton } from "@/components/auth/google-button";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormPasswordField, FormTextField } from "@/components/ui/form-field";
import { useSignup } from "@/lib/query/auth";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { signupSchema, type SignupInput } from "@/lib/validation/auth.schema";

export function SignupForm() {
  const router = useRouter();
  const signup = useSignup();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await signup.mutateAsync(values);
      router.replace("/maps");
      router.refresh();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  const hasFieldError = Boolean(errors.name || errors.email || errors.password);

  return (
    <div className="space-y-5">
      {/* The same words as the login page, deliberately. CLAUDE.md §8: an action
          keeps its name through the whole flow, and with Google there is no
          difference between signing in and signing up — the first press makes
          the account either way. */}
      <GoogleButton />

      <AuthDivider />

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {signup.error && !hasFieldError ? <ErrorMessage error={signup.error} /> : null}

        <FormTextField
          control={control}
          name="name"
          label="Name"
          autoComplete="name"
        />

        <FormTextField
          control={control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />

        <FormPasswordField
          control={control}
          name="password"
          label="Password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />

        <Button type="submit" fullWidth isPending={isSubmitting}>
          Create account
        </Button>
      </form>
    </div>
  );
}
