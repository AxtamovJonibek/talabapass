"use client";

import { useTranslations } from "next-intl";
import { ToggleSquare } from "@/components/ui/chip";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icons";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import type { DiscountKind } from "@/lib/discount";
import type { DiscountEditor } from "./use-discount-editor";

export type Category = { icon: IconName; tileColor: string; inkColor: string };
type Size = "phone" | "web";

const KINDS: DiscountKind[] = ["PERCENT", "FIXED_PRICE", "BOGO"];
const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Kategoriya rangidagi kvadrat (ranglar bazadan — Category.tileColor / inkColor). */
export function CategoryTile({ category, size, plus = false, image, children }: { category: Category; size: number; plus?: boolean; image?: string; children?: React.ReactNode }) {
  const radius = size >= 96 ? "rounded-14" : size >= 64 ? "rounded-12" : "rounded-10";
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", radius)}
      style={{ width: size, height: size, background: category.tileColor, color: category.inkColor }}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: va himoyalangan API manzillari
        <img src={image} alt="" className={cn("absolute inset-0 size-full object-cover", radius)} />
      ) : size > 52 ? (
        <Icon name={category.icon} size={Math.round(size / 1.9)} strokeWidth={size >= 96 ? 1.3 : 1.4} />
      ) : null}
      {/* Rasm qo'shish belgisi (dizayndagidek); rasmlar pastdagi ImagePicker'da */}
      {plus ? (
        <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-[22px] items-center justify-center rounded-11 bg-ink text-white">
          <Icon name="plus" size={12} strokeWidth={2.6} />
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function TypePicker({ e, size }: { e: DiscountEditor; size: Size }) {
  const t = useTranslations("discountEditor");
  const type = useTranslations("discountType");
  return (
    <Segmented
      size={size === "phone" ? "choice" : "choice-lg"}
      label={t("type")}
      value={e.type}
      onChange={e.setType}
      options={KINDS.map((k) => ({ value: k, label: type(k) }))}
      className={size === "web" ? "max-w-[480px]" : undefined}
    />
  );
}

export function DayPicker({ e, size }: { e: DiscountEditor; size: Size }) {
  const weekday = useTranslations("weekday");
  const error = e.errorOf("weekdays");
  return (
    <>
      <div className={cn("grid grid-cols-7", size === "phone" ? "gap-[5px]" : "max-w-[520px] gap-1.5")}>
        {DAYS.map((d) => (
          <ToggleSquare key={d} day tall={size === "web"} textSize={size === "phone" ? 13 : 14} selected={e.weekdays.includes(d)} onClick={() => e.toggleDay(d)}>
            {weekday(`short.${d}`)}
          </ToggleSquare>
        ))}
      </div>
      {error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null}
    </>
  );
}

/** Soat oralig'i, kunlik son va muddat maydonlari (ikkala ko'rinishda bir xil). */
export function TimeFields({ e, prefix }: { e: DiscountEditor; prefix: string }) {
  const t = useTranslations("discountEditor");
  return (
    <>
      <Field label={t("from")} htmlFor={`${prefix}-from`} error={e.errorOf("time")}>
        <Input id={`${prefix}-from`} type="time" compact tight mono={15} value={e.from} onChange={(x) => e.setFrom(x.target.value)} invalid={Boolean(e.errorOf("time"))} />
      </Field>
      <Field label={t("to")} htmlFor={`${prefix}-to`}>
        <Input id={`${prefix}-to`} type="time" compact tight mono={15} value={e.to} onChange={(x) => e.setTo(x.target.value)} invalid={Boolean(e.errorOf("time"))} />
      </Field>
    </>
  );
}

export function LimitField({ e, prefix }: { e: DiscountEditor; prefix: string }) {
  const t = useTranslations("discountEditor");
  return (
    <Field label={t("dailyLimit")} htmlFor={`${prefix}-limit`} error={e.errorOf("dailyLimit")}>
      <Input
        id={`${prefix}-limit`}
        inputMode="numeric"
        compact
        tight
        mono={15}
        value={e.limit}
        onChange={(x) => e.setLimit(x.target.value)}
        onBlur={() => {
          const n = Number(e.limit.replace(/\D/g, ""));
          if (n > 0) e.setLimit(t("dailyLimitValue", { count: n }));
        }}
        invalid={Boolean(e.errorOf("dailyLimit"))}
      />
    </Field>
  );
}

export function PeriodField({ e, prefix }: { e: DiscountEditor; prefix: string }) {
  const t = useTranslations("discountEditor");
  return (
    <Field label={t("period")} htmlFor={`${prefix}-period`} error={e.errorOf("dates")}>
      <Input
        id={`${prefix}-period`}
        compact
        tight
        mono={15}
        placeholder={t("periodPlaceholder")}
        value={e.period}
        onChange={(x) => e.setPeriod(x.target.value)}
        invalid={Boolean(e.errorOf("dates"))}
      />
    </Field>
  );
}

/** "Yarim tundan o'tadi: keyingi kun 02:00 gacha" — 22:00–02:00 kabi oraliqlarda. */
export function OvernightNote({ e }: { e: DiscountEditor }) {
  return e.overnightText ? <p className="m-0 font-mono text-12 text-muted">{e.overnightText}</p> : null;
}

/**
 * Qiymat: foizda — "−[35]%" (raqam qo'lda yoziladi, 1–100), boshqa turlarda matn.
 * 100% — "bepul" (talabaga "BEPUL" yorlig'i bilan chiqadi).
 */
export function ValueDisplay({ e, size }: { e: DiscountEditor; size: Size }) {
  const t = useTranslations("discountEditor");
  const look = size === "phone" ? "text-30 leading-none font-black text-orange font-stretch-62%" : "min-w-[140px] text-center text-64 leading-none font-black text-rust font-stretch-62%";
  if (e.type !== "PERCENT") {
    return (
      <span data-testid="discount-value" className={look}>
        {e.valueText}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-baseline justify-center", look)}>
      <span aria-hidden="true">−</span>
      <input
        data-testid="discount-value"
        aria-label={t("percentLabel")}
        inputMode="numeric"
        autoComplete="off"
        value={e.percentText}
        onChange={(x) => e.setPercentText(x.target.value)}
        style={{ width: `${Math.max(1, e.percentText.length)}ch` }}
        className="min-w-[1ch] border-0 bg-transparent p-0 text-center text-inherit outline-0"
      />
      <span aria-hidden="true">%</span>
    </span>
  );
}

/** Narx/foiz xatolari (qiymat qutisi ostida). */
export function ValueErrors({ e }: { e: DiscountEditor }) {
  const error = e.errorOf("percent") ?? e.errorOf("newPrice");
  return error ? <p className="m-0 text-12 font-semibold text-danger">{error}</p> : null;
}

/** Holat yozuvi (tahrirlashda) va umumiy xato. */
export function EditorNotes({ e, statusText, businessPending }: { e: DiscountEditor; statusText: string | null; businessPending: boolean }) {
  const t = useTranslations("discountEditor");
  return (
    <>
      {statusText ? <p className="m-0 rounded-12 bg-surface px-3.5 py-2.5 text-13 leading-[1.45] text-muted">{statusText}</p> : null}
      {businessPending ? <p className="m-0 rounded-12 bg-warn-bg px-3.5 py-2.5 text-13 leading-[1.45] text-warn">{t("pendingBusiness")}</p> : null}
      {e.failureText ? (
        <p role="alert" className="m-0 text-13 font-semibold text-danger">
          {e.failureText}
        </p>
      ) : null}
    </>
  );
}

/**
 * Chegirma rasmlari (4 tagacha): kichik rasmlar, "×" bilan olib tashlash, oxirida "+" (fayl tanlash).
 * Dizaynda chizilmagan — B2 dagi "+" belgisi uslubida. Fayllar saqlash paytida yuklanadi (tozalash serverda).
 */
export function ImagePicker({ e, id, size }: { e: DiscountEditor; id: string; size: Size }) {
  const t = useTranslations("discountEditor");
  const box = size === "phone" ? "size-16 rounded-12" : "size-[72px] rounded-12";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-13 font-semibold">{t("images")}</span>
        <span className="font-mono text-11 text-muted">{t("imagesHint", { count: e.images.length })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {e.images.map((image, i) => (
          <div key={image.key} className={cn("relative shrink-0 bg-surface", box)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: va himoyalangan API manzillari */}
            <img src={image.url} alt={t("imageAlt", { n: i + 1 })} className="size-full rounded-12 object-cover" />
            <button
              type="button"
              onClick={() => e.removeImage(image.key)}
              aria-label={t("removeImage", { n: i + 1 })}
              className="absolute -top-1.5 -right-1.5 flex size-[22px] items-center justify-center rounded-11 border-0 bg-ink p-0 text-white"
            >
              <Icon name="close" size={12} strokeWidth={2.6} />
            </button>
          </div>
        ))}
        {e.canAddImage ? (
          <label htmlFor={id} className={cn("flex shrink-0 cursor-pointer items-center justify-center border-hair border-dashed border-line-strong bg-white text-ink", box)}>
            <Icon name="plus" size={20} strokeWidth={2.4} />
            <span className="sr-only">{t("addImage")}</span>
          </label>
        ) : null}
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          multiple
          className="sr-only"
          onChange={(x) => {
            e.addImages(x.target.files);
            x.target.value = "";
          }}
        />
      </div>
      {e.imageErrorText ? <p className="m-0 text-12 font-semibold text-danger">{e.imageErrorText}</p> : null}
    </div>
  );
}
