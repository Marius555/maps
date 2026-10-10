import { Download } from "lucide-react";
import Link from "next/link";

import { WORDPRESS_PLUGIN_URL } from "@/lib/marketing/integrations";

/**
 * The other way onto a site, under the snippet: on WordPress, the plugin's block
 * links itself to a map with one button, so there is nothing to paste.
 * `docs/notes/distribution.md`.
 *
 * A plain download link rather than a Button: it is a file, and the browser's
 * own handling of one (save prompt, download shelf) is the right feedback.
 * "How it works" opens the public page in a new tab, so the owner keeps their
 * place in the Publish tab.
 */
export function WordPressHint() {
  return (
    <p className="text-pretty text-xs text-muted">
      On WordPress?{" "}
      <a
        href={WORDPRESS_PLUGIN_URL}
        download
        className="inline-flex items-center gap-1 text-foreground underline"
      >
        <Download aria-hidden="true" className="size-3" />
        Get the plugin
      </a>{" "}
      — add the Pinglide map block, press Set up this map, and skip the code.{" "}
      <Link href="/for/wordpress" target="_blank" className="text-foreground underline">
        How it works
      </Link>
    </p>
  );
}
