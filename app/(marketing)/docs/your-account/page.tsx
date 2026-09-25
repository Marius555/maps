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
      <DocsSection id="settings" title="Settings">
        <p>
          Open <strong>Settings</strong> from the account menu. It has four
          pages: <strong>General</strong>, <strong>Account</strong>,{" "}
          <strong>Billing</strong> and <strong>Usage</strong>. The last two are
          covered in{" "}
          <Link href="/docs/plans-and-billing">Plans and billing</Link>.
        </p>
      </DocsSection>

      <DocsSection id="general" title="Name and theme">
        <p>
          On <strong>General</strong>, change <strong>Full name</strong> and
          press <strong>Save changes</strong>. It’s how the dashboard addresses
          you; visitors to your maps never see it.
        </p>

        <p>
          <strong>Appearance</strong> sets the dashboard to{" "}
          <strong>Light</strong>, <strong>Dark</strong> or{" "}
          <strong>Match system</strong>, in this browser. Your published maps
          keep their own look.
        </p>
      </DocsSection>

      <DocsSection id="password" title="Changing your password">
        <p>
          On <strong>Account</strong>, fill in <strong>Current password</strong>,{" "}
          <strong>New password</strong> (at least 8 characters) and{" "}
          <strong>Confirm new password</strong>, then press{" "}
          <strong>Change password</strong>. Every other device is signed out;
          this one stays signed in.
        </p>

        <DocsTable
          caption="Password change problems"
          head={["What you see", "What to do"]}
          rows={[
            [
              "That isn’t your current password",
              "Check it and try again, or sign out and use Forgot password?.",
            ],
            [
              "You’ve used that password before on this account",
              "Choose one you haven’t used here.",
            ],
            [
              "Leave your name and email out of the password",
              "Choose one that doesn’t contain either.",
            ],
            [
              "That password isn’t allowed",
              "It’s too common. Choose a longer or less common one.",
            ],
          ]}
        />

        <p>
          Signed up with Google? There’s no password to change — you sign in
          through Google.
        </p>
      </DocsSection>

      <DocsSection id="devices" title="Signed-in devices">
        <p>
          <strong>Signed-in devices</strong> lists everywhere your account is
          signed in. The one you’re using is marked <strong>This device</strong>.
          Press <strong>Sign out</strong> beside any you don’t recognise, or{" "}
          <strong>Sign out other devices</strong> for all of them — then change
          your password.
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
          The link works once and expires in an hour. If it says{" "}
          <strong>That link is incomplete</strong>, press{" "}
          <strong>Ask for a new link</strong>.
        </p>
      </DocsSection>

      <DocsSection id="confirming" title="Confirming your email">
        <p>
          Until you confirm your address, you can look around but nothing saves,
          and a banner says so. Press <strong>Send a new link</strong> in it if
          the first email didn’t arrive — check your spam folder too. A link
          lasts 24 hours and works once.
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
              Type your email address into the box and press{" "}
              <strong>Delete account</strong>. Keep the page open while it works
              through your maps — it takes you to the home page when it’s done.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          If it stops partway, press <strong>Try again</strong>; it carries on
          from where it stopped.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
