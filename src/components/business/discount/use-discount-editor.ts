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
import { useRouter } from "@/i18n/navigation";
import { saveDiscountAction } from "@/server/actions/discounts";

const PERCENT_STEP = 5;
const PRICE_STEP = 1000;
const WORKDAYS = [1, 2, 3, 4, 5];
const groupDigits = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Muharrirdagi rasm: saqlangani (id) yoki hali yuklanmagan yangi fayl */
export type EditorImage = { key: string; url: string; id?: string; file?: File };
export const IMAGES_MAX = 4;
const IMAGE_BYTES_MAX = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif"];
type ImageError = "too_large" | "bad_type" | "too_many" | "daily_limit" | "failed";

type Options = {
  id: string | null;
  /** Saqlangan rasmlar (tahrirlashda) */
  images: { id: string; url: string }[];
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
export function useDiscountEditor({ id, initial, images: savedImages, today }: Options) {
  const t = useTranslations("discountEditor");
  const weekday = useTranslations("weekday");
  const common = useTranslations("common");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<DiscountKind>(initial?.type ?? "PERCENT");
  const [original, setOriginal] = useState(initial?.originalPrice != null ? groupDigits(initial.originalPrice) : "");
  const [percentText, setPercentText] = useState(String(initial?.percent ?? 30));
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
  const router = useRouter();
  // Birinchi saqlashdan keyin id shu yerda: rasm yuklash xato bo'lsa, qayta bosish yangi chegirma ochmaydi
  const [savedId, setSavedId] = useState(id);
  const [images, setImages] = useState<EditorImage[]>(savedImages.map((i) => ({ key: i.id, url: i.url, id: i.id })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [imageError, setImageError] = useState<ImageError | null>(null);

  function addImages(files: FileList | null) {
    if (!files) return;
    setImageError(null);
    const picked = [...files];
    const room = IMAGES_MAX - images.length;
    if (picked.length > room) setImageError("too_many");
    const ok = picked.slice(0, Math.max(0, room)).filter((file) => {
      // HEIC'ni ba'zi brauzerlar turisiz beradi — nom bo'yicha; server baribir mazmundan aniqlaydi
      const typeOk = IMAGE_TYPES.includes(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (!typeOk) setImageError("bad_type");
      else if (file.size > IMAGE_BYTES_MAX) setImageError("too_large");
      return typeOk && file.size <= IMAGE_BYTES_MAX;
    });
    setImages((list) => [...list, ...ok.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, url: URL.createObjectURL(file), file }))]);
  }

  function removeImage(key: string) {
    const image = images.find((i) => i.key === key);
    if (image?.id) setRemoved((list) => [...list, image.id!]);
    if (image?.file) URL.revokeObjectURL(image.url);
    setImages((list) => list.filter((i) => i.key !== key));
  }

  /** Saqlangandan keyin: o'chirilganlar, keyin yangi fayllar ketma-ket. Xato bo'lsa — to'xtaydi va sababini ko'rsatadi. */
  async function syncImages(discountId: string): Promise<boolean> {
    for (const imageId of removed) {
      await fetch(`/api/biznes/chegirma-rasm?rasm=${encodeURIComponent(imageId)}`, { method: "DELETE" });
    }
    setRemoved([]);
    for (const image of images.filter((i) => i.file)) {
      const response = await fetch(`/api/biznes/chegirma-rasm?chegirma=${encodeURIComponent(discountId)}`, { method: "POST", body: image.file });
      const body = (await response.json().catch(() => null)) as { ok: boolean; id?: string; problem?: string } | null;
      if (!body?.ok || !body.id) {
        const problem = body?.problem;
        setImageError(problem === "too_large" || problem === "bad_type" || problem === "too_many" || problem === "daily_limit" ? problem : "failed");
        return false;
      }
      const uploaded = body.id;
      setImages((list) => list.map((i) => (i.key === image.key ? { ...i, id: uploaded, file: undefined } : i)));
    }
    return true;
  }

  // Foiz qo'lda yoziladi: 1–100 oralig'idagi butun son (bo'sh yoki noto'g'ri bo'lsa — null, tekshiruv xato beradi)
  const percent = /^\d{1,3}$/.test(percentText) ? Number(percentText) : null;
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
  const terms = discountTerms(type === "PERCENT" ? { ...draft, percent: draft.percent ?? 0 } : draft);
  const som = (n: number) => `${formatSom(n)} ${common("currency")}`;

  function step(direction: 1 | -1) {
    if (type === "PERCENT") setPercentText(String(Math.min(PERCENT_MAX, Math.max(PERCENT_MIN, (percent ?? 0) + direction * PERCENT_STEP))));
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
      const result = await saveDiscountAction(savedId, draft, intent);
      if ("errors" in result) return setErrors(result.errors);
      if (!result.ok) return setFailure(result.error);
      setSavedId(result.id);
      if (await syncImages(result.id)) router.push("/biznes/chegirmalar");
    });
  }

  const daysLabel = weekdaysLabel(weekdays, (d) => weekday(`short.${d}` as "short.1"), weekday("everyDay"));
  const overnight = draft.fromMinute !== null && draft.toMinute !== null && draft.toMinute <= draft.fromMinute;

  return {
    id,
    pending,
    images,
    addImages,
    removeImage,
    imageErrorText: imageError ? t(`imageErrors.${imageError}`) : null,
    canAddImage: images.length < IMAGES_MAX,
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
    percentText,
    /** Faqat raqamlar, 3 tagacha (100 gacha tekshiruv `validateDiscount` da) */
    setPercentText: (value: string) => setPercentText(value.replace(/\D/g, "").slice(0, 3)),
    increase: () => step(1),
    decrease: () => step(-1),
    draft: () => save("draft"),
    publish: () => save("publish"),
    errorOf: (field: DiscountField) => (errors[field] ? t(`errors.${errors[field]}`) : undefined),
    failureText: failure ? t(`errors.${failure}`) : null,
    /** Qora qutidagi katta qiymat: "−30%", "26 000", "1+1" */
    valueText: type === "PERCENT" ? `${MINUS}${percentText || 0}%` : type === "FIXED_PRICE" ? (price !== null ? groupDigits(price) : "—") : "1+1",
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
