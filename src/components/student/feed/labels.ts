import { useTranslations } from "next-intl";
import type { FeedDeal, Urgency } from "@/lib/feed";
import { formatSom, FREE_BADGE } from "@/lib/format";
import { openStatus } from "@/lib/open-status";
import { formatMinute, toTashkent } from "@/lib/time";
import type { StatusTone } from "@/components/ui/status-pill";

const DAY_MS = 86_400_000;
const clock = (iso: string) => formatMinute(toTashkent(new Date(iso)).minute);

/** Lentadagi vaqt va narx yozuvlari (Toshkent vaqtida). Telefon va veb bir xil manbadan. */
export function useDealText() {
  const t = useTranslations();

  /** Ochilish kuni: "Bugun", "Ertaga", "Seshanba", 7 kundan keyin — "13.11 dan" */
  const day = (iso: string, now: Date) => {
    const target = toTashkent(new Date(iso)).date;
    const days = Math.round((target.getTime() - toTashkent(now).date.getTime()) / DAY_MS);
    if (days <= 0) return { label: t("deal.today"), far: false };
    if (days === 1) return { label: t("deal.tomorrow"), far: false };
    if (days < 7) return { label: t(`weekday.long.${toTashkent(new Date(iso)).weekday}` as "weekday.long.1"), far: false };
    const date = `${String(target.getUTCDate()).padStart(2, "0")}.${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
    return { label: t("deal.fromDate", { date }), far: true };
  };

  return {
    /**
     * Holat pilyulkasi (`StatusPill`): "Hozir ochiq · 23:00 gacha", "45 daqiqadan keyin ochiladi", "Bugun 16:00 da ochiladi",
     * "Yopiq · ertaga 09:00 da" / "Yopiq · Dushanba 09:00 da" (kartada foiz belgisi yonida sig'ishi uchun qisqa).
     */
    pill(deal: Pick<FeedDeal, "live" | "closesAt" | "opensAt">, now: Date): { tone: StatusTone; text: string } {
      const s = openStatus(deal, now);
      const time = (d: Date) => formatMinute(toTashkent(d).minute);
      switch (s.kind) {
        case "open":
          return { tone: "open", text: t("deal.status.open", { time: time(s.closesAt) }) };
        case "soon":
          return { tone: "soon", text: t("deal.status.soon", { minutes: s.minutes }) };
        case "today":
          return { tone: "soon", text: t("deal.status.today", { time: time(s.opensAt) }) };
        case "closed": {
          if (s.inDays === 1) return { tone: "closed", text: t("deal.status.tomorrow", { time: time(s.opensAt) }) };
          if (s.inDays < 7) return { tone: "closed", text: t("deal.status.weekday", { day: t(`weekday.long.${s.weekday}` as "weekday.long.1"), time: time(s.opensAt) }) };
          const d = toTashkent(s.opensAt).date;
          return { tone: "closed", text: t("deal.status.date", { date: `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}` }) };
        }
        case "ended":
          return { tone: "closed", text: t("deal.status.ended") };
      }
    },
    /** T4: "Hozir · 15:00 gacha" yoki "Ertaga · 08:00–11:00" */
    phoneStatus(deal: FeedDeal, now: Date): { status: string; when: string } {
      if (deal.live && deal.closesAt) return { status: t("deal.now"), when: t("deal.until", { time: clock(deal.closesAt) }) };
      const range = `${formatMinute(deal.fromMinute)}–${formatMinute(deal.toMinute % 1440)}`;
      return { status: deal.opensAt ? day(deal.opensAt, now).label : "", when: range };
    },
    /** WT2: "15:00 gacha" yoki "Ertaga 08:00" */
    webStatus(deal: FeedDeal, now: Date): string {
      if (deal.live && deal.closesAt) return t("deal.until", { time: clock(deal.closesAt) });
      if (!deal.opensAt) return "";
      const d = day(deal.opensAt, now);
      return d.far ? d.label : `${d.label} ${clock(deal.opensAt)}`;
    },
    /** Narxsiz chegirma matni: egasi yozgani yoki "Chek summasidan −15%" / "Ikkinchisi bepul" */
    note(deal: FeedDeal, short = false): string {
      if (deal.note) return deal.note;
      if (deal.badge === "1+1") return t("deal.bogo");
      if (deal.badge === FREE_BADGE) return t("deal.free");
      return t(short ? "deal.ofCheckShort" : "deal.ofCheck", { badge: deal.badge });
    },
    som: formatSom,
    currency: t("common.currency"),
    category: (slug: string) => (t.has(`category.${slug}` as "category.all") ? t(`category.${slug}` as "category.all") : slug),
    /** "Tez tugaydi" kartasining pastki qatori */
    urgency(deal: FeedDeal, u: Urgency, long = false): string {
      if (u.kind === "closing") return t(long ? "feed.urgency.closingLong" : "feed.urgency.closing", { time: clock(deal.closesAt!), minutes: u.minutes });
      return t(`feed.urgency.${u.kind}`, { left: deal.left });
    },
    clock,
  };
}
