"use client";

import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { COLLAPSE_CLASS, collapseMotion } from "@/components/ui/list-row-motion";
import type { AppNotification } from "@/lib/notifications/types";
import { NOTIFICATION_KIND_STYLE } from "./notification-kind";
import { NotificationLink } from "./notification-link";
import { NotificationTime } from "./notification-time";

/**
 * One notification, as a row of the inbox.
 *
 * Shut, it is the title, the time and two lines of the message, and the whole
 * row opens it. Open, the message is shown whole with its date and its link.
 * The heading wraps the button rather than the other way round — a button may
 * only hold phrasing content — which is the ARIA accordion's own shape.
 *
 * The body is plain text with its line breaks kept — never HTML or markdown. It
 * is written by us, but it is drawn on every addressed account's page, and a
 * renderer is a second place for a mistake in the admin dashboard to become
 * somebody's broken page.
 *
 * "New" is a word as well as a dot, so it is not told in colour alone.
 */
export function NotificationItem({
  notification,
  isNew,
  isOpen,
  onToggle,
  now,
}: {
  notification: AppNotification;
  isNew: boolean;
  isOpen: boolean;
  onToggle: () => void;
  now: number;
}) {
  const { id, title, body, kind, linkUrl, linkLabel, publishedAt } = notification;
  const style = NOTIFICATION_KIND_STYLE[kind];
  const Icon = style.icon;

  const buttonId = `notification-${id}`;
  const panelId = `notification-${id}-panel`;

  return (
    // Shut, the whole row is the target, so the whole row lights on hover.
    <li
      className={`relative transition-colors ${isOpen ? "" : "hover:bg-default/60"}`}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          // Shut, the button's hit area stretches over the preview below it, so
          // the whole row opens the message. Open, it is the header alone, so the
          // message can be selected and its link pressed.
          className={`flex w-full items-center gap-3 px-4 pt-3 text-left focus-visible:outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus ${
            isOpen ? "pb-2" : "pb-1 after:absolute after:inset-0 after:content-['']"
          }`}
        >
          <span
            role="img"
            aria-label={style.label}
            className={`grid size-8 shrink-0 place-items-center rounded-full ${style.className}`}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>

          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span
              className={`min-w-0 truncate text-sm text-foreground ${
                isNew ? "font-semibold" : "font-medium"
              }`}
            >
              {title}
            </span>

            {isNew ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                New
              </span>
            ) : null}
          </span>

          <NotificationTime publishedAt={publishedAt} now={now} />

          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-muted transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </h3>

      {/* Indented to the title, past the icon: 2rem medallion + 0.75rem gap. */}
      <div className="pr-4 pb-3 pl-15">
        <p
          className={`whitespace-pre-line break-words text-sm text-muted ${
            isOpen ? "" : "line-clamp-2"
          }`}
        >
          {body}
        </p>

        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="details"
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              {...collapseMotion()}
              className={COLLAPSE_CLASS}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-3">
                {linkUrl && linkLabel ? (
                  <NotificationLink href={linkUrl} label={linkLabel} />
                ) : null}
                <span className="text-xs text-muted">
                  {format(new Date(publishedAt), "d MMM yyyy, HH:mm")}
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </li>
  );
}
