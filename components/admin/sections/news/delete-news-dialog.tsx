"use client";

import { Button, toast } from "@heroui/react";
import { useRouter } from "next/navigation";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { NewsPost } from "@/lib/news/types";
import { useDeleteNews } from "@/lib/query/admin";
import { toastError } from "@/lib/query/toast-error";

/**
 * Delete a post and its cover image, behind one confirmation. `onDeleted` is
 * for the editor, which has nowhere left to stand once the post is gone.
 */
export function DeleteNewsDialog({
  post,
  isOpen,
  onOpenChange,
  onDeleted,
}: {
  post: Pick<NewsPost, "id" | "title">;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const remove = useDeleteNews();

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="steady"
      dialogClassName="sm:max-w-[420px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Delete this post?</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body className="text-sm text-muted">
        <p>
          <span className="font-medium text-foreground">{post.title}</span> and its cover image are
          removed, and its address stops working. To take it off the site and keep it, unpublish it
          instead. This can&apos;t be undone.
        </p>
      </ResponsiveDialog.Body>
      <ResponsiveDialog.Footer className="flex-wrap">
        <Button slot="close" variant="tertiary">
          Keep it
        </Button>
        <Button
          variant="danger"
          isPending={remove.isPending}
          onPress={() =>
            remove.mutate(post.id, {
              onSuccess: () => {
                onOpenChange(false);
                toast.success("Deleted", { description: `${post.title} is gone.` });
                if (onDeleted) onDeleted();
                else router.refresh();
              },
              onError: (error) => toastError(error, "Couldn't delete the post"),
            })
          }
        >
          Delete
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
