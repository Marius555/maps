"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, toast } from "@heroui/react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { LinkButton } from "@/components/ui/link-button";
import { wallClockToIso } from "@/lib/format/wall-clock";
import { newsHref, newsStatus, type NewsPost } from "@/lib/news/types";
import {
  useClearNewsCover,
  useCreateNews,
  useSetNewsCover,
  useUpdateNews,
} from "@/lib/query/admin";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { toastProblem } from "@/lib/query/toast-error";
import { adminNewsFormSchema, type AdminNewsForm } from "@/lib/validation/news.schema";
import { DeleteNewsDialog } from "../delete-news-dialog";
import { NewsBodyField } from "./news-body-field";
import { NewsCoverField, type CoverDraft } from "./news-cover-field";
import { EMPTY_NEWS, formFromPost } from "./news-form-values";
import { NewsMetaFields } from "./news-meta-fields";

const SAVED_TOAST = {
  draft: { title: "Saved as draft", description: "Only visible in the console." },
  scheduled: { title: "Scheduled", description: "It goes on the News page at its publish date." },
  published: { title: "Published", description: "It's on the News page now." },
} as const;

/**
 * Write a new post, or edit one. docs/notes/news.md.
 *
 * Saved in two steps: the post (JSON), then its cover (multipart) — a new post
 * needs its id before a file can be attached to it. A cover that fails after
 * the post saved is said so in its own toast, and the post is not lost.
 */
export function NewsEditor({ post }: { post: NewsPost | null }) {
  const router = useRouter();
  const create = useCreateNews();
  const update = useUpdateNews();
  const setCover = useSetNewsCover();
  const clearCover = useClearNewsCover();

  const [cover, setCoverDraft] = useState<CoverDraft>(
    post?.coverUrl ? { kind: "saved", url: post.coverUrl } : null,
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { isSubmitting },
  } = useForm<AdminNewsForm>({
    resolver: zodResolver(adminNewsFormSchema),
    defaultValues: post ? formFromPost(post) : EMPTY_NEWS,
  });

  const onSubmit = handleSubmit(async (values) => {
    const input = { ...values, publishedAt: wallClockToIso(values.publishedAt) };

    let saved: NewsPost;

    try {
      saved = post
        ? await update.mutateAsync({ id: post.id, input })
        : await create.mutateAsync(input);
    } catch (error) {
      if (!applyFieldErrors(error, setError)) toastProblem("Couldn't save the post", error);
      return;
    }

    try {
      if (cover?.kind === "new") {
        saved = await setCover.mutateAsync({ id: saved.id, file: cover.file });
        setCoverDraft(saved.coverUrl ? { kind: "saved", url: saved.coverUrl } : null);
      } else if (!cover && post?.coverUrl) {
        saved = await clearCover.mutateAsync(saved.id);
      }
    } catch (error) {
      toastProblem("Saved the post, but couldn't change its cover image", error);
    }

    const { title, description } = SAVED_TOAST[newsStatus(saved.publishedAt)];
    toast.success(title, { description });

    if (post) router.refresh();
    else router.replace(`/admin/news/${saved.id}`);
  });

  const isLive = post ? newsStatus(post.publishedAt) === "published" : false;

  return (
    <form onSubmit={onSubmit} noValidate className="steady space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-6">
          <NewsMetaFields control={control} setValue={setValue} followTitle={!post} />
          <NewsBodyField control={control} />
        </div>

        <div className="min-w-0 space-y-4 xl:sticky xl:top-8 xl:self-start">
          <NewsCoverField value={cover} onChange={setCoverDraft} />
          {cover ? (
            <FormTextField
              control={control}
              name="coverAlt"
              label="Cover description"
              autoComplete="off"
              description="For screen readers: say what the image shows."
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {post ? (
            <Button type="button" variant="danger-soft" onPress={() => setIsDeleteOpen(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          ) : null}
          {post && isLive ? (
            <LinkButton href={newsHref(post.slug)} target="_blank" variant="tertiary">
              <ExternalLink aria-hidden="true" className="size-4" />
              View on site
            </LinkButton>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <LinkButton href="/admin/news" variant="tertiary">
            Cancel
          </LinkButton>
          <Button type="submit" isPending={isSubmitting}>
            {post ? "Save changes" : "Create post"}
          </Button>
        </div>
      </div>

      {post ? (
        <DeleteNewsDialog
          post={post}
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          onDeleted={() => {
            router.replace("/admin/news");
            router.refresh();
          }}
        />
      ) : null}
    </form>
  );
}
