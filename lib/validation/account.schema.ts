import { z } from "zod";

import { password, personName } from "./auth.schema";

/**
 * The settings pages' forms. One schema each, run by the form and again by the
 * route (CLAUDE.md §9).
 */

export const profileSchema = z.object({
  name: personName,
});

/**
 * A new password, and the current one — always.
 *
 * Only an account that signs in with a password is offered this form. An
 * account made by Google sign-in has none, is shown no password section, and
 * the route refuses it outright rather than letting a session set a first
 * password with nothing to prove it is the owner's.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Type your current password.").max(256),
    password,
    confirmPassword: z.string().min(1, "Type the new password again."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Both passwords need to match.",
  });

/**
 * Deleting the account, confirmed by typing its address.
 *
 * The address rather than a checkbox, because this cannot be undone: typing it
 * is the one confirmation that cannot be given without reading what is about to
 * be deleted. Compared on the server, case-insensitively, against the signed-in
 * account's own address.
 */
export const deleteAccountSchema = z.object({
  email: z.string().trim().min(1, "Type your email address to confirm."),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
