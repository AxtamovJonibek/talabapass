"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  discountTerms,
  formatDateRange,
  parseAmount,
  parseDateRange,
  PERCENT_MAX,
  PERCENT_MIN,
  validateDiscount,
  weekdaysLabel,
  type DiscountDraft,
  type DiscountField,
  type DiscountKind,
  type DiscountProblem,
} from "@/lib/discount";
import { formatSom, MINUS } from "@/lib/format";
import { formatMinute, parseMinute } from "@/lib/time";
import { saveDiscountAction } from "@/server/actions/discounts";

const PERCENT_STEP = 5;
const PRICE_STEP = 1000;
const WORKDAYS = [1, 2, 3, 4, 5];
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

type Options = {
  id: string | null;
  initial: DiscountDraft | null;
  /** Toshkent sanasi "YYYY-MM-DD" (serverdan — soat mintaqasi farqi bo'lmasligi uchun) */
  today: string;
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Chegirma muharriri holati — B2 (telefon) va WB2 (veb) uchun bitta. Qiymatlar matn ko'rinishida saqlanadi
 * ("38 000", "60 ta", "13.10 – 31.10") — dizayndagidek; yuborishda `DiscountDraft` ga o'giriladi va
 * forma bilan server bir xil `validateDiscount` dan o'tadi.
 */
export function useDiscountEditor({ id, initial, today }: Options) {
  const t = useTranslations("discountEditor");
  const weekday = useTranslations("weekday");
  const common = useTranslations("common");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<DiscountKind>(initial?.type ?? "PERCENT");
  const [original, setOriginal] = useState(initial?.originalPrice != null ? groupDigits(initial.originalPrice) : "");
  const [percent, setPercent] = useState(initial?.percent ?? 30);
  const [newPrice, setNewPrice] = useState<number | null>(initial?.newPrice ?? null);
  const [weekdays, setWeekdays] = useState(initial?.weekdays ?? WORKDAYS);
  const [from, setFrom] = useState(formatMinute(initial?.fromMinute ?? 720));
  const [to, setTo] = useState(formatMinute(initial?.toMinute ?? 900));
  const [limit, setLimit] = useState(initial?.dailyLimit != null ? t("dailyLimitValue", { count: initial.dailyLimit }) : "");
  const [perStudent, setPerStudent] = useState<DiscountDraft["perStudentLimit"]>(initial?.perStudentLimit ?? "DAILY");
  const [period, setPeriod] = useState(formatDateRange(initial?.startsOn ?? today, initial?.endsOn ?? addDays(today, 30), today));
  const [errors, setErrors] = useState<Partial<Record<DiscountField, DiscountProblem>>>({});
  const [failure, setFailure] = useState<"noBusiness" | "notFound" | "notEditable" | null>(null);
  const [pending, startTransition] = useTransition();

  const originalPrice = parseAmount(original);
  // Yangi narx tanlanmagan bo'lsa — asl narxning 70% i (1000 ga yaxlitlab), dizayndagi 38 000 → 26 000 kabi
  const price = newPrice ?? (originalPrice ? Math.max(PRICE_STEP, Math.floor((originalPrice * 0.7) / PRICE_STEP) * PRICE_STEP) : null);
  const dates = parseDateRange(period, today);
  const draft: DiscountDraft = {
    title,
    type,
    originalPrice,
    percent: type === "PERCENT" ? percent : null,
    newPrice: type === "FIXED_PRICE" ? price : null,
    weekdays,
    fromMinute: parseMinute(from),
    toMinute: (() => {
      const m = parseMinute(to);
      return m === 0 ? 1440 : m; // "00:00" gacha — kun oxirigacha
    })(),
    dailyLimit: parseAmount(limit),
    perStudentLimit: perStudent,
    startsOn: dates?.startsOn ?? "",
    endsOn: dates?.endsOn ?? "",
    terms: initial?.terms ?? "",
  };
  const terms = discountTerms(draft);
  const som = (n: number) => `${formatSom(n)} ${common("currency")}`;

  function step(direction: 1 | -1) {
    if (type === "PERCENT") setPercent((p) => Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, p + direction * PERCENT_STEP)));
    if (type === "FIXED_PRICE" && price !== null) {
      const ceiling = originalPrice ? originalPrice - PRICE_STEP : price;
      setNewPrice(Math.min(Math.max(PRICE_STEP, ceiling), Math.max(PRICE_STEP, price + direction * PRICE_STEP)));
    }
  }

  function save(intent: "draft" | "publish") {
    const found = validateDiscount(draft, today);
    // Boshlangan chegirmani tahrirlashda boshlanish sanasi o'tmishda qolishi mumkin (server ham shunday)
    if (initial && found.dates === "startInPast" && draft.startsOn === initial.startsOn) delete found.dates;
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    startTransition(async () => {
      const result = await saveDiscountAction(id, draft, intent);
      if (!result) return;
      if ("errors" in result) setErrors(result.errors);
      else setFailure(result.error);
    });
  }

  const daysLabel = weekdaysLabel(weekdays, (d) => weekday(`short.${d}` as "short.1"), weekday("everyDay"));
  const overnight = draft.fromMinute !== null && draft.toMinute !== null && draft.toMinute <= draft.fromMinute;

  return {
    id,
    pending,
    title,
    setTitle,
    type,
    setType,
    original,
    setOriginal,
    weekdays,
    toggleDay: (day: number) => setWeekdays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day].sort())),
    from,
    setFrom,
    to,
    setTo,
    overnight,
    limit,
    setLimit,
    perStudent,
    setPerStudent,
    period,
    setPeriod,
    increase: () => step(1),
    decrease: () => step(-1),
    draft: () => save("draft"),
    publish: () => save("publish"),
    errorOf: (field: DiscountField) => (errors[field] ? t(`errors.${errors[field]}`) : undefined),
    failureText: failure ? t(`errors.${failure}`) : null,
    /** Qora qutidagi katta qiymat: "−30%", "26 000", "1+1" */
    valueText: type === "PERCENT" ? `${MINUS}${percent}%` : type === "FIXED_PRICE" ? (price !== null ? groupDigits(price) : "—") : "1+1",
    badge: terms.badge,
    /** B2: "26 600 so'm · 38 000 o'rniga"; WB2: "26 600 so'm" */
    previewPrice: type === "BOGO" ? t("bogoFree") : terms.finalPrice !== null ? som(terms.finalPrice) : "—",
    previewInstead: type !== "BOGO" && originalPrice ? t("insteadOf", { price: groupDigits(originalPrice) }) : null,
    calc:
      type === "PERCENT"
        ? terms.finalPrice !== null && terms.discountAmount !== null
          ? t("calcPercent", { paid: som(terms.finalPrice), saved: som(terms.discountAmount) })
          : null
        : type === "FIXED_PRICE"
          ? terms.discountAmount !== null
            ? t("calcFixed", { saved: som(terms.discountAmount) })
            : null
          : t("calcBogo"),
    when: t("when", { days: weekdays.length ? daysLabel : t("noDays"), from, to, count: draft.dailyLimit ?? 0 }),
    dayCount: weekdays.length,
    overnightText: overnight ? t("overnight", { time: to }) : null,
  };
}

export type DiscountEditor = ReturnType<typeof useDiscountEditor>;
