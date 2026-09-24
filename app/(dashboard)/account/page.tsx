import { redirect } from "next/navigation";

/**
 * The old account page, which is Settings → Billing now (its usage meters are
 * Settings → Usage).
 *
 * Kept as a redirect rather than deleted, because the address is out in the
 * world: bookmarks, older emails, a browser's history. `?checkout=` travels
 * with it, so a buyer arriving by an old route still gets `ActivationWatch`.
 *
 * Still inside `proxy.ts`'s matcher, and still never the provider's
 * `redirect_url` — that is `/checkout/done`, for the SameSite reason
 * `lib/billing/lemon.ts` gives.
 */
export default async function AccountPage(props: PageProps<"/account">) {
  const { checkout } = await props.searchParams;

  redirect(
    typeof checkout === "string"
      ? `/settings/billing?checkout=${encodeURIComponent(checkout)}`
      : "/settings/billing",
  );
}
