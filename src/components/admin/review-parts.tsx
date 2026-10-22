import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PhotoOr } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** A2 — sahifa sarlavhasi: izoh, nom va ikki ko'rsatkich. */
export function ReviewHeader({ title, sub, approvedToday, wait }: { title: string; sub: string; approvedToday: number; wait: string }) {
  const t = useTranslations("admin.review");
  const pill = "flex h-[34px] items-center rounded-17 bg-white px-3 text-13 font-semibold";
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-13 text-muted">{sub}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{title}</h1>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={pill}>
          {t("approvedToday")} <b className="ml-1.5 font-mono">{approvedToday}</b>
        </span>
        <span className={pill}>
          {t("averageWait")} <b className="ml-1.5 font-mono">{wait}</b>
        </span>
      </div>
    </header>
  );
}

export type QueueItem = {
  id: string;
  href: string;
  initials: string;
  /** Profil rasmi / logotip manzili (yo'q bo'lsa bosh harflar) */
  photoUrl?: string | null;
  name: string;
  ago: string;
  meta: string;
  flag: string;
  flagTone: "ok" | "warn" | "bad" | "muted";
};

const FLAG_TONE = { ok: "text-green", warn: "text-warn", bad: "text-danger", muted: "text-muted" } as const;

/** A2 — navbat ro'yxati (eskisi tepada). */
export function QueuePanel({ items, selectedId, more }: { items: QueueItem[]; selectedId: string | null; more: number }) {
  const t = useTranslations("admin.review");
  return (
    <section aria-label={t("queue")} className="min-w-0 flex-[1_1_300px] overflow-hidden rounded-16 bg-white">
      <div className="flex items-center justify-between border-b border-solid border-surface px-4 py-3.5">
        <b className="text-14">{t("queue")}</b>
        <span className="text-12 text-muted">{t("oldestFirst")}</span>
      </div>
      {items.length === 0 ? <p className="m-0 px-4 py-6 text-14 text-muted">{t("empty")}</p> : null}
      <ul className="m-0 list-none p-0">
        {items.map((q) => {
          const selected = q.id === selectedId;
          return (
            <li key={q.id}>
              <Link
                href={q.href}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "tp-row flex w-full items-center gap-3 border-0 border-b border-l-4 border-solid border-b-surface py-3 pr-3.5 pl-3 text-ink no-underline",
                  selected ? "border-l-blue bg-paper" : "border-l-transparent bg-white",
                )}
              >
                <span className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-10 bg-admin-bg text-13 font-extrabold">
                  <PhotoOr src={q.photoUrl}>{q.initials}</PhotoOr>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex justify-between gap-2">
                    <b className="text-14">{q.name}</b>
                    <span className="shrink-0 font-mono text-11 text-muted">{q.ago}</span>
                  </span>
                  <span className="text-12 text-muted">{q.meta}</span>
                  <span className={cn("text-12 font-bold", FLAG_TONE[q.flagTone])}>{q.flag}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {more > 0 ? <div className="px-4 py-3 text-13 text-muted">{t("more", { n: more })}</div> : null}
    </section>
  );
}

/** A2 — ariza kartasi: sarlavha, ikki ustun, harakatlar. */
export function DetailCard({
  code,
  name,
  meta,
  photoUrl,
  initials,
  state,
  stateTone,
  left,
  right,
  actions,
  hint,
}: {
  code: string;
  name: string;
  meta: string;
  photoUrl?: string | null;
  initials?: string;
  state: string;
  stateTone: "ok" | "warn" | "bad";
  left: ReactNode;
  right: ReactNode;
  actions: ReactNode;
  hint: string;
}) {
  const t = useTranslations("admin.review");
  return (
    <section aria-label={t("detailLabel")} className="min-w-0 flex-[2_1_560px] rounded-16 bg-white p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          {photoUrl ? (
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-14 bg-admin-bg text-20 font-black">
              <PhotoOr src={photoUrl}>{initials}</PhotoOr>
            </span>
          ) : null}
          <div>
            <div className="font-mono text-12 text-muted">{code}</div>
            <h2 className="mt-1 mb-0 text-26 font-black tracking-[-0.02em]">{name}</h2>
            <div className="mt-0.5 text-14 text-muted">{meta}</div>
          </div>
        </div>
        <StatusPill tone={stateTone} size="lg">
          {state}
        </StatusPill>
      </div>
      <div className="mt-[18px] flex flex-wrap gap-4">
        <div className="min-w-0 flex-[1_1_280px]">{left}</div>
        <div className="min-w-0 flex-[1_1_280px]">{right}</div>
      </div>
      <div className="border-t-hair-dashed mt-5 flex flex-wrap items-end gap-2.5 pt-[18px]">{actions}</div>
      <p className="mt-3 mb-0 text-13 text-muted">{hint}</p>
    </section>
  );
}

export type CheckRow = { key: string; label: string; value: ReactNode; check: string; tone: "ok" | "warn" | "bad" | "muted" };

/** A2 — "Maydon / Kiritilgan / Tekshiruv" jadvali. */
export function CheckTable({ rows }: { rows: CheckRow[] }) {
  const t = useTranslations("admin.review.table");
  const th = "border-b-[1.5px] border-solid border-ink px-1 py-1.5 text-left text-12 font-semibold text-muted";
  const td = "border-b border-solid border-surface px-1 py-[9px]";
  return (
    <table className="w-full border-collapse text-13">
      <thead>
        <tr>
          <th className={th}>{t("field")}</th>
          <th className={th}>{t("value")}</th>
          <th className={th}>{t("check")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className={cn(td, "text-muted")}>{r.label}</td>
            <td className={cn(td, "font-semibold")}>{r.value}</td>
            <td className={cn(td, "font-bold", FLAG_TONE[r.tone])}>{r.check}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
