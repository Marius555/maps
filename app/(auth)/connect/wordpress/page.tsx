import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { ConnectFlow } from "@/components/connect/connect-flow";
import { connectRequestSchema } from "@/lib/validation/connect.schema";

export const metadata: Metadata = {
  title: "Connect your WordPress site",
  robots: { index: false, follow: false },
};

/**
 * Where the Pinglide WordPress plugin's "Set up this map" button opens.
 * `docs/notes/distribution.md` has the whole round trip.
 *
 * **In the `(auth)` group, outside `proxy.ts`'s matcher, and it has to be.** The
 * click comes from the owner's wp-admin, another site, so the browser withholds
 * our `sameSite: "strict"` cookie from this request — a server-side session check
 * here would see nobody and send a signed-in owner to the login page. So this
 * page reads nothing about the session: it validates the link, and `ConnectFlow`
 * asks who is signed in with a same-origin `fetch`, which does carry the cookie.
 * The SameSite trap in `docs/notes/auth.md` is the same thing, three times over.
 *
 * The link is validated here, before anyone signs in, so an owner who would be
 * refused at the end is told at the start.
 */
export default async function ConnectWordPressPage(
  props: PageProps<"/connect/wordpress">,
) {
  const raw = await props.searchParams;
  const parsed = connectRequestSchema.safeParse({
    site: first(raw.site),
    return: first(raw.return),
    state: first(raw.state),
    slot: first(raw.slot),
    title: first(raw.title),
  });

  if (!parsed.success) {
    return (
      <AuthShell
        title="This link doesn't work"
        description={`${parsed.error.issues[0]?.message ?? "Something in it is missing."} Go back to WordPress and press Set up this map again.`}
        footer={
          <Link href="/maps" className="text-foreground underline">
            Go to your maps
          </Link>
        }
      >
        {null}
      </AuthShell>
    );
  }

  const request = parsed.data;
  const query = new URLSearchParams({
    site: request.site,
    return: request.return,
    state: request.state,
    slot: request.slot,
    ...(request.title ? { title: request.title } : {}),
  });

  return <ConnectFlow request={request} selfPath={`/connect/wordpress?${query}`} />;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
