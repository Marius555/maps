import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { UnauthorizedError } from "@/lib/repositories/errors";
import { adminConfig } from "./config";
import { readAdminCookie } from "./cookie";
import { verifyAdminSession } from "./session";

/**
 * Who may see the operator console, asked three ways for three callers.
 *
 * **The check is repeated on purpose, and a layout alone is not enough.** A
 * layout does not re-render on a client navigation between its pages, so a page
 * that relied on it would be guarded by whatever the layout decided on first
 * load. Instead every metrics loader in `lib/admin/metrics` begins with
 * `requireAdmin()`, which makes a page that forgot its own check still unable
 * to read anything — covered by having been written normally, the argument
 * `withAuth` makes for customer routes.
 */

/** Cached per request, so the layout, the page and its loader verify once. */
export const isAdminSession = cache(async (): Promise<boolean> => {
  const config = adminConfig();
  if (!config) return false;

  return verifyAdminSession(await readAdminCookie(), config);
});

/** Whether the console is configured at all. Unset, both pages 404. */
export function adminConsoleExists(): boolean {
  return adminConfig() !== null;
}

/** For route handlers and loaders: 401 unless this is the admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSession())) {
    throw new UnauthorizedError("Log in as the administrator to continue.");
  }
}

/** For pages: a 404 when switched off, the admin login otherwise. */
export async function requireAdminPage(): Promise<void> {
  if (!adminConsoleExists()) notFound();
  if (!(await isAdminSession())) redirect("/login/admin");
}
