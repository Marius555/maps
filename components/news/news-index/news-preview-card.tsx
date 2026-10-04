import type { NewsPost } from "@/lib/news/types";
import { NewsCover } from "../news-cover";

/**
 * The cover of the row under the pointer, held beside the table while it
 * scrolls. Decorative — the row itself is the link and carries the title — so
 * it is hidden from assistive technology, and from screens too narrow for it.
 */
export function NewsPreviewCard({ post }: { post: NewsPost | undefined }) {
  if (!post) return null;

  return (
    <div aria-hidden="true" className="sticky top-8 hidden lg:block">
      <NewsCover
        url={post.coverUrl}
        alt=""
        category={post.category}
        aspect="square"
        className="rounded-2xl shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]"
      />
    </div>
  );
}
