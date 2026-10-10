import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("your-account");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * Settings → General and Account, plus signing in when it goes wrong.
 *
 * Labels are quoted as `components/user-settings/**` and `components/auth/**`
 * draw them. Billing and Usage have a guide of their own.
 */
export default function YourAccountPage() {
  return (
    <DocsArticle
      title="Your account"
      summary="Change your name, theme and password, sign out other devices, reset a forgotten password or delete your account."
    >
      <DocsSection id="general" title="Name and theme">
        <p>
          Open <strong>Settings</strong> from the account menu.{" "}
          <strong>Billing</strong> and <strong>Usage</strong> are in{" "}
          <Link href="/docs/plans-and-billing">Plans and billing</Link>.
        </p>

        <p>
          On <strong>General</strong>, change <strong>Full name</strong> and
          press <strong>Save changes</strong>; visitors never see it.{" "}
          <strong>Appearance</strong> sets this browser’s dashboard to{" "}
          <strong>Light</strong>, <strong>Dark</strong> or{" "}
          <strong>Match system</strong>.
        </p>
      </DocsSection>

      <DocsSection id="password" title="Changing your password">
        <p>
          On <strong>Account</strong>, fill in <strong>Current password</strong>,{" "}
          <strong>New password</strong> (at least 8 characters) and{" "}
          <strong>Confirm new password</strong>, then press{" "}
          <strong>Change password</strong>. Other devices are signed out.
        </p>

        <DocsTable
          caption="Password change problems"
          head={["What you see", "What to do"]}
          rows={[
            [
              "That isn’t your current password",
              "Try again, or sign out and use Forgot password?.",
            ],
            [
              "You’ve used that password before on this account",
              "Choose one you haven’t used here.",
            ],
            [
              "Leave your name and email out of the password",
              "Choose one without either.",
            ],
            [
              "That password isn’t allowed",
              "It’s too common. Choose a longer or rarer one.",
            ],
          ]}
        />

        <p>Signed up with Google? There’s no password to change.</p>
      </DocsSection>

      <DocsSection id="devices" title="Signed-in devices">
        <p>
          <strong>Signed-in devices</strong> lists everywhere you’re signed in.
          Press <strong>Sign out</strong> beside any you don’t recognise, or{" "}
          <strong>Sign out other devices</strong> — then change your password.
        </p>
      </DocsSection>

      <DocsSection id="forgot" title="Forgotten your password">
        <DocsSteps>
          <DocsStep title="Ask for a link">
            <p>
              On the log-in page, press <strong>Forgot password?</strong>, enter
              your email and press <strong>Email me a link</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Choose a new one">
            <p>
              Open the link, fill in <strong>New password</strong> and{" "}
              <strong>Confirm password</strong>, and press{" "}
              <strong>Save password</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          The link works once and expires in an hour; if it fails, press{" "}
          <strong>Ask for a new link</strong>.
        </p>
      </DocsSection>

      <DocsSection id="confirming" title="Confirming your email">
        <p>
          Until you confirm, nothing saves. No email? Check spam, or press{" "}
          <strong>Send a new link</strong> in the banner. Links last 24 hours and
          work once.
        </p>
      </DocsSection>

      <DocsSection id="delete" title="Deleting your account">
        <DocsCallout tone="warning">
          <p>
            This deletes your maps, locations, photos and analytics, and cancels
            any subscription. Maps embedded on your site stop working. It can’t
            be undone.
          </p>
        </DocsCallout>

        <DocsSteps>
          <DocsStep title="Press Delete account">
            <p>
              At the foot of <strong>Account</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Confirm with your email">
            <p>
              Type your email and press <strong>Delete account</strong>. Keep the
              page open until it takes you to the home page.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          If it stops partway, <strong>Try again</strong> carries on from there.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
