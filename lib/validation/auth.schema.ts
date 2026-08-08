import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(128),
  email: z.email("Enter a valid email address."),
  // Appwrite's own minimum is 8 characters; matching it means the user sees our
  // message rather than an upstream one.
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(256, "Keep the password under 256 characters."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
