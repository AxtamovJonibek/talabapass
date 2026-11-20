import { getTranslations } from "next-intl/server";

export type ChangeRow = { id: string; role: "ADMIN" | "OWNER"; actor: string | null; field: string; oldValue: string | null; newValue: string | null; at: string };

/** O'zgarishlar jurnali: kim (admin yoki ega), qaysi maydon, oldin → keyin, vaqt. */
export async function ChangesLog({ rows }: { rows: ChangeRow[] }) {
  const t = await getTranslations("adminBusiness.changes");
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
              <span className="min-w-0 break-words">{t("arrow", { old: r.oldValue ?? t("none"), new: r.newValue ?? t("none") })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
