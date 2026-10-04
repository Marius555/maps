"use client";

import { toast } from "@heroui/react";
import { ExternalLink, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import type { NewsTableRow } from "@/lib/admin/metrics/news";
import { newsHref } from "@/lib/news/types";
import { useSetNewsPublished } from "@/lib/query/admin";
import { toastError } from "@/lib/query/toast-error";
import { DeleteNewsDialog } from "./delete-news-dialog";

/** One post's actions, behind the row menu. */
export function NewsRowActions({ post }: { post: NewsTableRow }) {
  const router = useRouter();
  const publish = useSetNewsPublished();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const setPublished = (published: boolean) =>
    publish.mutate(
      { id: post.id, published },
      {
        onSuccess: () => {
          toast.success(published ? "Published" : "Unpublished", {
            description: published
              ? `${post.title} is on the News page now.`
              : `${post.title} is a draft again and off the site.`,
          });
          router.refresh();
        },
        onError: (error) =>
          toastError(error, published ? "Couldn't publish the post" : "Couldn't unpublish the post"),
      },
    );

  const visibility: RowMenuItem[] =
    post.status === "published"
      ? [
          {
            id: "view",
            label: "View on site",
            icon: ExternalLink,
            onAction: () => window.open(newsHref(post.slug), "_blank", "noopener"),
          },
          { id: "unpublish", label: "Unpublish", icon: EyeOff, onAction: () => setPublished(false) },
        ]
      : [
          {
            id: "publish",
            label: post.status === "scheduled" ? "Publish now instead" : "Publish now",
            icon: Eye,
            onAction: () => setPublished(true),
          },
        ];

  const items: RowMenuItem[] = [
    { id: "edit", label: "Edit", icon: Pencil, onAction: () => router.push(`/admin/news/${post.id}`) },
    ...visibility,
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      isDanger: true,
      onAction: () => setIsDeleteOpen(true),
    },
  ];

  return (
    <>
      <RowMenu label={`Actions for ${post.title}`} items={items} />
      <DeleteNewsDialog post={post} isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} />
    </>
  );
}
