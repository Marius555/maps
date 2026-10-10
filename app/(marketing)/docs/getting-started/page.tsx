import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("getting-started");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The first guide: sign up to a map on somebody's site, in one sitting.
 *
 * It is a route through the product, not a reference — every section ends by
 * pointing at the guide that covers its step properly, so this page can stay
 * short enough to be read before starting rather than while stuck.
 *
 * Labels are quoted as drawn, the house rule `importing-locations` sets out.
 */
export default function GettingStartedPage() {
  return (
    <DocsArticle
      title="Getting started"
      summary="Create an account, make your first map, put a location on it and get it onto your website."
    >
      <DocsSection id="sign-up" title="Create your account">
        <DocsSteps>
          <DocsStep title="Sign up">
            <p>
              Press <strong>Sign in with Google</strong>, or fill in{" "}
              <strong>Name</strong>, <strong>Email</strong> and{" "}
              <strong>Password</strong> (8+ characters) and press{" "}
              <strong>Create account</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Confirm your email">
            <p>
              Open the link we email you, then press{" "}
              <strong>Go to your maps</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout>
          <p>
            Until you confirm, nothing saves. No email? Press{" "}
            <strong>Send a new link</strong> in the banner at the top of the
            dashboard. Links last 24 hours and work once.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="create-a-map" title="Create a map">
        <DocsSteps>
          <DocsStep title="Press Create map">
            <p>
              On <strong>Maps</strong>, press <strong>Create map</strong>, name
              it and press <strong>Create map</strong> again. Visitors never see
              the name.
            </p>
          </DocsStep>

          <DocsStep title="You land in the editor">
            <p>
              It opens on the <strong>Auto</strong> style, light or dark to match
              whoever is looking.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Free includes one map — see{" "}
          <Link href="/docs/plans-and-billing">Plans and billing</Link>.
        </p>
      </DocsSection>

      <DocsSection id="tabs" title="Find your way around a map">
        <p>Every map has five tabs in the sidebar, each with its own guide.</p>

        <DocsTable
          caption="The five tabs of a map"
          head={["Tab", "What it is for"]}
          rows={[
            [
              "Map",
              <>
                Add, move and group locations, draw shapes and routes, and set
                the look.{" "}
                <Link href="/docs/map-editor">The map editor</Link>
              </>,
            ],
            [
              "Locations",
              <>
                Search, filter, edit and import locations.{" "}
                <Link href="/docs/managing-locations">Managing locations</Link>
              </>,
            ],
            [
              "Card",
              <>
                What a visitor sees when they open a location.{" "}
                <Link href="/docs/designing-the-card">Designing the card</Link>
              </>,
            ],
            [
              "Publish",
              <>
                How the map on your site behaves, and the code to put it there.{" "}
                <Link href="/docs/publishing-and-embedding">
                  Publishing and embedding
                </Link>
              </>,
            ],
            [
              "Analytics",
              <>
                What visitors did with your published map. Starter and Pro.{" "}
                <Link href="/docs/visitor-analytics">Visitor analytics</Link>
              </>,
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="first-location" title="Add your first locations">
        <p>Two ways, which you can mix:</p>

        <ul>
          <li>
            <strong>One at a time.</strong> On the Map tab, press the pin button
            and click the map, or search with <strong>Find an address</strong>.
            See{" "}
            <Link href="/docs/map-editor#adding">Adding locations</Link>.
          </li>
          <li>
            <strong>All at once.</strong> On the Locations tab,{" "}
            <strong>Import locations</strong> from a spreadsheet, XML feed or
            Google Sheet. See{" "}
            <Link href="/docs/importing-locations">Importing locations</Link>.
          </li>
        </ul>

        <p>
          Then add phone numbers, hours and photos —{" "}
          <Link href="/docs/managing-locations#edit">Editing a location</Link>.
        </p>
      </DocsSection>

      <DocsSection id="publish" title="Publish and put it on your site">
        <DocsSteps>
          <DocsStep title="Publish">
            <p>
              On the Publish tab, set up the results panel, search and colours,
              then press <strong>Publish</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Copy the embed code">
            <p>
              Press <strong>Embed code and domains</strong>, then{" "}
              <strong>Copy embed code</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Paste it into your page">
            <p>
              Paste it where the map should appear, using your website builder’s
              Embed, Custom code or HTML block.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout>
          <p>
            You paste once. After changes, press <strong>Publish</strong> again
            and your site updates by itself. Views are unlimited on every plan.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="next" title="Where to go next">
        <ul>
          <li>
            Colour-code locations and add filters —{" "}
            <Link href="/docs/tags-pins-and-groups">Tags, pins and groups</Link>.
          </li>
          <li>
            Mark delivery areas or draw a route —{" "}
            <Link href="/docs/shapes-and-routes">Shapes and routes</Link>.
          </li>
          <li>
            Keep the map in step with a spreadsheet —{" "}
            <Link href="/docs/google-sheets-sync">Google Sheets sync</Link>.
          </li>
        </ul>
      </DocsSection>
    </DocsArticle>
  );
}
