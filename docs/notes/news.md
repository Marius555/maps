# News

Posts on the public site, laid out after anthropic.com/news, and written in the operator
console under **News** (`/admin/news`, editor at `/admin/news/new` and `/admin/news/[id]`).
The site header links to `/news`.

- **`/news`, the Newsroom**: a title with a short table of where to go next
  (`newsroom-header.tsx`, rows from `lib/news/newsroom-links.ts`); the newest post featured
  across two thirds with the next four as a text column beside it (`news-hero.tsx`); then
  every post as a ruled DATE / CATEGORY / TITLE table with a search box, "See more" in tens,
  and a sticky card showing the cover of the row under the pointer (`news-index/`).
- **`/news/[slug]`**: centred category, title and date; a wide cover; a narrow serif body.
- **Type**: summaries, table titles and bodies are Source Serif 4 (`font-serif`, loaded in
  `app/layout.tsx` with `preload: false`, so no other page downloads it); headings stay sans.

## Invariants

- **Admin client only; no row carries a permission.** Whether a post is on the site is
  decided by the public queries (`publishedAt` set and not in the future), never by
  Appwrite's ACL. Covers are public-read files in the one asset bucket.
- **A page view is not an Appwrite request.** `/news` reads through `lib/news/public.ts`
  (`unstable_cache`, tag `news`, five minutes). **Every write route under
  `/api/admin/news` calls `revalidateNews()`**, which is `revalidateTag("news", { expire: 0 })`
  — `"max"` would serve the stale page once more, to the very person who just changed it.
  A new write route that forgets this leaves its change invisible for up to five minutes.
- **`publishedAt` is the whole state.** Null is a draft, future is scheduled, past is
  published (`newsStatus`). A scheduled post appears within the cache's five minutes of its
  time; nothing runs at that moment.
- **The slug is a column, never the row id** (CLAUDE.md, "never derive or reuse an id"). It
  is unique (`idx_news_slug`); `assertSlugFree` refuses a clash first so the editor can name
  the field, and the index is the backstop for two saves racing.
- **The address follows the title only on a new post**, until edited by hand. A published
  post's address is already in links; renaming one must never move it silently.
- **The body is Markdown with raw HTML off.** `NewsMarkdown` is react-markdown + remark-gfm
  with no `rehype-raw`, and react-markdown's default `urlTransform` drops `javascript:`
  links. The console's Preview tab renders the same `NewsMarkdown` inside the same
  `NewsProse` as the article, so what is previewed is what is published.
- **The cover is a draft until Save**, and uploads after the post is written — a new post
  needs its id first. A cover failure after the post saved is its own toast; the post is not
  lost. Replacing follows `setPlaceLogo`'s order: upload, point the row at it, then delete
  the old file.
- **`NEWS_CATEGORIES` is hand-copied into `scripts/appwrite-schema.mjs`** (an enum column).
  Add to both; a category removed from the TS list reads as `announcements` in the mapper
  rather than failing the page.
- **Dates on the public pages are written out by hand in UTC** (`formatNewsDate`), not
  `Intl` — the server has no locale (CLAUDE.md, "Invariants").

## Notes

- **`/news` reads no request input** (no `searchParams`), so the whole page is cached and
  `revalidateNews()` purges it. Search runs in the browser over the posts the page was
  rendered with — which is why there is no category filter in the URL any more.
- The list returns at most 100 posts, and that also bounds search. Past that `/news` needs
  paging and a server-side search.
- A failed read renders "couldn't be loaded", and that page is cached like any other render
  for up to the five minutes; the next console write purges it sooner.
- The header link hides below `sm` like the other secondary links (no hamburger, by design
  — `components/marketing/site-header.tsx`).
