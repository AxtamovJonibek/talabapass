"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { CategoryTile, DayPicker, EditorNotes, LimitField, OvernightNote, PeriodField, TimeFields, TypePicker, ValueErrors, type Category } from "./editor-parts";
import type { DiscountEditor } from "./use-discount-editor";

export type EditorViewProps = {
  e: DiscountEditor;
  category: Category;
  businessName: string;
  statusText: string | null;
  businessPending: boolean;
  /** Tasdiqlangan chegirmani tahrirlash: "E'lon qilish" o'rniga "Saqlash", qoralama yo'q */
  live: boolean;
};

/** B2 — chegirma yaratish / tahrirlash (telefon). */
export function EditorMobile({ e, category, businessName, statusText, businessPending, live }: EditorViewProps) {
  const t = useTranslations("discountEditor");

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <div className="flex items-center gap-2.5 border-b border-solid border-line-soft px-4 pt-[54px] pb-3">
        <Link href="/biznes/chegirmalar" aria-label={t("back")} className="flex size-11 items-center justify-center rounded-22 bg-white text-ink">
          <Icon name="chevronLeft" size={20} />
        </Link>
        <h1 className="m-0 flex-1 text-20 font-extrabold tracking-[-0.02em] font-stretch-110%">{e.id ? t("editTitle") : t("newTitle")}</h1>
        {live ? null : (
          <button type="button" onClick={e.draft} disabled={e.pending} className="h-10 border-0 bg-transparent px-3 font-sans text-14 font-semibold text-muted">
            {t("draft")}
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
        <EditorNotes e={e} statusText={statusText} businessPending={businessPending} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 rounded-16 bg-white p-2.5">
            <CategoryTile category={category} size={64} plus />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor="b2-title" className="text-12 text-muted">
                {t("product")}
              </label>
              <input
                id="b2-title"
                value={e.title}
                onChange={(x) => e.setTitle(x.target.value)}
                placeholder={t("productPlaceholder")}
                className="min-w-0 border-0 bg-transparent p-0 font-sans text-16 font-bold text-ink outline-0"
              />
            </div>
          </div>
          {e.errorOf("title") ? <p className="m-0 text-12 font-semibold text-danger">{e.errorOf("title")}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-13 font-semibold">{t("type")}</span>
          <TypePicker e={e} size="phone" />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 rounded-14 bg-white px-3.5 py-3">
              <label htmlFor="b2-price" className="text-12 text-muted">
                {t("originalPrice")}
              </label>
              <input
                id="b2-price"
                inputMode="numeric"
                value={e.original}
                onChange={(x) => e.setOriginal(x.target.value)}
                className="min-w-0 border-0 bg-transparent p-0 font-mono text-18 font-semibold text-ink outline-0"
              />
            </div>
            <div className="flex items-center justify-between rounded-14 bg-ink py-2.5 pr-2 pl-3.5 text-white">
              <div className="flex flex-col gap-0.5">
                <span className="text-12 text-fog-2">{t(`valueLabel.${e.type}`)}</span>
                <span data-testid="discount-value" className="text-30 leading-none font-black text-orange font-stretch-62%">
                  {e.valueText}
                </span>
              </div>
              {e.type === "BOGO" ? null : (
                <div className="flex flex-col gap-1">
                  <button type="button" aria-label={t("increase")} onClick={e.increase} className="h-[26px] w-8 rounded-7 border-0 bg-ink-4 font-sans text-16 font-bold text-white">
                    +
                  </button>
                  <button type="button" aria-label={t("decrease")} onClick={e.decrease} className="h-[26px] w-8 rounded-7 border-0 bg-ink-4 font-sans text-16 font-bold text-white">
                    −
                  </button>
                </div>
              )}
            </div>
          </div>
          {e.errorOf("originalPrice") ? <p className="m-0 text-12 font-semibold text-danger">{e.errorOf("originalPrice")}</p> : null}
          <ValueErrors e={e} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="flex justify-between text-13 font-semibold">
            {t("days")} <span className="font-normal text-muted">{t("daysCount", { count: e.dayCount })}</span>
          </span>
          <DayPicker e={e} size="phone" />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2.5">
            <TimeFields e={e} prefix="b2" />
          </div>
          <OvernightNote e={e} />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <LimitField e={e} prefix="b2" />
          <PeriodField e={e} prefix="b2" />
        </div>

        <div className="flex flex-col gap-2 rounded-16 border-hair border-dashed border-line-strong p-3">
          <span className="text-12 font-bold tracking-[0.05em] text-muted">{t("previewMobile")}</span>
          <div className="flex items-center gap-2.5 rounded-12 bg-white p-2.5">
            <CategoryTile category={category} size={52}>
              <span className="absolute -top-1.5 -left-1 -rotate-6 rounded-5 bg-orange px-[5px] py-[3px] text-13 font-black text-ink font-stretch-70%">{e.badge}</span>
            </CategoryTile>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-11 text-muted">{businessName}</span>
              <span className="text-14 font-bold">{e.title || t("productPlaceholder")}</span>
              <span className="text-13 font-extrabold">
                {e.previewPrice}
                {e.previewInstead ? `  ·  ${e.previewInstead}` : null}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-solid border-line-soft bg-paper px-4 pt-3 pb-[30px]">
        <Button variant="orange" block onClick={e.publish} disabled={e.pending}>
          {e.pending ? t("saving") : live ? t("save") : t("publish")}
        </Button>
      </div>
    </div>
  );
}
