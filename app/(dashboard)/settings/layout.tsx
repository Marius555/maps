import { SettingsPane } from "@/components/layout/page-transition/settings-pane";
import { SettingsNav } from "@/components/user-settings/shell/settings-nav";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * The frame every settings page shares: the section list, and the section
 * itself beside it.
 *
 * **Reads nothing new.** The dashboard layout above has already resolved the
 * user, and anything this awaited would block every section switch behind it —
 * the `loading.tsx` of the page being opened only shows once the layout has
 * rendered (see `node_modules/next/dist/docs/.../loading.md`). So the nav stays
 * put and only the column beside it swaps. The one await is that same user —
 * `getCurrentUser` is `cache()`d per request and its identity cache answers a
 * repeat without Appwrite — for whether this is a shop inside the Shopify
 * admin, which gets fewer sections (`settingsItemsFor`).
 *
 * **No visible heading**, like the rest of the dashboard (`PageTitle`): the
 * person got here by pressing Settings, and the nav's active item already says
 * which part they are in. A drawn "Settings" was a band of space repeating it.
 *
 * **Full width, left-aligned**, the same edge as every other dashboard page. It
 * was a centred `max-w-5xl` with the column inside held to `max-w-3xl`, which
 * squeezed Billing's three plan columns into a strip on any real monitor. The
 * column is capped at `max-w-6xl` so prose does not run the width of a 2560px
 * screen; forms that should stay narrow cap themselves.
 *
 * **`steady`** switches off HeroUI's press scale and keeps pending buttons at
 * their width for everything inside (`app/globals.css`). Dialogs opened from
 * here portal out of this element and carry the class themselves.
 */
export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const user = await getCurrentUser();

  return (
    <Container className="steady">
      <PageTitle>Settings</PageTitle>

      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <SettingsNav isShopify={Boolean(user?.shopify)} />
        <SettingsPane>{children}</SettingsPane>
      </div>
    </Container>
  );
}
