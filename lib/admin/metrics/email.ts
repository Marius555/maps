import "server-only";

import type { Delta } from "@/lib/analytics/view";
import { requireAdmin } from "@/lib/admin/auth/guard";
import { TEMPLATE_COLOR } from "@/lib/admin/colors";
import { env } from "@/lib/env";
import { listEmailLog, type EmailLogEntry } from "@/lib/repositories/email-log.repository";
import type { AdminRange } from "@/lib/validation/admin.schema";
import { countByDay, deltaOf, periodOf, sum, type DayPoint } from "./period";
import type { Slice } from "./users";

export const TEMPLATES = [
  { key: "verify", label: "Confirm address" },
  { key: "welcome", label: "Welcome" },
  { key: "reset", label: "Password reset" },
  { key: "support", label: "Support request" },
] as const;

export type TemplateDay = { day: string } & Record<string, number | string>;

export type EmailMetrics = {
  configured: boolean;
  sends: Delta;
  sendSeries: DayPoint[];
  sendPrevious: DayPoint[];
  failed: number;
  failedSeries: DayPoint[];
  failedPrevious: DayPoint[];
  /** What Resend accepted, per day, and the same days of the period before. */
  deliveredSeries: DayPoint[];
  deliveredPrevious: DayPoint[];
  byDay: TemplateDay[];
  byTemplate: Slice[];
  recent: (EmailLogEntry & { id: string })[];
  truncated: boolean;
};

export async function loadEmailMetrics(range: AdminRange): Promise<EmailMetrics> {
  await requireAdmin();

  const period = periodOf(range);
  const { rows, truncated } = await listEmailLog(period.previousFromDay);

  const current = rows.filter((row) => row.day >= period.fromDay);
  const previous = rows.filter((row) => row.day < period.fromDay);
  const sendSeries = countByDay(
    current.map((row) => row.sentAt),
    period.days,
  );

  const byDay = period.days.map((day) => {
    const entry: TemplateDay = { day };
    for (const template of TEMPLATES) entry[template.key] = 0;
    return entry;
  });
  const index = new Map(byDay.map((entry) => [entry.day, entry]));

  for (const row of current) {
    const entry = index.get(row.day);
    if (entry && typeof entry[row.template] === "number") {
      entry[row.template] = (entry[row.template] as number) + 1;
    }
  }

  const failed = current.filter((row) => !row.ok).length;
  const sendPrevious = countByDay(
    previous.map((row) => row.sentAt),
    period.previousDays,
  );
  const failedSeries = countByDay(
    current.filter((row) => !row.ok).map((row) => row.sentAt),
    period.days,
  );
  const failedPrevious = countByDay(
    previous.filter((row) => !row.ok).map((row) => row.sentAt),
    period.previousDays,
  );
  const minus = (all: DayPoint[], failures: DayPoint[]): DayPoint[] =>
    all.map((point, position) => ({
      day: point.day,
      value: point.value - (failures[position]?.value ?? 0),
    }));

  return {
    configured: Boolean(env.resendApiKey),
    sends: deltaOf(sum(sendSeries), previous.length),
    sendSeries,
    sendPrevious,
    failed,
    failedSeries,
    failedPrevious,
    deliveredSeries: minus(sendSeries, failedSeries),
    deliveredPrevious: minus(sendPrevious, failedPrevious),
    byDay,
    byTemplate: TEMPLATES.map((template) => ({
      key: template.key,
      label: template.label,
      value: current.filter((row) => row.template === template.key).length,
      color: TEMPLATE_COLOR[template.key],
    })),
    recent: current.slice(0, 200).map((row, position) => ({ ...row, id: `${row.sentAt}-${String(position)}` })),
    truncated,
  };
}
