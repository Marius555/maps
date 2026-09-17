import { AuthBackButton } from "@/components/auth/auth-back-button";
import { AuthVisual } from "@/components/auth/auth-visual";

/**
 * The split shell: drawing on the left, form on the right.
 *
 * **Its own route group rather than the marketing one.** `(marketing)/layout.tsx`
 * draws a bordered header with its own Log in and Sign up links directly above
 * whatever the page renders, which is a strip of chrome across the top of a
 * layout that is meant to reach both edges — and two Sign up links on the signup
 * page. Route groups do not appear in URLs, so `/login` and `/signup` are
 * unmoved: `proxy.ts`'s matcher, every `LinkButton href="/login"`, and
 * `PageProps<"/login">` all keep working untouched.
 *
 * **Annotated explicitly rather than with `LayoutProps<"/">`**, for the reason
 * the marketing layout already records: route groups are stripped from the
 * generated route literals, so both group layouts would claim the same key.
 *
 * `min-h-dvh` and not `h-dvh`: the reset form is taller than the login form, and
 * a fixed height would clip it on a short laptop window rather than scroll.
 *
 * **The back arrow is pinned to the form column's corner**, not placed in the
 * form's flow: the form is vertically centred, so an arrow inside it would float
 * somewhere different on every screen. `pt-16` rather than `py-12` is the room
 * it needs — on a phone a tall form starts at the top, and without it the mark
 * above the heading sits under the arrow.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <AuthVisual />

      <div className="relative flex flex-1 items-center justify-center px-4 pt-16 pb-12 sm:px-8 lg:w-1/2">
        <div className="absolute top-3 left-3 sm:top-5 sm:left-5">
          <AuthBackButton />
        </div>

        {children}
      </div>
    </div>
  );
}
