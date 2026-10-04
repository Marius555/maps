import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { AdminEmpty } from "@/components/admin/kpi/admin-empty";
import { NewsTable } from "@/components/admin/sections/news/news-table";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { LinkButton } from "@/components/ui/link-button";
import { requireAdminPage } from "@/lib/admin/auth/guard";
import { loadAllNews } from "@/lib/admin/metrics/news";

export const metadata: Metadata = { title: "News" };

/**
 * Posts on the public /news page: written, published and taken down here.
 * docs/notes/news.md.
 */
export default async function AdminNewsPage() {
  await requireAdminPage();

  const posts = await loadAllNews();

  return (
    <SectionCard
      title="News"
      hint="Posts on the public News page. Drafts and scheduled posts show only here. Dates are UTC."
      action={
        <LinkButton href="/admin/news/new" size="sm">
          <Plus aria-hidden="true" className="size-4" />
          New post
        </LinkButton>
      }
    >
      {posts.length === 0 ? (
        <AdminEmpty>No posts yet. Press New post to write the first one.</AdminEmpty>
      ) : (
        <NewsTable rows={posts} />
      )}
    </SectionCard>
  );
}
