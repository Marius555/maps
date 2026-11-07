import { buttonVariants } from "@heroui/react";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";

import { WORDPRESS_PLUGIN_URL } from "@/lib/marketing/integrations";

const STEPS = [
  "Install the Pinglide plugin.",
  "Add the Pinglide map block to a page.",
  "Press Set up this map and pick this one.",
] as const;

/**
 * The other way onto a site: on WordPress the plugin's block links itself to a
 * map with one button, so there is nothing to paste
 * (`docs/notes/distribution.md`).
 *
 * A tab of its own rather than the sentence it used to be under the snippet,
 * because the dialog had too much text to read past (2026-11-07) — and an
 * owner on WordPress is the one who should not be reading about the code at
 * all.
 *
 * The download is a plain link, not a Button: it is a file, and the browser's
 * own handling of one (save prompt, download shelf) is the right feedback.
 * "How it works" opens in a new tab, so the owner keeps their place here.
 */
export function WordPressTab() {
  return (
    <div className="space-y-4">
      <ol className="space-y-2.5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-3 text-sm text-foreground">
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-default text-[11px] font-medium text-muted"
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={WORDPRESS_PLUGIN_URL}
          download
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          <Download aria-hidden="true" className="size-4" />
          Download plugin
        </a>
        <Link
          href="/for/wordpress"
          target="_blank"
          className="inline-flex items-center gap-1 rounded text-sm text-muted underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          How it works
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </Link>
      </div>
    </div>
  );
}
