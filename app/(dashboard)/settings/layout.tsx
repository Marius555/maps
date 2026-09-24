import { SettingsNav } from "@/components/user-settings/shell/settings-nav";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";

/**
 * The frame every settings page shares: the section list, and the section
 * itself beside it.
 *
 * **Reads nothing.** The dashboard layout above has already resolved the user,
 * and anything this awaited would block every section switch behind it — the
 * `loading.tsx` of the page being opened only shows once the layout has
 * rendered (see `node_modules/next/dist/docs/.../loading.md`). So the nav stays
 * put and only the column beside it swaps.
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
export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <Container className="steady">
      <PageTitle>Settings</PageTitle>

      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <SettingsNav />
        <div className="min-w-0 max-w-6xl flex-1">{children}</div>
      </div>
    </Container>
  );
}
