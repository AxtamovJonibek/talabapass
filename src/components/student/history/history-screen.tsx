import { useTranslations } from "next-intl";
import { HistoryReceipt } from "@/components/receipt/receipt-view";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { isIconName } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom, MINUS } from "@/lib/format";
import { formatMinute, toTashkent } from "@/lib/time";
import { logoutAction } from "@/server/actions/auth";
import type { ReceiptData, StudentHistory } from "@/server/coupons/receipts";
import { StudentBottomNav } from "../app-chrome";
import { PhoneOrWeb } from "../responsive";
import { MonthSelect } from "./month-select";

export type HistoryProfile = {
  name: string;
  initials: string;
  /** "TATU · Dasturiy injiniring · 2-kurs" */
  meta: string;
  publicId: string;
  /** ISO sana yoki null */
  cardExpiresAt: string | null;
  notify: boolean;
};

type Props = {
  history: StudentHistory;
  /** Yuqoridagi to'liq chek: tanlangani yoki oyning eng yangisi */
  selected: ReceiptData | null;
  profile: HistoryProfile;
  coupons: number;
  now: Date;
};

type T = ReturnType<typeof useTranslations>;
const DAY_MS = 86_400_000;

function useLabels(now: Date) {
  const t = useTranslations();
  const today = toTashkent(now).date.getTime();
  const monthName = (key: string) => {
    const [y, m] = key.split("-");
    const name = t(`month.name.${Number(m)}` as "month.name.1");
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
  };
  /** "bugun 14:31" / "8-okt" */
  const shortDate = (iso: string, withTime = false) => {
    const at = toTashkent(new Date(iso));
    if (at.date.getTime() === today) return withTime ? t("history.todayAt", { time: formatMinute(at.minute) }) : t("history.today");
    return t("history.dayShort", { day: at.date.getUTCDate(), month: t(`month.short.${at.date.getUTCMonth() + 1}` as "month.short.1") });
  };
  /** Yuqoridagi chek sarlavhasi: "BUGUN" yoki "8-OKTABR" */
  const sectionLabel = (iso: string) => {
    const at = toTashkent(new Date(iso));
    if (at.date.getTime() === today) return t("history.todayCaps");
    if (at.date.getTime() === today - DAY_MS) return t("history.yesterdayCaps");
    return t("history.dayLong", { day: at.date.getUTCDate(), month: t(`month.name.${at.date.getUTCMonth() + 1}` as "month.name.1") }).toUpperCase();
  };
  return { t, monthName, shortDate, sectionLabel };
}

function CategoryTile({ r, size }: { r: ReceiptData; size: 42 | 44 }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-10", size === 42 ? "size-[42px]" : "size-11")} style={{ background: r.category.tile, color: r.category.ink }}>
      <Icon name={isIconName(r.category.icon) ? r.category.icon : "bowl"} size={22} strokeWidth={1.8} />
    </span>
  );
}

function PdfLink({ r, t, web }: { r: ReceiptData; t: T; web?: boolean }) {
  return (
    <a
      href={`/api/chek/${r.id}`}
      download
      className={web ? cn(buttonClass({ variant: "outline", size: "card", block: true }), "mt-3") : "mt-2 flex h-11 items-center justify-end text-13 font-bold text-blue no-underline"}
    >
      {t("history.pdf")}
    </a>
  );
}

/** T7 — tarix (telefon). */
function HistoryPhone({ history, selected, coupons, now }: Props) {
  const { t, monthName, shortDate, sectionLabel } = useLabels(now);
  const others = history.receipts.filter((r) => r.id !== selected?.id);
  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="px-5 pt-[58px]">
        <div className="flex items-center justify-between">
          <h1 className="m-0 text-30 font-black tracking-[-0.03em] font-stretch-112%">{t("history.title")}</h1>
          <MonthSelect value={history.month} label={t("history.month")} options={history.months.map((m) => ({ value: m, label: monthName(m) }))}>
            <span className="flex h-10 items-center gap-1.5 rounded-20 border-hair border-line bg-white px-3 text-14 font-semibold">
              {monthName(history.month)}
              <Icon name="chevronDown" size={14} strokeWidth={2.4} />
            </span>
          </MonthSelect>
        </div>
        <div className="mt-4 grid grid-cols-[1.4fr_1fr] gap-2">
          <div className="rounded-16 bg-ink px-4 py-3.5 text-paper">
            <div className="text-12 text-fog-2">{t("history.saved")}</div>
            <div className="mt-1 text-28 font-black tracking-[-0.02em] font-stretch-90%" data-testid="history-saved">
              {formatSom(history.saved)} <span className="text-14 font-bold">{t("common.currency")}</span>
            </div>
          </div>
          <div className="rounded-16 bg-white px-4 py-3.5">
            <div className="text-12 text-muted">{t("history.purchases")}</div>
            <div className="mt-1 text-28 font-black font-stretch-90%">{history.count}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pt-[18px] pb-5">
        {selected ? (
          <>
            <div className="text-12 font-bold tracking-[0.06em] text-muted">{sectionLabel(selected.createdAt)}</div>
            <div className="mt-2">
              <HistoryReceipt r={selected} />
            </div>
            <PdfLink r={selected} t={t} />
          </>
        ) : (
          <div className="rounded-16 bg-white p-5 text-14 text-muted">{t("history.empty")}</div>
        )}
        {others.length > 0 ? (
          <>
            <div className="mt-5 text-12 font-bold tracking-[0.06em] text-muted">{t("history.earlier")}</div>
            <ul className="m-0 mt-2 list-none rounded-16 bg-white p-0">
              {others.map((r, i) => (
                <li key={r.id}>
                  <Link
                    href={`/tarix?oy=${history.month}&chek=${r.id}`}
                    className={cn("flex items-center gap-3 px-3.5 py-3 text-ink no-underline", i < others.length - 1 && "border-0 border-b border-solid border-surface")}
                  >
                    <CategoryTile r={r} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="text-14 font-bold">{r.business.name}</div>
                      <div className="text-12 text-muted">
                        {r.item} · {shortDate(r.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-14 font-bold">{formatSom(r.paidAmount)}</div>
                      <div className="text-12 font-semibold text-green">
                        {MINUS}
                        {formatSom(r.discountAmount)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <StudentBottomNav active="history" coupons={coupons} />
    </div>
  );
}

/** WT4 — profil va tarix (veb). */
function HistoryWeb({ history, selected, profile, now }: Props) {
  const { t, monthName, shortDate } = useLabels(now);
  const expires = profile.cardExpiresAt ? new Date(profile.cardExpiresAt) : null;
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  const menuRow = "flex h-14 items-center border-0 border-b border-solid border-surface px-4 font-semibold text-ink no-underline";
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-0 border-b-[1.5px] border-solid border-ink">
        <div className="mx-auto flex h-[72px] max-w-[1360px] items-center gap-3.5 px-[clamp(16px,3cqw,40px)]">
          <Link href="/chegirmalar" className="shrink-0 text-ink no-underline">
            <Logo size={20} />
          </Link>
          <nav aria-label={t("feed.nav")} className="ml-auto flex gap-0.5 overflow-x-auto">
            <Link href="/chegirmalar" className="flex h-10 items-center rounded-10 px-3 text-14 font-semibold whitespace-nowrap text-ink no-underline">
              {t("feed.navDeals")}
            </Link>
            <Link href="/tarix" aria-current="page" className="flex h-10 items-center rounded-10 bg-ink px-3 text-14 font-bold whitespace-nowrap text-white no-underline">
              {t("history.navProfile")}
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-[clamp(16px,3cqw,40px)] pt-7 pb-[60px]">
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
          <div className="relative overflow-hidden rounded-22 bg-blue p-[22px] text-white">
            <div aria-hidden="true" className="absolute -top-[50px] -right-[50px] size-[170px] rounded-full border-[26px] border-solid border-blue-2" />
            <div className="relative flex items-center justify-between">
              <Logo size={14} chip="white-blue" />
              <span className="rounded-20 bg-white px-[9px] py-[5px] text-12 font-bold text-green">{t("status.verified")}</span>
            </div>
            <div className="relative mt-[22px] flex items-center gap-3.5">
              <div className="flex size-[70px] items-center justify-center rounded-16 bg-white text-26 font-black text-blue">{profile.initials}</div>
              <div>
                <div className="text-24 font-extrabold tracking-[-0.02em]">{profile.name}</div>
                <div className="text-14 text-blue-tint">{profile.meta}</div>
              </div>
            </div>
            <div className="relative mt-5 flex justify-between border-0 border-t-[1.5px] border-dashed border-blue-dash pt-3 font-mono text-13 text-blue-tint">
              <span>ID {profile.publicId}</span>
              {expires ? <span>{t("history.validUntil", { date: fmt(expires) })}</span> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-18 bg-white p-4">
              <div className="text-13 text-muted">{t("history.totalSaved")}</div>
              <div className="mt-1 text-28 font-black font-stretch-85%">{formatSom(history.totalSaved)}</div>
              <div className="text-12 text-muted">{t("common.currency")}</div>
            </div>
            <div className="rounded-18 bg-white p-4">
              <div className="text-13 text-muted">{t("history.purchases")}</div>
              <div className="mt-1 text-28 font-black font-stretch-85%">{history.totalCount}</div>
              <div className="text-12 text-muted">{t("history.places", { count: history.places })}</div>
            </div>
          </div>
          <ul className="m-0 list-none rounded-18 bg-white p-0">
            <li className={menuRow}>
              {t("history.menu.personal")}
              <span className="ml-auto text-placeholder">›</span>
            </li>
            <li className={menuRow}>
              {t("history.menu.card")}
              {expires ? <span className="ml-auto text-13 font-medium text-muted">{t("history.menu.nextCheck", { year: expires.getUTCFullYear(), month: t(`month.name.${expires.getUTCMonth() + 1}` as "month.name.1") })}</span> : null}
            </li>
            <li className={menuRow}>
              {t("history.menu.notifications")}
              <span className={cn("ml-auto text-13 font-bold", profile.notify ? "text-green" : "text-muted")}>{profile.notify ? t("history.menu.on") : t("history.menu.off")}</span>
            </li>
            <li>
              <Link href="/huquqiy/maxfiylik" className={menuRow}>
                {t("history.menu.legal")}
                <span className="ml-auto text-placeholder">›</span>
              </Link>
            </li>
            <li>
              <form action={logoutAction}>
                <button type="submit" className="flex h-14 w-full items-center border-0 bg-transparent px-4 font-sans text-16 font-bold text-danger">
                  {t("common.logout")}
                </button>
              </form>
            </li>
          </ul>
        </aside>

        <main className="flex min-w-0 flex-[2_1_600px] flex-wrap items-start gap-3">
          <section className="min-w-0 flex-[3_1_380px] rounded-22 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <h1 className="m-0 text-28 font-black tracking-[-0.03em] font-stretch-110%">{t("history.title")}</h1>
              <span className="rounded-12 bg-ink px-3 py-2 text-14 text-paper">
                {t.rich("history.monthSaved", { month: monthName(history.month).split(" ")[0]!, amount: `${formatSom(history.saved)} ${t("common.currency")}`, b: (c) => <b>{c}</b> })}
              </span>
            </div>
            {history.receipts.length === 0 ? <p className="mt-3.5 mb-0 text-14 text-muted">{t("history.empty")}</p> : null}
            <ul className="m-0 mt-3.5 list-none p-0">
              {history.receipts.map((r) => {
                const on = r.id === selected?.id;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/tarix?oy=${history.month}&chek=${r.id}`}
                      aria-current={on ? "true" : undefined}
                      className={cn("flex w-full items-center gap-3 rounded-14 p-3 text-left text-ink no-underline", on ? "bg-paper" : "bg-transparent")}
                    >
                      <CategoryTile r={r} size={44} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <b className="text-15">{r.business.name}</b>
                        <span className="text-13 text-muted">
                          {r.item} · {shortDate(r.createdAt, true)}
                        </span>
                      </span>
                      <span className="flex flex-col gap-0.5 text-right">
                        <b className="font-mono text-14">{formatSom(r.paidAmount)}</b>
                        <span className="text-12 font-bold text-green">
                          {MINUS}
                          {formatSom(r.discountAmount)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          {selected ? (
            <section aria-label={t("history.receipt")} className="min-w-0 flex-[2_1_280px]">
              <HistoryReceipt r={selected} web />
              <PdfLink r={selected} t={t} web />
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}

/** T7 / WT4 — 700px da almashadi. */
export function HistoryScreen(props: Props) {
  return <PhoneOrWeb phone={<HistoryPhone {...props} />} web={<HistoryWeb {...props} />} />;
}
