"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { addContactNoteAction } from "@/server/actions/admin-review";

export type NoteRow = { id: string; contacted: boolean; date: string; note: string; admin: string | null };

/** Aloqa qaydlari: "Bog'lanildi" belgisi, sana va ichki izoh (egasi ko'rmaydi) + yozuvlar tarixi. */
export function ContactNotes({ businessId, today, notes }: { businessId: string; today: string; notes: NoteRow[] }) {
  const t = useTranslations("adminBusiness.contact");
  const router = useRouter();
  const [contacted, setContacted] = useState(true);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await addContactNoteAction({ businessId, contacted, contactedAt: date, note });
      if (!result.ok) return setMessage({ ok: false, text: t(`errors.${result.error}` as "errors.empty") });
      setNote("");
      setMessage({ ok: true, text: t("saved") });
      router.refresh();
    });
  };

  return (
    <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={t("title")}>
      <h3 className="m-0 text-16 font-extrabold">{t("title")}</h3>
      <p className="m-0 text-13 text-muted">{t("hint")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex h-11 items-center gap-2 text-14 font-semibold">
          <input type="checkbox" checked={contacted} onChange={(e) => setContacted(e.target.checked)} className="size-4 accent-ink" data-testid="contacted" />
          {t("contacted")}
        </label>
        <Field label={t("date")} htmlFor="contact-date">
          <Input id="contact-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max="2100-01-01" />
        </Field>
      </div>
      <Field label={t("note")} htmlFor="contact-note">
        <Textarea id="contact-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button variant="blue" size="md" className="self-start" disabled={pending} aria-busy={pending} onClick={submit} data-testid="contact-add">
        {t("add")}
      </Button>
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={`m-0 text-13 font-bold ${message.ok ? "text-green" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
      {notes.length === 0 ? (
        <p className="m-0 text-13 text-muted">{t("empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="contact-list">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-0.5 rounded-10 bg-paper px-3 py-2.5 text-13">
              <span className="font-bold">
                {n.date} · {n.contacted ? t("contacted") : t("noteOnly")}
                {n.admin ? <span className="font-normal text-muted"> · {n.admin}</span> : null}
              </span>
              {n.note ? <span className="whitespace-pre-wrap">{n.note}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
