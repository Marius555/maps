import { ok } from "@/lib/api/responses";
import { withoutAuth } from "@/lib/api/route";
import { APP_COMMIT, APP_VERSION, BUILT_AT } from "@/lib/version";

/**
 * Which deploy is live: `curl https://<site>/api/version`.
 *
 * Public, because a release number and a commit sha are not secrets, and the
 * question comes up exactly when logging in may be what is broken. It is a
 * dashboard route with no visitor path (§2), and it reads no database. Never
 * cached, or a deploy would look as if it had not landed.
 * docs/notes/versioning.md has the details.
 */
export const GET = withoutAuth(async () => {
  const response = ok({ version: APP_VERSION, commit: APP_COMMIT, builtAt: BUILT_AT });
  response.headers.set("Cache-Control", "no-store");

  return response;
});
