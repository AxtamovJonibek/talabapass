import { useTranslations } from "next-intl";
import { HistoryReceipt } from "@/components/receipt/receipt-view";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { isIconName } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatSom, MINUS } from "@/lib/format";
import { formatMinute, toTashkent } from "@/lib/time";
import type { ReceiptData, StudentHistory } from "@/server/coupons/receipts";
import { StudentBottomNav, StudentWebNav } from "../app-chrome";
import { PhoneOrWeb } from "../responsive";
import { ProfileAside } from "../profile/profile-screen";
import type { ProfileData } from "../profile/profile-parts";
import { MonthSelect } from "./month-select";

type Props = {
  history: StudentHistory;
  /** Yuqoridagi to'liq chek: tanlangani yoki oyning eng yangisi */
  selected: ReceiptData | null;
  profile: ProfileData;
  coupons: number;
  now: Date;
  /** Kassir hozirgina tasdiqladi (`?yangi=1`): tejov sarlavhasi va chek "bosilib chiqishi" */
  fresh?: boolean;
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

/**
 * Sotuvdan keyingi cho'qqi lahza: "Sotuv tasdiqlandi" + tejalgan summa siqiq raqamda. Dizaynda chizilmagan —
 * mavjud holat juftligi (green-bg / green) va Numeral uslubidan. Ostidagi chek kassa apparatidan chiqqandek ochiladi.
 */
function RedeemedBanner({ r }: { r: ReceiptData }) {
  const t = useTranslations("history");
  return (
    <div role="status" data-testid="redeemed" className="enter-rise flex items-center gap-3 rounded-16 bg-green-bg px-4 py-3.5 text-green">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green text-white">
        <Icon name="check" size={20} strokeWidth={3} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-13">{t("redeemedTitle")}</b>
        <span className="text-26 leading-none font-black tracking-[-0.02em] font-stretch-75%">{t("redeemedSaved", { amount: formatSom(r.discountAmount) })}</span>
      </span>
    </div>
  );
}

/** T7 — tarix (telefon). */
function HistoryPhone({ history, selected, coupons, now, fresh }: Props) {
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
            {fresh ? (
              <div className="mb-3.5">
                <RedeemedBanner r={selected} />
              </div>
            ) : null}
            <div className="text-12 font-bold tracking-[0.06em] text-muted">{sectionLabel(selected.createdAt)}</div>
            <div className={cn("mt-2", fresh && "enter-print [animation-delay:180ms]")}>
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
function HistoryWeb({ history, selected, profile, now, fresh }: Props) {
  const { t, monthName, shortDate } = useLabels(now);
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <StudentWebNav active="profile" />

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-6 px-[clamp(16px,3cqw,40px)] pt-7 pb-[60px]">
        <ProfileAside profile={profile} totals={{ totalSaved: history.totalSaved, totalCount: history.totalCount, places: history.places }} />

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
            <section aria-label={t("history.receipt")} className="flex min-w-0 flex-[2_1_280px] flex-col">
              {fresh ? (
                <div className="mb-3">
                  <RedeemedBanner r={selected} />
                </div>
              ) : null}
              <div className={cn(fresh && "enter-print [animation-delay:180ms]")}>
                <HistoryReceipt r={selected} web />
              </div>
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
