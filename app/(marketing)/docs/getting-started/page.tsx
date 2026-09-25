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
              On the sign-up page, either press{" "}
              <strong>Sign in with Google</strong>, or fill in{" "}
              <strong>Name</strong>, <strong>Email</strong> and{" "}
              <strong>Password</strong> (at least 8 characters) and press{" "}
              <strong>Create account</strong>.
            </p>
          </DocsStep>

          <DocsStep title="Confirm your email">
            <p>
              We send a confirmation link to the address you signed up with. Open
              it and you land on <strong>Email confirmed</strong> — press{" "}
              <strong>Go to your maps</strong>.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout>
          <p>
            Until you confirm, you can look around but nothing saves. A banner
            reading <strong>Confirm your email to start building</strong> stays at
            the top of the dashboard. If the email never arrived, press{" "}
            <strong>Send a new link</strong> in that banner. Links last 24 hours
            and work once.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="create-a-map" title="Create a map">
        <DocsSteps>
          <DocsStep title="Press Create map">
            <p>
              On <strong>Maps</strong>, press <strong>Create map</strong>, type a
              name in <strong>Map name</strong> and press{" "}
              <strong>Create map</strong> again. The name is yours alone —
              visitors never see it.
            </p>
          </DocsStep>

          <DocsStep title="You land in the editor">
            <p>
              The new map opens straight away, on the <strong>Auto</strong> map
              style, which follows light or dark mode for whoever is looking.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          The Free plan includes one map. See{" "}
          <Link href="/docs/plans-and-billing">Plans and billing</Link> for what
          the others include.
        </p>
      </DocsSection>

      <DocsSection id="tabs" title="Find your way around a map">
        <p>
          Every map has five tabs in the sidebar. Each one is a guide of its own.
        </p>

        <DocsTable
          caption="The five tabs of a map"
          head={["Tab", "What it is for"]}
          rows={[
            [
              "Map",
              <>
                Add, move and group locations, draw shapes and routes, and choose
                how the map looks.{" "}
                <Link href="/docs/map-editor">The map editor</Link>
              </>,
            ],
            [
              "Locations",
              <>
                Every location as a list you can search, filter, edit and import
                into.{" "}
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
        <p>You have two ways in, and you can mix them on the same map.</p>

        <ul>
          <li>
            <strong>One at a time.</strong> On the Map tab, press the pin button
            at the left end of the toolbar, then click the map where the location
            is. Or type an address into <strong>Find an address</strong> and
            press <strong>Add a location here</strong> on the match. The street
            address fills itself in. See{" "}
            <Link href="/docs/map-editor#adding">Adding locations</Link>.
          </li>
          <li>
            <strong>All at once.</strong> On the Locations tab, press{" "}
            <strong>Import locations</strong> and bring in a spreadsheet, an XML
            feed or a Google Sheet. See{" "}
            <Link href="/docs/importing-locations">Importing locations</Link>.
          </li>
        </ul>

        <p>
          Then open any location to add its phone number, website, opening hours
          and photos — <Link href="/docs/managing-locations#edit">Editing a location</Link>.
        </p>
      </DocsSection>

      <DocsSection id="publish" title="Publish and put it on your site">
        <DocsSteps>
          <DocsStep title="Publish">
            <p>
              On the Publish tab, set up how the map behaves — the results panel,
              search, colours — then press <strong>Publish</strong>. A toast says{" "}
              <strong>Published</strong> and how many locations are live.
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
              Paste the line into your page’s HTML, where the map should appear.
              Every website builder has a block for this — usually called Embed,
              Custom code or HTML.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout>
          <p>
            You only paste once. When you change something later, press{" "}
            <strong>Publish</strong> again and the map on your site updates by
            itself.
          </p>
        </DocsCallout>

        <p>
          Views are unlimited on every plan, including the free one — nothing is
          counted or charged when somebody opens your map.
        </p>
      </DocsSection>

      <DocsSection id="next" title="Where to go next">
        <ul>
          <li>
            Colour-code your locations and let visitors narrow the map down —{" "}
            <Link href="/docs/tags-pins-and-groups">Tags, pins and groups</Link>.
          </li>
          <li>
            Mark delivery areas or draw a route —{" "}
            <Link href="/docs/shapes-and-routes">Shapes and routes</Link>.
          </li>
          <li>
            Keep the map in step with a spreadsheet you already maintain —{" "}
            <Link href="/docs/google-sheets-sync">Google Sheets sync</Link>.
          </li>
        </ul>
      </DocsSection>
    </DocsArticle>
  );
}
