import "server-only";

import { Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { nameFromEmail } from "./name-from-email";

/**
 * Names and addresses for a handful of known user ids — the people on one team.
 *
 * **Only ever by id, never by address.** A lookup by email would answer "does
 * this address have an account here?", which the forgot-password and resend
 * routes go out of their way never to answer (docs/notes/auth.md). Every id
 * passed here already came out of a membership row or a workspace id, so it
 * reveals nothing the caller could not already see.
 */

export type Person = { id: string; name: string; email: string };

/** At most a team's worth; Appwrite caps an `equal` list at 100 values. */
const MAX_IDS = 100;

/** The people among `ids` that still exist. A deleted account is simply absent. */
export async function readPeople(ids: readonly string[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids)].slice(0, MAX_IDS);
  const people = new Map<string, Person>();

  if (unique.length === 0) return people;

  const { users } = await admin.users.list({
    queries: [Query.equal("$id", unique), Query.limit(MAX_IDS)],
  });

  for (const user of users) {
    people.set(user.$id, {
      id: user.$id,
      name: user.name || nameFromEmail(user.email),
      email: user.email,
    });
  }

  return people;
}
