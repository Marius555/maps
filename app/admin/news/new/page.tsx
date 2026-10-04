import type { Metadata } from "next";
import Link from "next/link";

import { NewsEditor } from "@/components/admin/sections/news/news-editor/news-editor";
import { SectionCard } from "@/components/analytics/dashboard/section-card";
import { requireAdminPage } from "@/lib/admin/auth/guard";

export const metadata: Metadata = { title: "New post" };

/** Write a news post. Saving lands on the post's own editor page. */
export default async function AdminNewNewsPage() {
  await requireAdminPage();

  return (
    <>
      <Link href="/admin/news" className="text-sm text-muted hover:text-foreground">
        ← News
      </Link>
      <SectionCard title="New post" hint="Save it as a draft to read it over, or publish it straight away.">
        <NewsEditor post={null} />
      </SectionCard>
    </>
  );
}
