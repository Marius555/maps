"use client";

import { MailOpen } from "lucide-react";

import { useMe } from "@/lib/query/auth";
import { ResendLinkButton } from "./resend-link-button";

/**
 * The standing explanation of why nothing in the dashboard works yet.
 *
 * Mounted once in `components/layout/app-shell.tsx`, so it is on every dashboard
 * page for as long as the address is unconfirmed. That placement is the whole
 * design: the server gate refuses **every** write (`lib/auth/email-gate.ts`), and
 * greying every control that could provoke one would mean touching several dozen
 * components and missing some. One banner that is always visible pays for all of
 * them — it answers "why is this dead?" before the question is asked, wherever
 * the user happens to be.
 *
 * Only two controls are additionally greyed, Create map and Publish, because they
 * are the doors everything else is behind. Everything deeper stays live and fails
 * honestly through `toastEmailUnverified`.
 *
 * **It asks `useMe()` rather than taking the user as a prop**, though the layout
 * has one server-side and could thread it down. The prop would be right once and
 * then wrong: confirming happens in a *different tab*, and the value rendered
 * into this tab's HTML cannot learn about it. `useMe` refetches on focus
 * (`lib/query/auth.ts` — the overrides there exist for this), so coming back from
 * the mail client clears the banner and re-enables the buttons with no reload.
 *
 * There is no flash on the path that matters: `useSignup` seeds `queryKeys.me`
 * with the new user, so a fresh signup renders this from cache without a request.
 *
 * `null` while the query is unanswered, never a skeleton — a banner that reserves
 * space for itself on every page load would push the whole dashboard down a line
 * for the overwhelming majority of sessions, which are confirmed accounts.
 */
export function VerifyEmailBanner() {
  const me = useMe();
  const user = me.data?.user;

  if (!user || user.emailVerified) return null;

  return (
    <div className="border-b border-border bg-surface px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <MailOpen
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning-ink"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Confirm your email to start building
            </p>
            <p className="text-xs text-pretty text-muted">
              We sent a link to {user.email}. Open it and your account is ready —
              until then you can look around, but nothing will save.
            </p>
          </div>
        </div>

        <div className="shrink-0 ps-7 sm:ps-0">
          <ResendLinkButton email={user.email} />
        </div>
      </div>
    </div>
  );
}
