import type { Metadata } from "next";
import Link from "next/link";

import { DocsArticle } from "@/components/docs/docs-article";
import { DocsCallout } from "@/components/docs/docs-callout";
import { DocsSection } from "@/components/docs/docs-section";
import { DocsStep, DocsSteps } from "@/components/docs/docs-steps";
import { DocsTable } from "@/components/docs/docs-table";
import { findArticle } from "@/lib/docs/articles";

const ARTICLE = findArticle("visitor-analytics");

export const metadata: Metadata = {
  title: ARTICLE?.title,
  description: ARTICLE?.summary,
};

/**
 * The Analytics tab, and the four things that have to be true before it shows
 * anything.
 *
 * Labels are quoted as `components/analytics/**` and the Publish tab's
 * measurement group draw them. The session ceilings are `SESSION_LIMITS` in
 * `lib/repositories/plan-limits.ts`.
 */
export default function VisitorAnalyticsPage() {
  return (
    <DocsArticle
      title="Visitor analytics"
      summary="See what visitors to your published map search for, which locations they open and where they come from."
    >
      <DocsSection id="turning-on" title="Turning it on">
        <p>
          Analytics is off until you switch it on, and is on the Starter and Pro
          plans. Four things have to be true before figures appear:
        </p>

        <DocsSteps>
          <DocsStep title="You’re on Starter or Pro">
            <p>
              Free maps aren’t measured, so figures start from the day you
              upgrade.
            </p>
          </DocsStep>

          <DocsStep title="Measurement is switched on">
            <p>
              On the Publish tab, open <strong>Visitor analytics</strong> and turn
              on <strong>Measure how visitors use this map</strong>.
            </p>
          </DocsStep>

          <DocsStep title="You’ve published since">
            <p>
              Press <strong>Publish</strong>. Measuring starts with the next
              publish, not the moment you flip the switch.
            </p>
          </DocsStep>

          <DocsStep title="The map is on your site">
            <p>
              Visits count from the sites under{" "}
              <Link href="/docs/publishing-and-embedding#domains">
                Allowed domains
              </Link>
              , or from anywhere when that list is empty.
            </p>
          </DocsStep>
        </DocsSteps>

        <p>
          Switching measurement off stops collection straight away — no publish
          needed.
        </p>
      </DocsSection>

      <DocsSection id="what-is-recorded" title="What is recorded">
        <p>
          What visitors search for, which locations they open, and which buttons
          they press — along with their country, device, IP address and the page
          your map is on. There are no cookies, and nothing follows anyone between
          sites.
        </p>

        <DocsCallout tone="warning">
          <p>
            Telling your own visitors is your job. Mention the map’s measurement
            in your site’s privacy policy before you switch it on.
          </p>
        </DocsCallout>
      </DocsSection>

      <DocsSection id="reports" title="Reading the reports">
        <p>
          Open <strong>Analytics</strong> in your map’s sidebar and choose a{" "}
          <strong>Period</strong>: <strong>Last 7 days</strong>,{" "}
          <strong>Last 30 days</strong> or <strong>Last 90 days</strong>.
        </p>

        <DocsTable
          caption="Analytics reports"
          head={["Report", "What it tells you"]}
          rows={[
            [
              "Visits, Locations opened, Searches, Directions, Calls",
              "The headline counts, each compared with the period before.",
            ],
            [
              "How well it is working",
              "Loaded and left — visits where nothing was clicked, searched or opened. Searches that led somewhere — searches followed by a location being opened.",
            ],
            ["Visits over time", "Visits per day across the period."],
            [
              "Where the attention is",
              "A heat map. Where visitors are shows roughly where they were, to country or city, never precisely. Where they look shows your locations sized by how often they were opened.",
            ],
            [
              "Locations they opened",
              "Each location with how often it was opened, and how often that led to directions, a call or a website visit.",
            ],
            [
              "Opened, then nothing",
              "Locations visitors looked at without calling, getting directions or visiting the website. Usually a missing phone number, hours that read as closed, or an address that looks wrong.",
            ],
            [
              "What they searched for",
              "Every search, with how many locations it found. Nothing found marks searches that came up empty — a gap in your coverage, or a name visitors use that you don’t.",
            ],
            [
              "Places they went to instead",
              "Towns and postcodes visitors picked from the search box because none of your locations matched — where people want you to be.",
            ],
            ["What they did", "Every control visitors pressed, counted."],
            [
              "Who they are",
              "Countries, Devices, and the site they Came from.",
            ],
            [
              "Where your map is embedded",
              "Every page the map was seen on.",
            ],
            [
              "Recent visitors",
              "The latest visits, one row each: when, where, device, where they came from, and what they did.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="empty" title="When the tab is empty">
        <DocsTable
          caption="Analytics empty states"
          head={["The tab says", "What it means"]}
          rows={[
            [
              "Analytics is on the paid plans",
              <>
                Upgrade to Starter or Pro —{" "}
                <Link href="/docs/plans-and-billing">Plans and billing</Link>.
              </>,
            ],
            [
              "Nothing to measure yet",
              "The map isn’t published. Publish it and paste the code into your site.",
            ],
            [
              "Measurement is off",
              "Press Turn it on, switch on measurement and publish again.",
            ],
            [
              "No visits in the last 30 days",
              "Everything is set up. Figures appear once somebody loads the map on your site.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection id="limits" title="How many visits are recorded">
        <DocsTable
          caption="Visits recorded per map each month"
          head={["Plan", "Visits recorded per map, per month"]}
          rows={[
            ["Starter", "200,000"],
            ["Pro", "2,000,000"],
          ]}
        />

        <p>
          Past that, your map keeps working for every visitor as normal — only
          the recording pauses, until the month turns. One visit is one person
          loading the map, however much they do on it. Known bots aren’t counted.
        </p>
      </DocsSection>
    </DocsArticle>
  );
}
