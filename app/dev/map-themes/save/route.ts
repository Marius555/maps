import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { THEME_IMAGE_FILE_NAMES } from "@/lib/map/theme-images";

/**
 * Development only: writes one rendered theme picture into `public/map-themes/`.
 *
 * `/dev/map-themes` renders the pictures in the browser, because only a browser
 * can run MapLibre, and posts each one here, so regenerating them is one button
 * instead of thirty-odd downloads to move by hand. It 404s in a production build,
 * the same gate `app/dev/hero-routes/route.ts` uses.
 *
 * **Only the known file names are written.** `?name=` is checked against the
 * set derived from the theme list, so nothing else can reach the disk — not
 * another file name, and not a path.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!THEME_IMAGE_FILE_NAMES.has(name)) {
    return new Response(`Unknown theme image: ${name}`, { status: 400 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) {
    return new Response("Empty image.", { status: 400 });
  }

  const directory = path.join(process.cwd(), "public", "map-themes");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), bytes);

  return new Response(null, { status: 204 });
}
