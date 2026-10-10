import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { CodeBlock } from "@/components/marketing/integrations/code-block";
import { findArticle } from "@/lib/docs/articles";
import { BRAND } from "@/lib/brand";

const ARTICLE = findArticle("publishing-and-embedding");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The Publish tab, the embed snippet, the domain allowlist, and what a visitor
 * can do with the result.
 *
 * Labels are quoted as `components/publish/**` draws them; the snippet's
 * attributes are the ones `embed/src/config.ts` reads. Pasting is described
 * generically on purpose — a platform gets its own page under `/for/` once
 * there is something true to say about it (WordPress so far), and a guessed
 * Webflow walkthrough is worse than none.
 */
export default function PublishingAndEmbeddingPage() {
  return (
    <DocsArticle
      title="Publishing and embedding"
      summary="Design how your published map behaves, publish it, and paste one line of code into your website."
    >
      <DocsSection id="publish-tab" title="The Publish tab">
        <p>
          Open <strong>Publish</strong> in your map’s sidebar: design settings on
          the left, a live preview of the published map beside them. On a phone
          the settings open from a <strong>Design</strong> sheet at the bottom.
        </p>

        <p>
          <strong>Desktop</strong>, <strong>Tablet</strong> and{" "}
          <strong>Phone</strong> change the preview’s width only.{" "}
          <strong>Reset</strong> puts every design setting back to its default.
        </p>

        <DocsCallout>
          <p>
            Design changes save as you make them, and reach your website when you
            press <strong>Publish</strong>. Until then visitors see the last
            version you published.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="design" title="Designing the published map">
        <p>The settings come in sections that open one at a time.</p>

        <DocsTable
          caption="Publish design settings"
          head={["Section", "What it controls"]}
          rows={[
            [
              "Results panel",
              "Show the results panel — the list beside the map — with its Side, Placement (Over the map or Beside it) and Width. Whether a row opens its card, and whether the list shows a scrollbar.",
            ],
            [
              "Panel surface",
              "For a panel over the map: Transparency, Blur behind and Corners.",
            ],
            [
              "Result rows",
              "What each row shows — Pin, Address, Distance, and Directions and phone links — and the Pin size.",
            ],
            [
              "On a phone",
              "A bottom drawer visitors pull up, or, switched off, a side drawer behind a menu button.",
            ],
            [
              "Map controls",
              "The Corner the zoom buttons sit in. The Search box and Nearest to me. Zoom with the scroll wheel, Group nearby pins, Open a card when a pin is clicked, and Frost the controls over the map.",
            ],
            [
              "Colours",
              "Panel, Text, Secondary text, Lines and Accent, and the Default pin colour for locations nothing else colours.",
            ],
            [
              "Language",
              "English, Lietuvių, Deutsch, Français or Español, and Edit wording to change any phrase.",
            ],
            [
              "Visitor analytics",
              <>
                Measure how visitors use this map. See{" "}
                <Link href="/docs/visitor-analytics">Visitor analytics</Link>.
              </>,
            ],
          ]}
        />

        <p>
          <strong>Zoom with the scroll wheel</strong> starts off, so visitors
          scroll past the map rather than getting stuck zooming it.{" "}
          <strong>Group nearby pins</strong> starts on.
        </p>
      </DocsSection>

      <DocsSection id="publishing" title="Publishing">
        <p>
          Press <strong>Publish</strong> at the foot of the settings. The toast
          reads <strong>Published</strong> with the number of locations now live,
          and names any left out for having no usable position. The line above
          the button says where things stand:
        </p>

        <ul>
          <li>
            <strong>Not published yet</strong> — nothing is live.
          </li>
          <li>
            <strong>Live · published 3 days ago</strong> — your site shows the
            map as it was then.
          </li>
          <li>
            <strong>you’ve made changes since — publish again to push them</strong>{" "}
            — edits to locations, shapes, the card or the design are waiting.
          </li>
        </ul>
      </DocsSection>

      <DocsSection id="embed-code" title="Putting the map on your site">
        <DocsSteps>
          <DocsStep title="Copy the embed code">
            <p>
              Press <strong>Embed code and domains</strong>, then{" "}
              <strong>Copy embed code</strong>. The code appears after your first
              publish.
            </p>
          </DocsStep>

          <DocsStep title="Add an HTML block to your page">
            <p>
              Where the map should appear, add your website builder’s block for
              your own code — usually Embed, Custom code, Code or HTML.
            </p>
          </DocsStep>

          <DocsStep title="Paste and save">
            <p>Paste the line in and publish your page.</p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout>
          <p>
            You paste it once. The code always shows your latest publish.
          </p>
        </DocsCallout>

        <p>
          On WordPress there is nothing to paste — see{" "}
          <Link href="/for/wordpress">Maps for WordPress</Link>.
        </p>

        <p>
          The code is one <code>&lt;script&gt;</code> tag. These attributes change
          how the map is placed:
        </p>

        <DocsTable
          caption="Embed code attributes"
          head={["Attribute", "What it does"]}
          rows={[
            [
              <code key="h">data-height</code>,
              "The map’s height in pixels. 520 to begin with; the smallest is 160.",
            ],
            [
              <code key="t">data-target</code>,
              "A CSS selector to draw the map into, when the script can’t sit where the map goes.",
            ],
            [
              <code key="e">data-eager</code>,
              "Loads the map at once. Without it, the map loads as a visitor scrolls near it.",
            ],
            [
              <code key="g">data-tags</code>,
              "Shows only locations with these tags. Pick them under Show only in the embed code window — the code uses tag ids.",
            ],
          ]}
        />

        <p>
          To open the map on one location, add <code>?place=</code> and the
          location’s id to your page’s address.{" "}
          <strong>Open test page</strong> shows your last publish on a page of
          its own, as a visitor sees it.
        </p>
      </DocsSection>

      <DocsSection id="your-analytics" title="Sending map activity to your own analytics">
        <p>
          Everything a visitor does on the map — opening a location, Directions,
          searching, Nearest to me — fires a <code>pinglide</code> event on your
          page, on every plan. Nothing is sent anywhere unless you send it. To
          pass them to Google Analytics, add this below the embed code:
        </p>

        <CodeBlock
          label="HTML"
          code={`<script>
  document.addEventListener("pinglide", function (event) {
    gtag("event", "map_" + event.detail.type, event.detail);
  });
</script>`}
        />

        <p>
          <code>event.detail.type</code> says what happened (<code>open</code>,{" "}
          <code>directions</code>, <code>search</code>, <code>nearest</code>…) and{" "}
          <code>event.detail.map</code> which map.
        </p>
      </DocsSection>

      <DocsSection id="domains" title="Allowed domains">
        <p>
          Under <strong>Allowed domains</strong>, list the websites your map may
          appear on, one per line, and press <strong>Save changes</strong>. Empty
          allows anywhere. On any other site the map doesn’t appear — include
          your staging or preview site too.
        </p>

        <ul>
          <li>Up to 20 domains; commas work as separators too.</li>
          <li>
            Subdomains are included: <code>example.com</code> covers{" "}
            <code>www.example.com</code>.
          </li>
          <li>A full address is trimmed to its domain.</li>
        </ul>

        <DocsCallout tone="warning">
          <p>
            This discourages copying, but isn’t security — the published map is a
            public file. Don’t publish anything you wouldn’t put on your website.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="visitors" title="What your visitors can do">
        <DocsTable
          caption="What visitors can do on a published map"
          head={["Feature", "How it works"]}
          rows={[
            [
              "Search",
              "Filters the list as they type. Picking a town or postcode from the suggestions measures distances from there.",
            ],
            [
              "Nearest to me",
              "Uses the browser’s location, sorts by distance and opens the closest.",
            ],
            [
              "Grouped pins",
              "Nearby pins merge into a bubble with a count. Clicking one zooms in.",
            ],
            [
              "Cards",
              "A pin opens the card you designed, with Directions to their own maps app.",
            ],
            [
              "Results list",
              "Up to 100 rows at a time, with a prompt to search when there are more.",
            ],
            [
              "On a phone",
              "The list becomes a drawer — pulled up from the bottom, or opened from a Locations button.",
            ],
          ]}
        />

        <p>
          Every map credits OpenStreetMap and the map provider in a corner; that
          can’t be switched off. Free maps also show a small{" "}
          <strong>Made with {BRAND.name}</strong> link — see{" "}
          <Link href="/docs/plans-and-billing">Plans and billing</Link>.
        </p>
      </DocsSection>

      <DocsSection id="troubleshooting" title="When the map doesn’t show">
        <DocsTable
          caption="Embed problems and their fixes"
          head={["What you see", "What to do"]}
          rows={[
            [
              "Nothing where the map should be",
              "Check the domain is under Allowed domains, or empty the list. Then check the block still holds the script — some builders strip code from text blocks.",
            ],
            [
              "An old version of the map",
              "Press Publish again.",
            ],
            [
              "A location is missing",
              "It had no usable position. Place it on the Locations tab, then publish.",
            ],
            [
              "Nearest to me says location is off",
              "The visitor blocked location for your site in their browser, and can allow it there.",
            ],
          ]}
        />
      </DocsSection>
    </DocsArticle>
  );
}
