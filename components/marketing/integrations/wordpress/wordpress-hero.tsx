import { buttonVariants } from "@heroui/react";
import { Download } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import { WORDPRESS_PLUGIN_URL } from "@/lib/marketing/integrations";

import { PlatformHero } from "../platform-hero";
import { WordPressBlockArt } from "./art/wordpress-art-loader";

/**
 * The top of /for/wordpress: what it is, the two ways in, and the drawing of
 * the block being set up.
 *
 * The download is a plain `<a download>`, not a `LinkButton`: it is a file, and
 * the router has no business prefetching a zip.
 */
export function WordPressHero() {
  return (
    <PlatformHero
      icon="wordpress"
      platform="WordPress"
      title={
        <>
          Your locations, on your <span className="text-accent">WordPress</span> site.
        </>
      }
      lede="A map block that sets itself up. Add it to a page, press one button, pick a map — no API key, no code, nothing to paste."
      actions={
        <>
          <a href={WORDPRESS_PLUGIN_URL} download className={buttonVariants()}>
            <Download aria-hidden="true" className="size-4" />
            Download the plugin
          </a>
          <LinkButton href="/signup" variant="tertiary">
            Create a free map
          </LinkButton>
        </>
      }
      note="Free · Works with the block editor, the classic editor and page builders."
      art={<WordPressBlockArt />}
    />
  );
}
