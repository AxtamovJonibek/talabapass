import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { NotificationForm } from "@/components/admin/notification-form";
import { NotificationHistory, type HistoryRow } from "@/components/admin/notification-history";
import { LiveRefresh } from "@/components/business/stats/live-refresh";
import { defaultSchedule, toLocalDateTime } from "@/lib/notifications";
import { formatMinute, toTashkent } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { audienceOptions } from "@/server/notifications/audience";
import { dispatchDue, notificationHistory } from "@/server/notifications/send";

const stamp = (at: Date) => {
  const local = toTashkent(at);
  const iso = local.date.toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)} ${formatMinute(local.minute)}`;
};

// A3 — bildirishnoma yuborish (push + ilova ichi)
async function NotificationsContent() {
  const admin = await requireRole("ADMIN");
  const now = new Date();
  // Zaxira yo'l: tashqi cron ishlamay qolsa ham admin sahifasini ochganda muddati kelganlar yuboriladi
  await dispatchDue(now);
  const [t, options, history] = await Promise.all([getTranslations("admin.notifications"), audienceOptions(), notificationHistory()]);

  const rows: HistoryRow[] = history.map((h) => ({
    id: h.id,
    when: stamp(h.at),
    title: h.title,
    audience: h.audience,
    names: h.audienceNames,
    status: h.status,
    delivered: h.delivered,
    opened: h.opened,
  }));
  // Yuborilayotgan yoki rejalashtirilgan bo'lsa sahifa o'zi yangilanadi
  const live = history.some((h) => h.status === "SENDING" || (h.status === "SCHEDULED" && h.at.getTime() <= now.getTime() + 120_000));

  return (
    <AdminShell user={admin} active="notifications">
      <header>
        <div className="text-13 text-muted">{t("sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
      </header>
      <NotificationForm options={{ ...options, defaultLater: toLocalDateTime(defaultSchedule(now)) }} />
      <NotificationHistory rows={rows} />
      {live ? <LiveRefresh everyMs={5000} /> : null}
    </AdminShell>
  );
}

export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}
