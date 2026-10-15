import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { ActionButton, LinkRequestForm, UniversityForm } from "@/components/admin/manage/forms";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { listUniversities, lookups, pendingUniversityRequests, PAGE_SIZE, universityOne } from "@/server/admin/directory";
import { requireRole } from "@/server/auth/session";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 text-left text-12 font-semibold text-muted";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5 align-top";
const card = "flex min-w-0 flex-col gap-3.5 rounded-16 bg-white p-5";

function href(p: { q?: string; viloyat?: string; tur?: string; sahifa?: number; id?: string }) {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.viloyat) sp.set("viloyat", p.viloyat);
  if (p.tur) sp.set("tur", p.tur);
  if (p.sahifa && p.sahifa > 1) sp.set("sahifa", String(p.sahifa));
  if (p.id) sp.set("id", p.id);
  const s = sp.toString();
  return s ? `/admin/universitetlar?${s}` : "/admin/universitetlar";
}

// Universitetlar: so'rovlar ("Ro'yxatda yo'q"), ro'yxat (qidiruv, viloyat, tur), qo'shish va tahrirlash
async function UniversitiesContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/universitetlar">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const q = first(query.q).slice(0, 80);
  const region = first(query.viloyat).slice(0, 60);
  const kind = first(query.tur);
  const page = Math.max(1, Number.parseInt(first(query.sahifa), 10) || 1);
  const id = first(query.id).slice(0, 40);

  const [t, kinds, list, requests, editing, refs] = await Promise.all([
    getTranslations("adminManage"),
    getTranslations("universityKind"),
    listUniversities({ q, region, kind, page }),
    pendingUniversityRequests(),
    id ? universityOne(id) : Promise.resolve(null),
    lookups(),
  ]);
  const kindLabels = { STATE: kinds("STATE"), PRIVATE: kinds("PRIVATE"), FOREIGN: kinds("FOREIGN") };
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const editable = editing && editing.kind !== "OTHER" ? editing : null;
  const filter = { q, viloyat: region, tur: kind };

  return (
    <AdminShell user={admin} active="universities">
      <header>
        <div className="text-13 text-muted">{t("universities.sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("universities.title")}</h1>
      </header>

      <section className={card} aria-labelledby="req-title">
        <h2 id="req-title" className="m-0 text-18 font-extrabold">
          {t("universities.requestsTitle")} <span className="font-mono text-13 text-muted">{requests.length}</span>
        </h2>
        {requests.length === 0 ? <p className="m-0 text-14 text-muted">{t("universities.requestsEmpty")}</p> : <p className="m-0 text-12 text-muted">{t("universities.requestNote")}</p>}
        {requests.map((r) => (
          <div key={r.id} data-testid="university-request" className="flex flex-col gap-3 rounded-14 bg-paper p-4">
            <div>
              <b className="text-16">{r.name}</b>
              <div className="text-13 text-muted">{t("universities.requestBy", { name: [r.user.firstName, r.user.lastName].filter(Boolean).join(" ") || "—", phone: formatPhone(r.user.phone) })}</div>
            </div>
            <details>
              <summary className="cursor-pointer text-14 font-bold">{t("universities.requestAdd")}</summary>
              <div className="pt-3">
                <UniversityForm idPrefix={`req-${r.id}`} requestId={r.id} defaultName={r.name} regions={list.regions} kindLabels={kindLabels} submitLabel={t("universities.requestAdd")} />
              </div>
            </details>
            <div className="flex flex-col gap-1.5">
              <span className="text-13 font-semibold">{t("universities.requestLink")}</span>
              <LinkRequestForm requestId={r.id} universities={refs.universities} />
            </div>
            <ActionButton kind="rejectRequest" id={r.id} label={t("universities.requestReject")} />
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-start gap-3">
        <section className={cn(card, "flex-[2_1_520px]")}>
          <form action="/admin/universitetlar" method="get" className="flex flex-wrap gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label={t("search")}
              placeholder={t("universities.searchPlaceholder")}
              className="box-border h-11 min-w-[180px] flex-1 rounded-12 border-hair border-line bg-white px-3.5 font-sans text-14 text-ink outline-none focus:border-ink"
            />
            <select name="viloyat" defaultValue={region} aria-label={t("universities.region")} className="h-11 rounded-12 border-hair border-line bg-white px-3 font-sans text-14">
              <option value="">{t("universities.region")}: {t("all")}</option>
              {list.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select name="tur" defaultValue={kind} aria-label={t("universities.kind")} className="h-11 rounded-12 border-hair border-line bg-white px-3 font-sans text-14">
              <option value="">{t("universities.kind")}: {t("all")}</option>
              {(["STATE", "PRIVATE", "FOREIGN"] as const).map((k) => (
                <option key={k} value={k}>
                  {kinds(k)}
                </option>
              ))}
            </select>
            <button type="submit" className="h-11 rounded-12 border-0 bg-ink px-4 font-sans text-14 font-bold text-white">
              {t("search")}
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-14">
              <thead>
                <tr>
                  <th className={th}>{t("universities.columns.name")}</th>
                  <th className={th}>{t("universities.columns.region")}</th>
                  <th className={th}>{t("universities.columns.kind")}</th>
                  <th className={th}>{t("universities.columns.students")}</th>
                  <th className={th}>{t("universities.columns.state")}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={cn(td, "py-6 text-muted")}>
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
                {list.rows.map((u) => (
                  <tr key={u.id} className={cn(u.id === id && "bg-paper")}>
                    <td className={td}>
                      <Link href={href({ ...filter, sahifa: page, id: u.id })} className="font-bold text-ink no-underline">
                        {u.name}
                      </Link>
                      <div className="text-12 text-muted">{u.shortName}</div>
                    </td>
                    <td className={cn(td, "text-13")}>{u.region}</td>
                    <td className={cn(td, "text-13")}>{kinds(u.kind)}</td>
                    <td className={cn(td, "font-mono text-13")}>{u._count.students}</td>
                    <td className={cn(td, "text-13", !u.active && "font-bold text-warn")}>{u.active ? t("universities.active") : t("universities.inactive")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-13 text-muted">
            <span>{t("page", { page, total: list.total })}</span>
            <span className="flex gap-3">
              {page > 1 ? <Link href={href({ ...filter, sahifa: page - 1 })} className="font-bold text-ink">{t("prev")}</Link> : null}
              {page < pages ? <Link href={href({ ...filter, sahifa: page + 1 })} className="font-bold text-ink">{t("next")}</Link> : null}
            </span>
          </div>
          <p className="m-0 text-12 text-muted">{t("universities.sourceNote")}</p>
        </section>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3">
          {editable ? (
            <section className={card} aria-labelledby="edit-title">
              <h2 id="edit-title" className="m-0 text-18 font-extrabold">{t("universities.editTitle")}</h2>
              <UniversityForm key={editable.id} idPrefix="edit" university={editable} regions={list.regions} kindLabels={kindLabels} />
              {editable.source ? <p className="m-0 text-12 text-muted">{t("universities.source", { source: editable.source })}</p> : null}
              {editable._count.students > 0 ? (
                <p className="m-0 text-12 text-muted">{t("universities.hasStudents")}</p>
              ) : (
                <ActionButton kind="deleteUniversity" id={editable.id} label={t("delete")} confirm={t("deleteConfirm")} />
              )}
            </section>
          ) : null}
          <section className={card} aria-labelledby="add-title">
            <h2 id="add-title" className="m-0 text-18 font-extrabold">{t("universities.addTitle")}</h2>
            <UniversityForm idPrefix="add" regions={list.regions} kindLabels={kindLabels} submitLabel={t("add")} />
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

export default function AdminUniversitiesPage({ searchParams }: PageProps<"/[locale]/admin/universitetlar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UniversitiesContent searchParams={searchParams} />
    </Suspense>
  );
}
