import type { NewsStatus } from "@/lib/news/types";

/** How a post's state is drawn in the console. */
export const NEWS_STATUS_STYLE: Record<
  NewsStatus,
  { label: string; color: "default" | "warning" | "success" }
> = {
  draft: { label: "Draft", color: "default" },
  scheduled: { label: "Scheduled", color: "warning" },
  published: { label: "Published", color: "success" },
};
