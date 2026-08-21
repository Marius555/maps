"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { ErrorMessage } from "@/components/ui/error-message";
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

      <FormTextField
        control={control}
        name="password"
        label="Password"
        type="password"
        placeholder="At least 8 characters"
        autoComplete="new-password"
      />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
