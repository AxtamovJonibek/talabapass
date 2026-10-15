"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { BusinessShell } from "../business-shell";
import { CategoryTile, DayPicker, EditorNotes, ImagePicker, LimitField, OvernightNote, PeriodField, TimeFields, TypePicker, ValueDisplay, ValueErrors } from "./editor-parts";
import type { EditorViewProps } from "./editor-mobile";

/** "Talabalar qachon keladi" issiqlik xaritasi: ikki qator (ish kunlari, dam olish), 08–22 ikki soatlik ustunlar. */
export type VisitHint = { levels: [number[], number[]]; peak: { row: 0 | 1; hour: number }; quiet: { row: 0 | 1; hour: number } } | null;

const HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const LEVEL = ["bg-ink-4", "bg-heat-1", "bg-heat-2", "bg-heat-3"] as const;
const pad = (h: number) => String(h).padStart(2, "0");

function Hint({ hint }: { hint: VisitHint }) {
  const t = useTranslations("discountEditor.hint");
  const slot = (s: { row: 0 | 1; hour: number }) => `${t(s.row === 0 ? "weekdaysLong" : "weekendLong")} ${pad(s.hour)}:00–${pad((s.hour + 2) % 24)}:00`;
  return (
    <div className="flex flex-col gap-2.5 rounded-18 bg-ink p-[18px] text-paper">
      <b className="text-15">{t("title")}</b>
      {hint ? (
        <>
          <div className="grid grid-cols-[26px_repeat(8,minmax(0,1fr))] gap-[3px] font-mono text-10 text-fog-3">
            <span />
            {HOURS.map((h) => (
              <span key={h}>{pad(h)}</span>
            ))}
            {hint.levels.map((row, i) => (
              <div key={i} className="contents">
                <span>{t(i === 0 ? "weekdays" : "weekend")}</span>
                {row.map((level, j) => (
                  <span key={j} className={cn("h-[18px] rounded-3", LEVEL[level])} />
                ))}
              </div>
            ))}
          </div>
          <p className="m-0 text-14 leading-[1.5] text-fog-0">{t("text", { peak: slot(hint.peak), quiet: slot(hint.quiet) })}</p>
        </>
      ) : (
        <p className="m-0 text-14 leading-[1.5] text-fog-0">{t("empty")}</p>
      )}
    </div>
  );
}

/** WB2 — chegirma yaratish / tahrirlash (veb, biznes kabineti ichida). */
export function EditorWeb({ e, category, businessName, statusText, businessPending, live, hint }: EditorViewProps & { hint: VisitHint }) {
  const t = useTranslations("discountEditor");

  return (
    <BusinessShell active="discounts">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-13 text-muted">{e.id ? t("crumbEdit") : t("crumbNew")}</div>
          <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{e.id ? t("editTitle") : t("newTitle")}</h1>
        </div>
        <div className="flex gap-2">
          {live ? null : (
            <Button variant="outline" size="md" onClick={e.draft} disabled={e.pending}>
              {t("draft")}
            </Button>
          )}
          <Button variant="orange" size="md-wide" onClick={e.publish} disabled={e.pending}>
            {e.pending ? t("saving") : live ? t("save") : t("publish")}
          </Button>
        </div>
      </header>

      <EditorNotes e={e} statusText={statusText} businessPending={businessPending} />

      <div className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[3_1_480px] flex-col gap-3">
          <section className="flex flex-col gap-3.5 rounded-18 bg-white p-5">
            <h2 className="m-0 text-17 font-extrabold">{t("sectionWhat")}</h2>
            <div className="flex flex-wrap items-center gap-3.5">
              <CategoryTile category={category} size={96} image={e.images[0]?.url} />
              <div className="grid flex-[1_1_260px] grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2.5">
                <Field label={t("product")} htmlFor="wb2-title" error={e.errorOf("title")} className="col-span-full">
                  <Input id="wb2-title" compact placeholder={t("productPlaceholder")} value={e.title} onChange={(x) => e.setTitle(x.target.value)} invalid={Boolean(e.errorOf("title"))} />
                </Field>
                <Field label={t("originalPrice")} htmlFor="wb2-price" error={e.errorOf("originalPrice")}>
                  <Input
                    id="wb2-price"
                    compact
                    mono={15}
                    inputMode="numeric"
                    value={e.original}
                    onChange={(x) => e.setOriginal(x.target.value)}
                    invalid={Boolean(e.errorOf("originalPrice"))}
                  />
                </Field>
              </div>
            </div>
            <ImagePicker e={e} id="wb2-images" size="web" />
          </section>

          <section className="flex flex-col gap-3.5 rounded-18 bg-white p-5">
            <h2 className="m-0 text-17 font-extrabold">{t("sectionType")}</h2>
            <TypePicker e={e} size="web" />
            <div className="flex flex-wrap items-center gap-3.5">
              {e.type === "BOGO" ? null : (
                <button type="button" aria-label={t("decrease")} onClick={e.decrease} className="size-13 rounded-14 border-hair border-ink bg-white font-sans text-22 font-extrabold text-ink">
                  −
                </button>
              )}
              <ValueDisplay e={e} size="web" />
              {e.type === "BOGO" ? null : (
                <button type="button" aria-label={t("increase")} onClick={e.increase} className="size-13 rounded-14 border-hair border-ink bg-white font-sans text-22 font-extrabold text-ink">
                  +
                </button>
              )}
              {e.calc ? <span className="text-15 text-muted">{e.calc}</span> : null}
            </div>
            <ValueErrors e={e} />
          </section>

          <section className="flex flex-col gap-3.5 rounded-18 bg-white p-5">
            <h2 className="m-0 text-17 font-extrabold">{t("sectionWhen")}</h2>
            <div className="flex flex-col gap-2">
              <span className="text-13 font-semibold">{t("daysWeb", { count: e.dayCount })}</span>
              <DayPicker e={e} size="web" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-2.5">
              <TimeFields e={e} prefix="wb2" />
              <LimitField e={e} prefix="wb2" />
              <Field label={t("perStudent")} htmlFor="wb2-per">
                <Select id="wb2-per" native compact value={e.perStudent} onChange={(x) => e.setPerStudent(x.target.value as typeof e.perStudent)}>
                  {(["DAILY", "WEEKLY", "UNLIMITED"] as const).map((v) => (
                    <option key={v} value={v}>
                      {t(`perStudentOptions.${v}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <PeriodField e={e} prefix="wb2" />
            </div>
            <OvernightNote e={e} />
          </section>
        </div>

        <aside className="sticky top-5 flex min-w-0 flex-[2_1_320px] flex-col gap-3">
          <div className="flex flex-col gap-2.5 rounded-18 border-hair border-dashed border-placeholder p-4">
            <span className="text-12 font-extrabold tracking-[0.06em] text-muted">{t("previewWeb")}</span>
            <div className="rounded-18 bg-white">
              <div className="relative mx-2.5 mt-2.5 flex h-35 items-center justify-center rounded-12" style={{ background: category.tileColor, color: category.inkColor }}>
                {e.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- blob: va himoyalangan API manzillari
                  <img src={e.images[0].url} alt="" className="absolute inset-0 size-full rounded-12 object-cover" />
                ) : (
                  <Icon name={category.icon} size={64} strokeWidth={1.1} />
                )}
                <span className="absolute -top-1.5 -left-1 -rotate-5 rounded-8 bg-orange px-2 pt-[5px] pb-[3px] text-24 leading-none font-black text-ink font-stretch-65%">
                  {e.badge}
                </span>
              </div>
              <div className="flex flex-col gap-[3px] px-4 pt-3 pb-3.5">
                <span className="text-13 text-muted">{businessName}</span>
                <b className="text-17">{e.title || t("productPlaceholder")}</b>
                <b className="mt-1 text-18">{e.previewPrice}</b>
              </div>
              <div className="mx-3.5 border-t-[1.5px] border-dashed border-dash" />
              <div className="px-4 pt-2.5 pb-3.5 text-13 font-bold text-green">{e.when}</div>
            </div>
          </div>
          <Hint hint={hint} />
        </aside>
      </div>
    </BusinessShell>
  );
}
