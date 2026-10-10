import { z } from "zod";

import { idSchema } from "./common";
import { createMapSchema } from "./map.schema";

/**
 * Connecting a map dropped on someone's own site — WordPress, for now — to a
 * map on this one. `docs/notes/distribution.md`.
 *
 * Two shapes: the query string the plugin opens `/connect/wordpress` with, and
 * the body that page posts to `/api/connect/wordpress`. The plugin is somebody
 * else's code running on somebody else's server, so everything it hands over is
 * treated as a stranger's input, and the one value that decides where a browser
 * is sent next — `return` — is held to the site it claims to come from.
 */

/** http as well as https: plenty of small WordPress sites still serve plain http, and local ones always do. */
const webUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    const url = parseUrl(value);
    return url !== null && (url.protocol === "https:" || url.protocol === "http:");
  }, "That isn't a web address.");

/**
 * Where WordPress accepts the result. `admin-post.php` is WordPress's own entry
 * point for a plugin's form posts and links, and the only path the plugin ever
 * sends — so it is the only path accepted, which stops this page being used to
 * bounce a signed-in owner anywhere else on that host.
 */
const RETURN_PATH = /\/wp-admin\/admin-post\.php$/;

export const connectRequestSchema = z
  .object({
    /** The site's public address (`home_url()`), where the map will show. */
    site: webUrl,
    /** `admin_url('admin-post.php')` — where the browser goes back to. */
    return: webUrl,
    /** A WordPress nonce, checked by the plugin on the way back. Opaque here. */
    state: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/, "That link is incomplete."),
    /** Which dropped block this is — `distribution/wordpress/pinglide/includes/class-slots.php`. */
    slot: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "That link is incomplete."),
    /** The site's own name, offered as the new map's name. Display only. */
    title: z.string().trim().max(128).optional().catch(undefined),
  })
  .superRefine((value, issue) => {
    const site = parseUrl(value.site);
    const back = parseUrl(value.return);
    if (!site || !back) return;

    if (back.username || back.password || back.hash) {
      issue.addIssue({ code: "custom", path: ["return"], message: "That return address isn't a WordPress admin page." });
      return;
    }

    if (!RETURN_PATH.test(back.pathname)) {
      issue.addIssue({ code: "custom", path: ["return"], message: "That return address isn't a WordPress admin page." });
      return;
    }

    if (!sameSite(site.hostname, back.hostname)) {
      issue.addIssue({
        code: "custom",
        path: ["return"],
        message: "That link names one site and returns to another.",
      });
    }
  });

export type ConnectRequest = z.infer<typeof connectRequestSchema>;

/**
 * What the connect page asks for: an existing map, or a new one. The site comes
 * along so the server can let that site show the map.
 */
export const connectMapSchema = z.object({
  site: webUrl,
  map: z.union([
    z.object({ id: idSchema }),
    z.object({ create: z.literal(true), name: createMapSchema.shape.name }),
  ]),
});

export type ConnectMapInput = z.infer<typeof connectMapSchema>;

/**
 * The same site, allowing for the one split WordPress makes routinely: the
 * public site on `example.com` and the admin on `www.example.com`, or the other
 * way round. Anything further apart is a different site.
 */
export function sameSite(a: string, b: string): boolean {
  const left = a.toLowerCase();
  const right = b.toLowerCase();

  return left === right || left === `www.${right}` || right === `www.${left}`;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
