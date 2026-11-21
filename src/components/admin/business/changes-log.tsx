import { getTranslations } from "next-intl/server";

export type ChangeRow = { id: string; role: "ADMIN" | "OWNER"; actor: string | null; field: string; oldValue: string | null; newValue: string | null; at: string };

/** O'zgarishlar jurnali: kim (admin yoki ega), qaysi maydon, oldin → keyin, vaqt. */
export async function ChangesLog({ rows }: { rows: ChangeRow[] }) {
  const t = await getTranslations("adminBusiness.changes");
  const status = await getTranslations("adminSuper.discountStatus");
  // Chegirma holati qiymati «nom»: ACTIVE — kod o'zbekcha nomga almashtiriladi
  const value = (f: string, v: string | null) => (f === "discount_status" && v ? v.replace(/(ACTIVE|PAUSED|PENDING_REVIEW|DRAFT|REJECTED|ENDED)$/, (code) => status(code as "ACTIVE")) : v);
  const field = (f: string) => (t.has(`fields.${f}` as "fields.name") ? t(`fields.${f}` as "fields.name") : f);
  return (
    <section className="mt-3 flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5" aria-label={t("title")}>
      <h3 className="m-0 text-16 font-extrabold">{t("title")}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-13 text-muted">{t("empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="changes-list">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-10 bg-paper px-3 py-2.5 text-13">
              <span className="font-mono text-12 text-muted">{r.at}</span>
              <span className="font-bold">
                {r.role === "ADMIN" ? t("admin") : t("owner")}
                {r.actor ? <span className="font-normal text-muted"> · {r.actor}</span> : null}
              </span>
              <span className="font-semibold">{field(r.field)}:</span>
              <span className="min-w-0 break-words">{t("arrow", { old: value(r.field, r.oldValue) ?? t("none"), new: value(r.field, r.newValue) ?? t("none") })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
