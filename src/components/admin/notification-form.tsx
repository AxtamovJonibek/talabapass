"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/segmented";
import { useRouter } from "@/i18n/navigation";
import { BODY_MAX, TITLE_MAX, type AudienceKey } from "@/lib/notifications";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";
import { audienceReachAction, sendNotificationAction } from "@/server/actions/admin-notifications";

type Option = { id: string; label: string; count: number };

export type NotificationFormOptions = {
  universities: Option[];
  districts: Option[];
  categories: { slug: string; name: string }[];
  discounts: { id: string; label: string }[];
  totals: { all: number; businesses: number };
  /** Rejalashtirish uchun standart vaqt: ertaga 08:30 (datetime-local, Toshkent) */
  defaultLater: string;
};

const AUDIENCE_CHIPS: AudienceKey[] = ["ALL_STUDENTS", "UNIVERSITY", "DISTRICT", "BUSINESSES"];

/** A3 — bildirishnoma yuborish: auditoriya, matn, havola, vaqt; o'ngda telefondagi ko'rinishi. */
export function NotificationForm({ options }: { options: NotificationFormOptions }) {
  const t = useTranslations("admin.notifications");
  const router = useRouter();
  const [audience, setAudience] = useState<AudienceKey>("UNIVERSITY");
  const [ids, setIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("HOME");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState(options.defaultLater);
  const [reach, setReach] = useState<number | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Qamrov: ALL/BUSINESSES — tayyor; universitet/hudud — tanlovga qarab serverdan (tumanlar kesishishi mumkin)
  useEffect(() => {
    if (audience === "ALL_STUDENTS" || audience === "BUSINESSES") return;
    if (ids.length === 0) return;
    let cancelled = false;
    void audienceReachAction({ audience, ids }).then((n) => {
      if (!cancelled) setReach(n);
    });
    return () => {
      cancelled = true;
    };
  }, [audience, ids]);

  const reachNow = audience === "ALL_STUDENTS" ? options.totals.all : audience === "BUSINESSES" ? options.totals.businesses : ids.length === 0 ? 0 : reach;
  const choices = audience === "UNIVERSITY" ? options.universities : audience === "DISTRICT" ? options.districts : [];

  function pickAudience(next: AudienceKey) {
    setAudience(next);
    setIds([]);
    setReach(null);
    // Biznes egalariga faqat "asosiy sahifa" havolasi
    if (next === "BUSINESSES") setLink("HOME");
  }

  function toggle(id: string) {
    setIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function submit() {
    setNote(null);
    const [linkType, linkId] = link.split(":") as ["HOME" | "CATEGORY" | "DISCOUNT", string | undefined];
    startTransition(async () => {
      const result = await sendNotificationAction({
        audience,
        audienceIds: ids,
        title,
        body,
        linkType,
        linkId,
        when,
        scheduledAt: when === "later" ? scheduledAt : undefined,
      });
      if (!result.ok) return setNote({ tone: "bad", text: t(`errors.${result.error}`) });
      setNote({ tone: "ok", text: t(result.immediate ? "sentNow" : "sentLater") });
      setTitle("");
      setBody("");
      setIds([]);
      setLink("HOME");
      router.refresh();
    });
  }

  const unit = audience === "BUSINESSES" ? t("unitBusiness") : t("unitStudent");
  const whenLabel = when === "now" ? t("whenNow") : scheduledAt.slice(11, 16);
  const ready = title.trim().length > 0 && body.trim().length > 0 && (audience === "ALL_STUDENTS" || audience === "BUSINESSES" || ids.length > 0);

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      <form action={submit} className="flex min-w-0 flex-[2_1_520px] flex-col gap-4 rounded-16 bg-white p-[22px]">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 p-0 text-13 font-bold">{t("whom")}</legend>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCE_CHIPS.map((key) => (
              <Chip key={key} selected={audience === key} onClick={() => pickAudience(key)}>
                {t(`audience.${key}`)}
              </Chip>
            ))}
          </div>
          {choices.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-12 bg-paper p-2.5">
              <span className="mr-1 text-12 text-muted">{t(audience === "UNIVERSITY" ? "universities" : "districts")}</span>
              {choices.map((option) => {
                const on = ids.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(option.id)}
                    className={cn(
                      "flex h-[30px] items-center rounded-15 border-hair px-2.5 font-sans text-13 font-bold",
                      on ? "border-blue bg-blue text-white" : "border-line bg-white text-ink",
                    )}
                  >
                    {option.label}
                    {audience === "UNIVERSITY" ? ` · ${formatSom(option.count)}` : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {audience === "DISTRICT" ? <p className="mt-2 mb-0 text-12 text-muted">{t("districtHint")}</p> : null}
          <div className="mt-2.5 text-13 text-muted">
            {t("reach")} <b className="font-mono text-ink">{reachNow == null ? "…" : formatSom(reachNow)}</b> {unit}
          </div>
        </fieldset>

        <Field label={t("titleLabel")} htmlFor="notification-title" counter={`${title.length}/${TITLE_MAX}`}>
          <Input id="notification-title" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
        </Field>
        <Field label={t("bodyLabel")} htmlFor="notification-body" counter={`${body.length}/${BODY_MAX}`}>
          <Textarea id="notification-body" rows={3} value={body} maxLength={BODY_MAX} onChange={(e) => setBody(e.target.value)} placeholder={t("bodyPlaceholder")} />
        </Field>

        <div className="flex flex-wrap gap-3">
          <Field label={t("link")} htmlFor="notification-link" className="min-w-[220px] flex-[1_1_220px]">
            <Select id="notification-link" native value={link} disabled={audience === "BUSINESSES"} onChange={(e) => setLink(e.target.value)}>
              <option value="HOME">{t("linkHome")}</option>
              {options.categories.map((c) => (
                <option key={c.slug} value={`CATEGORY:${c.slug}`}>
                  {t("linkCategory", { name: c.name })}
                </option>
              ))}
              {options.discounts.map((d) => (
                <option key={d.id} value={`DISCOUNT:${d.id}`}>
                  {t("linkDiscount", { name: d.label })}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex min-w-[220px] flex-[1_1_220px] flex-col gap-1.5">
            <span className="text-13 font-semibold">{t("when")}</span>
            <Segmented
              size="choice-lg"
              label={t("when")}
              value={when}
              onChange={setWhen}
              options={[
                { value: "now", label: t("whenNow") },
                { value: "later", label: t("whenLater") },
              ]}
            />
          </div>
        </div>
        {when === "later" ? (
          <Field label={t("scheduledAt")} htmlFor="notification-at" hint={t("tashkent")} className="max-w-[320px]">
            <Input id="notification-at" type="datetime-local" mono={15} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </Field>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-3 border-0 border-t-[1.5px] border-dashed border-dash pt-4">
          <Button type="submit" size="wide" strong disabled={pending || !ready}>
            <Icon name="share" size={18} strokeWidth={2.2} />
            {t(when === "now" ? "send" : "schedule")}
          </Button>
          {note ? (
            <span role={note.tone === "bad" ? "alert" : "status"} className={cn("text-13", note.tone === "bad" ? "font-semibold text-danger" : "text-muted")}>
              {note.text}
            </span>
          ) : null}
        </div>
      </form>

      <div className="flex min-w-0 flex-[1_1_300px] flex-col items-center gap-3.5 rounded-16 bg-ink p-[22px]">
        <div className="self-stretch text-12 font-bold tracking-[0.06em] text-fog-3">{t("preview")}</div>
        <div className="relative box-border h-[400px] w-[270px] max-w-full overflow-hidden rounded-[40px] border-8 border-solid border-ink-4 bg-blue px-3 pt-[70px]">
          <div aria-hidden="true" className="absolute -bottom-[60px] -left-10 size-[220px] rounded-full border-[34px] border-solid border-blue-2" />
          <div className="relative flex gap-2.5 rounded-18 bg-paper-2 p-3">
            <div className="flex size-[34px] shrink-0 items-center justify-center rounded-9 bg-ink text-13 font-black text-white font-stretch-125%">tP</div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex justify-between text-11 text-muted">
                <span>talabaPass</span>
                <span>{whenLabel}</span>
              </div>
              <div className="text-14 leading-[1.25] font-extrabold text-ink">{title || t("titlePlaceholder")}</div>
              <div className="text-13 leading-[1.35] text-ink-5 [overflow-wrap:anywhere]">{body || t("bodyPlaceholder")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
