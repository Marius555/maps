/**
 * A link between `/login` and `/signup` that keeps what the visitor has chosen
 * so far: where they were going (`?next=`), and whether they picked email.
 *
 * A plain module, not `"use client"`, so a server page and a client form can
 * both import it — a function imported into a server component from a client
 * module is a client reference, not the function (CLAUDE.md, "Stack specifics").
 */

/** Which column an auth page opens on. `?with=email` is the only way to ask. */
export type AuthView = "providers" | "email";

export function authViewFrom(param: string | string[] | undefined): AuthView {
  return param === "email" ? "email" : "providers";
}

export function authHref(
  path: "/login" | "/signup",
  { next, email = false }: { next?: string | null; email?: boolean } = {},
): string {
  const query = new URLSearchParams();
  if (email) query.set("with", "email");
  // `/maps` is where both pages go when nothing else asked, so it is left off.
  if (next && next !== "/maps") query.set("next", next);

  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
