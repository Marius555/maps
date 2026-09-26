import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
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
 * generically on purpose — per-platform pages (`/for/[platform]`) are not built
 * yet, and a guessed Webflow walkthrough is worse than none.
 */
export default function PublishingAndEmbeddingPage() {
  return (
    <DocsArticle
      title="Publishing and embedding"
      summary="Design how your published map behaves, publish it, and paste one line of code into your website."
    >
      <DocsSection id="publish-tab" title="The Publish tab">
        <p>
          Open <strong>Publish</strong> in your map’s sidebar. The design settings
          are on the left and a live preview of your published map fills the
          rest. On a phone the settings open from a <strong>Design</strong> sheet
          at the bottom.
        </p>

        <p>
          Above the settings, the preview-width buttons — <strong>Desktop</strong>,{" "}
          <strong>Tablet</strong> and <strong>Phone</strong> — show the map at
          each size. They change the preview only. <strong>Reset</strong> puts
          every design setting back to its default.
        </p>

        <DocsCallout>
          <p>
            Design changes save by themselves as you make them. They reach your
            website when you press <strong>Publish</strong>.
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
              "Show the results panel — the list of locations beside the map. Its Side (Left or Right), Placement (Over the map or Beside it) and Width (Slim to Half). Whether clicking a row opens its card, and whether the list shows a scrollbar.",
            ],
            [
              "Panel surface",
              "For a panel over the map: its Transparency (Solid to Glass), Blur behind and Corners.",
            ],
            [
              "Result rows",
              "What each row shows — Pin, Address, Distance, and Directions and phone links — and the Pin size.",
            ],
            [
              "On a phone",
              "Use a bottom drawer that visitors pull up, or, switched off, a side drawer behind a menu button.",
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
              "The language your visitors read the map in — English, Lietuvių, Deutsch, Français or Español — and Edit wording, to change any phrase in your own words.",
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
          <strong>Zoom with the scroll wheel</strong> starts off, so a visitor
          scrolling down your page scrolls past the map instead of getting stuck
          zooming it. <strong>Group nearby pins</strong> starts on; it keeps a map
          of hundreds of locations readable when zoomed out.
        </p>
      </DocsSection>

      <DocsSection id="publishing" title="Publishing">
        <p>
          Press <strong>Publish</strong> at the foot of the settings. The toast
          reads <strong>Published</strong> with the number of locations now live.
          Any location without a usable position is left out, and the toast names
          it.
        </p>

        <p>The line above the button says where things stand:</p>

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

        <DocsCallout>
          <p>
            Nothing you change reaches your website until you publish. That works
            both ways: you can rework a map for as long as you like, and visitors
            see the finished version all at once.
          </p>
        </DocsCallout>
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
              In your website builder, add the block that accepts your own code
              where the map should appear. It is usually called Embed, Custom
              code, Code or HTML.
            </p>
          </DocsStep>

          <DocsStep title="Paste and save">
            <p>
              Paste the line in and publish your page. The map appears where the
              block is.
            </p>
          </DocsStep>
        </DocsSteps>

        <DocsCallout>
          <p>
            You paste it once. The code keeps pointing at your latest publish, so
            publishing again updates your site without touching it.
          </p>
        </DocsCallout>

        <p>
          The code is a single <code>&lt;script&gt;</code> tag. A few attributes
          on it change how the map is placed:
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
              "A CSS selector for an element to draw the map into, when you can’t put the script where the map should go.",
            ],
            [
              <code key="e">data-eager</code>,
              "Loads the map straight away. Without it, the map loads as a visitor scrolls near it, which keeps your page fast.",
            ],
            [
              <code key="g">data-tags</code>,
              "Shows only locations with these tags. Pick them under Show only in the embed code window rather than typing them — the code uses each tag’s id.",
            ],
          ]}
        />

        <p>
          To open the map on one location, link to your page with{" "}
          <code>?place=</code> and the location’s id at the end of the address.
        </p>

        <p>
          <strong>Open test page</strong> shows the map you last published on a
          page of its own, the way a visitor sees it. Use it to check a publish
          before looking at your site.
        </p>
      </DocsSection>

      <DocsSection id="your-analytics" title="Sending map activity to your own analytics">
        <p>
          Everything a visitor does on the map — opening a location, pressing
          Directions, searching, using Nearest to me — is announced on your page
          as a <code>pinglide</code> event. This works on every plan, whether or
          not Visitor analytics is switched on, and nothing is sent anywhere
          unless you send it. To pass them on to Google Analytics, add this
          below the embed code:
        </p>

        <pre className="overflow-x-auto rounded-xl bg-surface-secondary p-3 text-xs">
          <code>{`<script>
  document.addEventListener("pinglide", function (event) {
    gtag("event", "map_" + event.detail.type, event.detail);
  });
</script>`}</code>
        </pre>

        <p>
          <code>event.detail.type</code> says what happened —{" "}
          <code>open</code>, <code>directions</code>, <code>search</code>,{" "}
          <code>nearest</code> and so on — and <code>event.detail.map</code> says
          which map, for a page with more than one.
        </p>
      </DocsSection>

      <DocsSection id="domains" title="Allowed domains">
        <p>
          Under <strong>Allowed domains</strong>, list the websites your map may
          appear on, one per line, then press <strong>Save changes</strong>.
          Leave it empty to allow the map anywhere.
        </p>

        <ul>
          <li>
            Up to 20 domains. Commas work as separators too.
          </li>
          <li>
            Subdomains are included, so <code>example.com</code> also covers{" "}
            <code>www.example.com</code>.
          </li>
          <li>
            Paste a full address if that’s easier — it is trimmed to the domain.
          </li>
        </ul>

        <p>
          On a site that isn’t on the list, the map doesn’t appear. Remember to
          add the domain of any staging or preview site you test on, too.
        </p>

        <DocsCallout tone="warning">
          <p>
            This discourages somebody copying your code onto their own site. It
            isn’t a security control — the published map is a public file. Don’t
            publish anything on a map you wouldn’t put on your website.
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
              "Search locations or a postcode filters the list as they type. Picking a town or postcode from the suggestions measures distances from there instead.",
            ],
            [
              "Nearest to me",
              "Asks the browser for the visitor’s location, sorts the list by distance and opens the closest one.",
            ],
            [
              "Grouped pins",
              "Nearby pins merge into a bubble with a count. Clicking one zooms in.",
            ],
            [
              "Cards",
              "Clicking a pin opens the card you designed, with Directions to open their own maps app.",
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
          Every published map is credited to OpenStreetMap and the map provider
          in a corner. That credit is required and can’t be switched off. Maps
          on the free plan also show a small <strong>Made with {BRAND.name}</strong>{" "}
          link; see <Link href="/docs/plans-and-billing">Plans and billing</Link>.
        </p>
      </DocsSection>

      <DocsSection id="troubleshooting" title="When the map doesn’t show">
        <DocsTable
          caption="Embed problems and their fixes"
          head={["What you see", "What to do"]}
          rows={[
            [
              "Nothing where the map should be",
              "Check the site’s domain is under Allowed domains, or empty the list. Then check the block really holds the script — some builders strip code from text blocks.",
            ],
            [
              "An old version of the map",
              "Press Publish again. Changes only go live when you publish.",
            ],
            [
              "A location is missing",
              "It had no usable position when you published. Place it on the Locations tab, then publish.",
            ],
            [
              "Nearest to me says location is off",
              "The visitor has blocked location for your site in their browser. They can allow it there and try again.",
            ],
          ]}
        />
      </DocsSection>
    </DocsArticle>
  );
}
