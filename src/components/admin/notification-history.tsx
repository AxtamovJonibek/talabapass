"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { StatusPill } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import { pct } from "@/lib/stats";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import { cancelNotificationAction } from "@/server/actions/admin-notifications";

export type HistoryRow = {
  id: string;
  /** "13.10 14:31" (Toshkent) */
  when: string;
  title: string;
  audience: "ALL_STUDENTS" | "UNIVERSITY" | "DISTRICT" | "BUSINESSES" | "USER";
  names: string[];
  status: "SCHEDULED" | "SENDING" | "SENT" | "FAILED";
  delivered: number;
  opened: number;
};

const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 font-semibold";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5";
const TONE = { SCHEDULED: "info", SENDING: "warn", SENT: "ok", FAILED: "bad" } as const;

function Cancel({ id }: { id: string }) {
  const t = useTranslations("admin.notifications.history");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending} aria-busy={pending}
      onClick={() => {
        if (!window.confirm(t("confirmCancel"))) return;
        startTransition(async () => {
          await cancelNotificationAction({ id });
          router.refresh();
        });
      }}
      className="tp-lift h-8 rounded-8 border-hair border-danger-line bg-white px-2.5 font-sans text-13 font-semibold text-danger disabled:opacity-50"
    >
      {t("cancel")}
    </button>
  );
}

/** "Yuborilganlar": vaqt, sarlavha, auditoriya, yetkazildi, ochildi, holat. Rejalashtirilganini bekor qilsa bo'ladi. */
export function NotificationHistory({ rows }: { rows: HistoryRow[] }) {
  const t = useTranslations("admin.notifications");
  const audienceText = (row: HistoryRow) => {
    if (row.audience === "UNIVERSITY") return row.names.join(", ") || t("audience.UNIVERSITY");
    if (row.audience === "DISTRICT") return t("history.district", { names: row.names.join(", ") });
    return t(`audience.${row.audience}`);
  };
  return (
    <section className="min-w-0 rounded-16 bg-white p-5">
      <h2 className="m-0 text-17 font-extrabold">{t("history.title")}</h2>
      <div className="mt-2.5 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-14">
          <thead>
            <tr className="text-left text-12 text-muted">
              <th className={th}>{t("history.time")}</th>
              <th className={th}>{t("history.name")}</th>
              <th className={th}>{t("history.audience")}</th>
              <th className={cn(th, "text-right")}>{t("history.delivered")}</th>
              <th className={cn(th, "text-right")}>{t("history.opened")}</th>
              <th className={th}>{t("history.status")}</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={cn(td, "py-6 text-muted")}>
                  {t("history.empty")}
                </td>
              </tr>
            ) : null}
            {rows.map((row) => {
              const done = row.status === "SENT";
              return (
                <tr key={row.id}>
                  <td className={cn(td, "font-mono whitespace-nowrap")}>{row.when}</td>
                  <td className={cn(td, "font-bold")}>{row.title}</td>
                  <td className={cn(td, "text-muted")}>{audienceText(row)}</td>
                  <td className={cn(td, "text-right font-mono")}>{done ? formatSom(row.delivered) : "—"}</td>
                  <td className={cn(td, "text-right font-mono")}>{done && row.delivered > 0 ? `${pct(row.opened, row.delivered)}%` : "—"}</td>
                  <td className={td}>
                    <StatusPill tone={TONE[row.status]}>{t(`history.state.${row.status}`)}</StatusPill>
                  </td>
                  <td className={cn(td, "text-right")}>{row.status === "SCHEDULED" ? <Cancel id={row.id} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
