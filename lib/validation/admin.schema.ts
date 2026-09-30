import { z } from "zod";

/** The operator console's sign-in form, shared by the form and the route. */
export const adminLoginSchema = z.object({
  email: z.email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(256),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** The console's date range, from `?range=`. Anything else reads as 30. */
export const ADMIN_RANGES = [7, 30, 90] as const;

export type AdminRange = (typeof ADMIN_RANGES)[number];

export function parseAdminRange(raw: unknown): AdminRange {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);

  return (ADMIN_RANGES as readonly number[]).includes(value) ? (value as AdminRange) : 30;
}
