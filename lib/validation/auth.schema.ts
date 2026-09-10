import { z } from "zod";

/**
 * The password rule, named once.
 *
 * Signup, reset and any future change-password form have to agree on it, and the
 * way they stop agreeing is by each spelling it out. Appwrite's own minimum is 8
 * characters; matching it means the user sees our message rather than an
 * upstream one.
 */
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(256, "Keep the password under 256 characters.");

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(128),
  email: z.email("Enter a valid email address."),
  password,
});

/**
 * What Appwrite appends to an OAuth success URL, and to every emailed link.
 *
 * Validated on the server like anything else that arrives in a request, even
 * though the values came from Appwrite rather than from a form — by the time they
 * reach us they have been through the user's address bar, and `parseBody` is the
 * only thing standing between a hand-edited query string and the SDK.
 *
 * No format assertion beyond "not empty": the shape of an Appwrite token is
 * theirs to change, and a regex here would be a second definition of it that
 * fails closed on the day they lengthen it.
 */
export const oauthSessionSchema = z.object({
  userId: z.string().min(1, "That sign-in link is incomplete. Try again."),
  secret: z.string().min(1, "That sign-in link is incomplete. Try again."),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    userId: z.string().min(1),
    secret: z.string().min(1),
    password,
    confirmPassword: z.string().min(1, "Type the password again."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    // On the second field, not the form. A mismatch is only ever discovered by
    // looking at the two boxes, so the message belongs next to the one the user
    // is being asked to fix — a form-level error would sit at the top of the
    // page pointing at nothing.
    path: ["confirmPassword"],
    message: "Both passwords need to match.",
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type OAuthSessionInput = z.infer<typeof oauthSessionSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
