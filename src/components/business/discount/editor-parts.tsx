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
export function CategoryTile({ category, size, plus = false, children }: { category: Category; size: number; plus?: boolean; children?: React.ReactNode }) {
  const radius = size >= 96 ? "rounded-14" : size >= 64 ? "rounded-12" : "rounded-10";
  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", radius)}
      style={{ width: size, height: size, background: category.tileColor, color: category.inkColor }}
    >
      {size > 52 ? <Icon name={category.icon} size={Math.round(size / 1.9)} strokeWidth={size >= 96 ? 1.3 : 1.4} /> : null}
      {/* Rasm qo'shish belgisi (dizayndagidek). Chegirma rasmlari 7-bosqichda ulanadi. TODO(7-bosqich) */}
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
