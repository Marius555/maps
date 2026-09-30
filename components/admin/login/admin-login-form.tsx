"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { FormPasswordField, FormTextField } from "@/components/ui/form-field";
import { useAdminLogin } from "@/lib/query/admin";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import { adminLoginSchema, type AdminLoginInput } from "@/lib/validation/admin.schema";

/**
 * The operator console's sign-in. Deliberately bare — no Google, no signup, no
 * forgot-password: the admin is one configured account, not an Appwrite user,
 * and its password changes with `npm run admin:hash`, not by email.
 *
 * Success is a document navigation rather than `router.replace`, so the console
 * is requested fresh with the new cookie and nothing from this page's router
 * cache comes along.
 *
 * **The button stays pending until this page is gone.** `isSubmitting` ends the
 * moment the handler returns, which is the moment the navigation *starts* — and
 * the console then takes seconds to arrive, with an idle form on screen that
 * read as "nothing happened". `isLeaving` is set on success and never cleared on
 * the happy path: the page being replaced is what ends it, as in
 * `google-button.tsx`. The one way back to this document is the bfcache (Back
 * from the console), and `pageshow` clears it there.
 */
export function AdminLoginForm() {
  const login = useAdminLogin();
  const [isLeaving, setLeaving] = useState(false);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting },
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const isBusy = isSubmitting || isLeaving;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      setLeaving(true);
      window.location.replace("/admin");
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastProblem("Couldn't log in", error);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate aria-busy={isBusy}>
      <FormTextField
        control={control}
        name="email"
        label="Email"
        type="email"
        autoComplete="username"
        isDisabled={isLeaving}
      />

      <FormPasswordField
        control={control}
        name="password"
        label="Password"
        autoComplete="current-password"
        isDisabled={isLeaving}
      />

      <Button type="submit" fullWidth isPending={isBusy}>
        {isLeaving ? "Opening the console…" : "Log in"}
      </Button>
    </form>
  );
}
