/**
 * The ways onto somebody's website, as the public site lists them: the navbar's
 * Integrations menu reads this, and each entry with a page of its own lives at
 * `/for/<slug>` (CLAUDE.md §5).
 *
 * Adding a platform is one entry here and one folder under `app/(marketing)/for/`.
 * Every claim a platform's page makes has to be true of what ships — for
 * WordPress that is `distribution/wordpress/pinglide/readme.txt`, which is what
 * the owner installing it reads too.
 */
export type Integration = {
  slug: string;
  name: string;
  href: string;
  /** One line under the name in the menu. */
  blurb: string;
  icon: "wordpress" | "code";
};

export const INTEGRATIONS: readonly Integration[] = [
  {
    slug: "wordpress",
    name: "WordPress",
    href: "/for/wordpress",
    blurb: "A map block that sets itself up",
    icon: "wordpress",
  },
  {
    // The snippet, for every builder without a plugin of its own.
    slug: "any-website",
    name: "Any website",
    href: "/for/any-website",
    blurb: "Paste one line of code",
    icon: "code",
  },
];

/**
 * Built by `npm run build:wordpress` (on every `prebuild`) —
 * scripts/build-wordpress-plugin.mjs. Named once, here, because the Publish tab
 * and the WordPress page both hand it out.
 */
export const WORDPRESS_PLUGIN_URL = "/downloads/pinglide-wordpress.zip";
