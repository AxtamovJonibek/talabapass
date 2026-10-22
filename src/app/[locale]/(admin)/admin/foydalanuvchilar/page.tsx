import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { BusinessAdminForm, UserEditForm } from "@/components/admin/manage/forms";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { BUSINESS_KINDS } from "@/lib/business";
import { businessFull, listUsers, lookups, PAGE_SIZE, userDetail, type UserRole } from "@/server/admin/directory";
import { requireRole } from "@/server/auth/session";

const ROLES = ["STUDENT", "BUSINESS_OWNER", "CASHIER"] as const satisfies readonly UserRole[];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 text-left text-12 font-semibold text-muted";
const td = "border-0 border-b border-solid border-surface px-2 py-2.5 align-top";
const tab = (on: boolean) => cn("tp-lift flex h-[34px] items-center gap-2 rounded-8 px-3 text-13 font-bold text-ink no-underline", on ? "bg-white" : "bg-transparent");
const day = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");

function href(params: { rol: string; q?: string; sahifa?: number; id?: string }) {
  const sp = new URLSearchParams({ rol: params.rol });
  if (params.q) sp.set("q", params.q);
  if (params.sahifa && params.sahifa > 1) sp.set("sahifa", String(params.sahifa));
  if (params.id) sp.set("id", params.id);
  return `/admin/foydalanuvchilar?${sp}`;
}

// Foydalanuvchilar: ro'yxat (qidiruv, rol) + tanlangan odamning barcha ma'lumotlari va tahrirlash
async function UsersContent({ searchParams }: { searchParams: PageProps<"/[locale]/admin/foydalanuvchilar">["searchParams"] }) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const rolParam = first(query.rol);
  const role: UserRole = (ROLES as readonly string[]).includes(rolParam) ? (rolParam as UserRole) : "STUDENT";
  const q = first(query.q).slice(0, 80);
  const page = Math.max(1, Number.parseInt(first(query.sahifa), 10) || 1);
  const id = first(query.id).slice(0, 40);

  const [t, kinds, list, detail, refs] = await Promise.all([
    getTranslations("adminManage"),
    getTranslations("businessKind"),
    listUsers({ role, q, page }),
    id ? userDetail(id) : Promise.resolve(null),
    lookups(),
  ]);
  const business = detail?.ownedBusinesses[0] ? await businessFull(detail.ownedBusinesses[0].id) : null;
  const pages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const kindLabels = Object.fromEntries(BUSINESS_KINDS.map((k) => [k, kinds(k)]));
  const nameOf = (u: { firstName: string | null; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(" ") || "—";

  return (
    <AdminShell user={admin} active="users">
      <header>
        <div className="text-13 text-muted">{t("users.sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("users.title")}</h1>
      </header>

      <div className="flex flex-wrap items-start gap-3">
        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 rounded-16 bg-white p-5">
          <div role="tablist" aria-label={t("users.title")} className="flex w-fit flex-wrap gap-[3px] rounded-10 bg-admin-bg p-[3px]">
            {ROLES.map((r) => (
              <Link key={r} role="tab" aria-selected={r === role} href={href({ rol: r, q })} className={tab(r === role)}>
                {t(`users.roles.${r}`)}
              </Link>
            ))}
          </div>
          <form action="/admin/foydalanuvchilar" method="get" className="flex gap-2">
            <input type="hidden" name="rol" value={role} />
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label={t("search")}
              placeholder={t("users.searchPlaceholder")}
              className="box-border h-11 min-w-0 flex-1 rounded-12 border-hair border-line bg-white px-3.5 font-sans text-14 text-ink outline-none focus:border-ink"
            />
            <button type="submit" className="tp-btn tp-stamp [--tp-shadow:var(--color-orange)] h-11 rounded-12 border-0 bg-ink px-4 font-sans text-14 font-bold text-white">
              {t("search")}
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-14">
              <thead>
                <tr>
                  <th className={th}>{t("users.columns.name")}</th>
                  <th className={th}>{t("users.columns.phone")}</th>
                  <th className={th}>{t("users.columns.extra")}</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={cn(td, "py-6 text-muted")}>
                      {t("empty")}
                    </td>
                  </tr>
                ) : null}
                {list.rows.map((u) => {
                  const extra = u.student?.university.shortName ?? u.ownedBusinesses[0]?.name ?? u.memberships[0]?.business.name ?? "";
                  return (
                    <tr key={u.id} className={cn(u.id === id && "bg-paper")}>
                      <td className={td}>
                        <Link href={href({ rol: role, q, sahifa: page, id: u.id })} className="tp-link font-bold text-ink no-underline">
                          {nameOf(u)}
                        </Link>
                        {u.status === "BLOCKED" ? <div className="text-12 font-bold text-danger">{t("users.status.BLOCKED")}</div> : null}
                      </td>
                      <td className={cn(td, "font-mono text-13 whitespace-nowrap")}>{formatPhone(u.phone)}</td>
                      <td className={cn(td, "text-13 text-muted")}>{extra}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-13 text-muted">
            <span>{t("page", { page, total: list.total })}</span>
            <span className="flex gap-3">
              {page > 1 ? <Link href={href({ rol: role, q, sahifa: page - 1 })} className="tp-link font-bold text-ink">{t("prev")}</Link> : null}
              {page < pages ? <Link href={href({ rol: role, q, sahifa: page + 1 })} className="tp-link font-bold text-ink">{t("next")}</Link> : null}
            </span>
          </div>
        </section>

        <section className="flex min-w-0 flex-[2_1_480px] flex-col gap-4 rounded-16 bg-white p-5" aria-label={t("users.detailTitle")}>
          {detail && detail.role !== "ADMIN" ? (
            <>
              <div>
                <h2 className="m-0 text-22 font-black tracking-[-0.02em]">{nameOf(detail)}</h2>
                <div className="mt-0.5 text-13 text-muted">
                  {t(`users.roles.${detail.role as "STUDENT"}`)} · {t(`users.status.${detail.status}`)} · {day(detail.createdAt)}
                  {detail.student ? <> · <span className="font-mono">{detail.student.publicId}</span></> : null}
                </div>
                {detail.status === "BLOCKED" && detail.blockedReason ? <div className="mt-1 text-13 font-bold text-danger">{t("users.blockedReason", { reason: detail.blockedReason })}</div> : null}
                {detail.universityRequests[0] ? <div className="mt-1 text-13 font-bold text-warn">{t("users.pendingRequest", { name: detail.universityRequests[0].name })}</div> : null}
              </div>
              <UserEditForm
                key={detail.id}
                userId={detail.id}
                person={{ firstName: detail.firstName ?? "", lastName: detail.lastName ?? "", phone: detail.phone }}
                student={
                  detail.student
                    ? {
                        course: detail.student.course,
                        faculty: detail.student.faculty ?? "",
                        universityId: detail.student.universityId,
                        districtId: detail.student.districtId ?? "",
                        cardNumber: detail.student.cardNumber ?? "",
                        cardExpiresAt: detail.student.cardExpiresAt?.toISOString().slice(0, 10) ?? "",
                        publicId: detail.student.publicId,
                      }
                    : null
                }
                universities={
                  // Talabaning hozirgi universiteti (yashirin bo'lsa ham) ro'yxatda turadi
                  refs.universities.some((u) => u.id === detail.student?.universityId) || !detail.student
                    ? refs.universities
                    : [{ id: detail.student.universityId, name: detail.student.university.name, active: false }, ...refs.universities]
                }
                districts={refs.districts}
              />
              {business ? (
                <>
                  <h3 className="m-0 mt-2 text-16 font-extrabold">{t("users.businessTitle")}</h3>
                  <BusinessAdminForm
                    key={business.id}
                    kindLabels={kindLabels}
                    business={{
                      id: business.id,
                      name: business.name,
                      legalName: business.legalName ?? "",
                      tin: business.tin ?? "",
                      kind: business.kind,
                      typeLabel: business.typeLabel ?? "",
                      address: business.address,
                      landmark: business.landmark ?? "",
                      workingHours: business.workingHours,
                      description: business.description ?? "",
                      contactName: business.contactName ?? "",
                      contactPhone: business.contactPhone ?? "",
                      publicPhone: business.publicPhone ?? "",
                      telegram: business.telegram ?? "",
                      instagram: business.instagram ?? "",
                    }}
                  />
                </>
              ) : null}
              <div>
                <h3 className="m-0 mb-2 text-14 font-extrabold">{t("users.history")}</h3>
                {detail.logs.length === 0 ? (
                  <p className="m-0 text-13 text-muted">{t("users.noHistory")}</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {detail.logs.map((l) => (
                      <li key={l.id} className="flex flex-wrap gap-x-2 text-12 text-muted">
                        <span className="font-mono">{day(l.createdAt)}</span>
                        <b className="text-ink">{l.action}</b>
                        <span>{[l.actor?.firstName, l.actor?.lastName].filter(Boolean).join(" ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 mb-0 text-12 text-muted">{t("auditNote")}</p>
              </div>
            </>
          ) : (
            <p className="m-0 text-14 text-muted">{t("users.pickHint")}</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

export default function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/foydalanuvchilar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}
