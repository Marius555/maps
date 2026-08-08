/**
 * Everything a repository needs to know about the caller.
 *
 * Only the user id: the session secret never leaves /lib/auth, because row
 * access runs through the admin client (see lib/appwrite/admin.ts).
 */
export type RepoContext = {
  userId: string;
};

export function repoContext(userId: string): RepoContext {
  return { userId };
}
