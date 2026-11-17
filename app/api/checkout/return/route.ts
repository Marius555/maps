import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SIDEBAR_MAP_COOKIE } from "@/components/layout/sidebar/sidebar-cookies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";
import { sidebarMapId } from "@/lib/repositories/maps.repository";
import { loadActiveContext } from "@/lib/team/resolve";

/**
 * The second hop back from a paid checkout: a 307 straight to the map the
 * buyer was last on, with `?checkout=done` for `PurchaseCelebration`.
 *
 * **A route handler, not a `redirect()` in the `/maps` page.** `/maps` has a
 * `loading.tsx`, so a redirect thrown from its page comes after the list
 * skeleton has been flushed, and the buyer watched the maps list flash up
 * between the payment and their map. A handler has no shell to flush, so the
 * redirect is a real 307 and the next thing painted is the editor.
 *
 * **Reached only by a document navigation our own page starts**
 * (`CheckoutReturn`'s `location.replace`, or its link), which is what puts the
 * `sameSite: "strict"` session cookie on it. Stripe's `success_url` must never
 * point here: arriving from `checkout.stripe.com`, this request would carry no
 * cookie (docs/notes/auth.md, "The SameSite trap").
 *
 * Under `/api`, so outside `proxy.ts`'s matcher: the signed-out answer is ours,
 * a login that comes back to the same celebration.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    const login = new URL("/login", env.appUrl);
    login.searchParams.set("next", "/maps?checkout=done");
    return NextResponse.redirect(login, 307);
  }

  const ctx = await loadActiveContext(user.id);
  const jar = await cookies();
  const mapId = await sidebarMapId(ctx, jar.get(SIDEBAR_MAP_COOKIE)?.value || null).catch(
    () => null,
  );

  // No map yet: the celebration opens over the empty list instead.
  const target = new URL(mapId ? `/maps/${mapId}` : "/maps", env.appUrl);
  target.searchParams.set("checkout", "done");

  return NextResponse.redirect(target, 307);
}
