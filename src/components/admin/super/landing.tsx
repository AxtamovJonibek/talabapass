"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "@/i18n/navigation";
import {
  addCustomPartnerAction,
  deleteCustomPartnerAction,
  removePartnerLogoAction,
  saveLandingSettingsAction,
  savePartnerAction,
  type SuperActionResult,
} from "@/server/actions/admin-super";
import { UploadButton } from "./controls";

type StatsMode = "AUTO" | "MANUAL" | "HIDDEN";
type DealsMode = "AUTO" | "MANUAL" | "MIXED";
export type LandingSettingsView = {
  statsMode: StatsMode;
  statsStudents: number | null;
  statsBusinesses: number | null;
  statsDiscounts: number | null;
  statsSaved: number | null;
  dealsMode: DealsMode;
  dealIds: string[];
};
type Deal = { id: string; title: string; business: string };
export type PartnerView = { businessId: string | null; partnerId: string | null; name: string; sort: number; hidden: boolean; hasLogo: boolean; hasBusinessLogo: boolean; custom: boolean };

const STATS_FIELDS = [
  ["statsStudents", "students"],
  ["statsBusinesses", "businesses"],
  ["statsDiscounts", "discounts"],
  ["statsSaved", "saved"],
] as const;

function useSave() {
  const t = useTranslations("adminSuper");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (fn: () => Promise<SuperActionResult>) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? { ok: true, text: t("saved") } : { ok: false, text: t(`errors.${r.error ?? "failed"}` as "errors.failed") });
      if (r.ok) router.refresh();
    });
  return { save, pending, message };
}

function Note({ message }: { message: { ok: boolean; text: string } | null }) {
  return message ? (
    <span role={message.ok ? "status" : "alert"} className={message.ok ? "text-13 font-bold text-green" : "text-13 font-bold text-danger"}>
      {message.text}
    </span>
  ) : null;
}

/**
 * Landing sozlamalari: "Raqamlarda" (avtomatik / qo'lda / yashirin + qo'lda raqamlar) va "Hozir Toshkentda ochiq"
 * (avtomatik / tanlanganlar / aralash + tartibli tanlov). Bitta "Saqlash".
 */
export function LandingSettingsForm({ initial, deals }: { initial: LandingSettingsView; deals: Deal[] }) {
  const t = useTranslations("adminSuper.landing");
  const s = useTranslations("adminSuper");
  const [value, setValue] = useState(initial);
  const [numbers, setNumbers] = useState(() => Object.fromEntries(STATS_FIELDS.map(([k]) => [k, initial[k] === null ? "" : String(initial[k])])) as Record<(typeof STATS_FIELDS)[number][0], string>);
  const [pick, setPick] = useState("");
  const { save, pending, message } = useSave();
  const byId = new Map(deals.map((d) => [d.id, d]));
  const move = (i: number, d: -1 | 1) =>
    setValue((v) => {
      const ids = [...v.dealIds];
      const j = i + d;
      if (j < 0 || j >= ids.length) return v;
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      return { ...v, dealIds: ids };
    });

  const submit = () => {
    const parsed = Object.fromEntries(STATS_FIELDS.map(([k]) => [k, numbers[k].trim() === "" ? null : Number(numbers[k].replace(/\D/g, ""))]));
    save(() => saveLandingSettingsAction({ ...value, ...parsed }));
  };

  return (
    <div className="flex flex-col gap-5" data-testid="landing-settings">
      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-16 font-extrabold">{t("stats.title")}</h3>
        <Segmented
          size="choice"
          label={t("stats.title")}
          value={value.statsMode}
          onChange={(mode) => setValue((v) => ({ ...v, statsMode: mode }))}
          options={(["AUTO", "MANUAL", "HIDDEN"] as const).map((m) => ({ value: m, label: t(`stats.modes.${m}`) }))}
        />
        <p className="m-0 text-12 text-muted">{value.statsMode === "MANUAL" ? t("stats.manualHint") : t("stats.autoHint")}</p>
        {value.statsMode === "MANUAL" ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
            {STATS_FIELDS.map(([key, label]) => (
              <Field key={key} label={t(`stats.${label}`)} htmlFor={`landing-${key}`}>
                <Input id={`landing-${key}`} inputMode="numeric" compact mono={14} value={numbers[key]} onChange={(e) => setNumbers((n) => ({ ...n, [key]: e.target.value }))} />
              </Field>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-16 font-extrabold">{t("deals.title")}</h3>
        <Segmented
          size="choice"
          label={t("deals.title")}
          value={value.dealsMode}
          onChange={(mode) => setValue((v) => ({ ...v, dealsMode: mode }))}
          options={(["AUTO", "MANUAL", "MIXED"] as const).map((m) => ({ value: m, label: t(`deals.modes.${m}`) }))}
        />
        {value.dealsMode !== "AUTO" ? (
          <>
            <span className="text-13 font-semibold">{t("deals.picked")}</span>
            {value.dealIds.length === 0 ? <p className="m-0 text-13 text-muted">{t("deals.nonePicked")}</p> : null}
            <ol className="m-0 flex flex-col gap-1.5 pl-5" data-testid="picked-deals">
              {value.dealIds.map((id, i) => {
                const deal = byId.get(id);
                return (
                  <li key={id} className="text-13">
                    <span className="flex flex-wrap items-center gap-2">
                      <b>{deal ? deal.title : id}</b>
                      <span className="text-muted">{deal?.business ?? ""}</span>
                      <Button variant="ghost" size="sm" aria-label={t("deals.up")} onClick={() => move(i, -1)}>
                        ↑
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={t("deals.down")} onClick={() => move(i, 1)}>
                        ↓
                      </Button>
                      <Button variant="danger-ghost" size="sm" onClick={() => setValue((v) => ({ ...v, dealIds: v.dealIds.filter((x) => x !== id) }))}>
                        {t("deals.remove")}
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ol>
            {value.dealIds.length < 12 ? (
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t("deals.pick")} htmlFor="landing-deal-pick">
                  <Select native compact id="landing-deal-pick" value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">—</option>
                    {deals
                      .filter((d) => !value.dealIds.includes(d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title} · {d.business}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Button
                  variant="outline-soft"
                  size="sm"
                  disabled={!pick}
                  onClick={() => {
                    setValue((v) => ({ ...v, dealIds: [...v.dealIds, pick] }));
                    setPick("");
                  }}
                >
                  {t("deals.add")}
                </Button>
              </div>
            ) : null}
            <p className="m-0 text-12 text-muted">{t("deals.hint")}</p>
          </>
        ) : null}
      </section>

      <div className="flex items-center gap-3">
        <Button variant="ink" size="sm" loading={pending} onClick={submit} data-testid="landing-save">
          {s("save")}
        </Button>
        <Note message={message} />
      </div>
    </div>
  );
}

/** Hamkor qatori: nom, tartib, yashirin, logotip (yuklash/o'chirish), qo'lda qo'shilganini o'chirish */
export function PartnerRow({ partner }: { partner: PartnerView }) {
  const t = useTranslations("adminSuper.landing.partners");
  const s = useTranslations("adminSuper");
  const [sort, setSort] = useState(String(partner.sort));
  const [hidden, setHidden] = useState(partner.hidden);
  const [name, setName] = useState(partner.name);
  const { save, pending, message } = useSave();
  const key = partner.businessId ?? partner.partnerId ?? partner.name;
  const target = partner.businessId ? `biznes=${partner.businessId}` : `hamkor=${partner.partnerId}`;
  return (
    <tr className="align-middle" data-testid="landing-partner">
      <td className="border-0 border-b border-solid border-surface p-2 text-13">
        {partner.custom ? (
          <Input aria-label={t("name")} compact value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        ) : (
          <b>{partner.name}</b>
        )}
        {partner.custom ? <div className="text-12 text-muted">{t("custom")}</div> : null}
      </td>
      <td className="border-0 border-b border-solid border-surface p-2">
        <Input aria-label={t("sort")} inputMode="numeric" compact mono={14} value={sort} onChange={(e) => setSort(e.target.value)} className="w-20" id={`sort-${key}`} />
      </td>
      <td className="border-0 border-b border-solid border-surface p-2">
        <Switch small checked={hidden} onChange={setHidden} label={t("hidden")} id={`hidden-${key}`} />
      </td>
      <td className="border-0 border-b border-solid border-surface p-2 text-12">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">{partner.hasLogo ? t("logo") : partner.hasBusinessLogo ? t("ownLogo") : t("textLogo")}</span>
          <UploadButton query={`tur=hamkor&${target}`} label={s("partners.upload")} />
          {partner.hasLogo && partner.partnerId ? (
            <Button variant="danger-ghost" size="sm" loading={pending} onClick={() => save(() => removePartnerLogoAction({ partnerId: partner.partnerId! }))}>
              {s("partners.remove")}
            </Button>
          ) : null}
        </div>
      </td>
      <td className="border-0 border-b border-solid border-surface p-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ink"
            size="sm"
            loading={pending}
            onClick={() => save(() => savePartnerAction({ businessId: partner.businessId, partnerId: partner.businessId ? null : partner.partnerId, sort: Number(sort) || 0, hidden, ...(partner.custom ? { name } : {}) }))}
          >
            {s("save")}
          </Button>
          {partner.custom && partner.partnerId ? (
            <Button variant="danger-ghost" size="sm" onClick={() => save(() => deleteCustomPartnerAction({ partnerId: partner.partnerId! }))}>
              {t("delete")}
            </Button>
          ) : null}
          <Note message={message} />
        </div>
      </td>
    </tr>
  );
}

export function AddPartnerForm() {
  const t = useTranslations("adminSuper.landing.partners");
  const [name, setName] = useState("");
  const { save, pending, message } = useSave();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={t("customName")} htmlFor="landing-custom-name">
        <Input id="landing-custom-name" compact value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <Button
        variant="outline-soft"
        size="sm"
        loading={pending}
        disabled={!name.trim()}
        onClick={() =>
          save(async () => {
            const r = await addCustomPartnerAction({ name });
            if (r.ok) setName("");
            return r;
          })
        }
      >
        {t("addCustom")}
      </Button>
      <Note message={message} />
    </div>
  );
}
