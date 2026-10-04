import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsEditor } from "@/components/admin/sections/news/news-editor/news-editor";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadNewsPost } from "@/lib/admin/metrics/news";
import type { NewsPost } from "@/lib/news/types";
import { NotFoundError } from "@/lib/repositories/errors";

export const metadata: Metadata = { title: "Edit post" };

/** Edit one news post. */
export default async function AdminEditNewsPage(props: PageProps<"/admin/news/[id]">) {
  await requireAdminPage();

  const { id } = await props.params;

  let post: NewsPost | null = null;
  try {
    post = await loadNewsPost(id);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
  }

  if (!post) notFound();

  return (
    <>
      <Link href="/admin/news" className="text-sm text-muted hover:text-foreground">
        ← News
      </Link>
      <SectionCard title="Edit post" hint="Changes show on the News page as soon as you save.">
        <NewsEditor key={post.updatedAt} post={post} />
      </SectionCard>
    </>
  );
}
