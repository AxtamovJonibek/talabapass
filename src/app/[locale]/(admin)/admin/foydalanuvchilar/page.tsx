import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { BusinessAdminForm, UserEditForm } from "@/components/admin/manage/forms";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { Link } from "@/i18n/navigation";
import { localizedPath } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { formatContact } from "@/lib/format";
import { BUSINESS_KINDS } from "@/lib/business";
import { CreateUserForm, UserActions } from "@/components/admin/super/controls";
import { AccountPanel, JournalList } from "@/components/admin/super/panels";
import { businessFull, listUsers, lookups, PAGE_SIZE, userDetail, type UserRole } from "@/server/admin/directory";
import { entityJournal, userAccount } from "@/server/admin/super";
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

  const [t, kinds, list, detail, refs, account, activity, sup] = await Promise.all([
    getTranslations("adminManage"),
    getTranslations("businessKind"),
    listUsers({ role, q, page }),
    id ? userDetail(id) : Promise.resolve(null),
    lookups(),
    id ? userAccount(id) : Promise.resolve(null),
    id ? entityJournal("User", id) : Promise.resolve([]),
    getTranslations("adminSuper"),
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
          <form action={localizedPath("/admin/foydalanuvchilar")} method="get" className="flex gap-2">
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
          <details className="rounded-12 bg-paper px-3.5 py-2.5">
            <summary className="cursor-pointer text-14 font-bold">{sup("create.title")}</summary>
            <div className="pt-3">
              <CreateUserForm />
            </div>
          </details>
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
                      <td className={cn(td, "font-mono text-13 whitespace-nowrap")}>{formatContact(u)}</td>
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
              {account ? <AccountPanel userId={detail.id} account={account} /> : null}
              <section className="flex flex-col gap-2" aria-label={sup("actions.title")}>
                <h3 className="m-0 text-15 font-extrabold">{sup("actions.title")}</h3>
                <UserActions key={detail.id} userId={detail.id} blocked={detail.status === "BLOCKED"} role={detail.role} listHref={href({ rol: role, q })} />
              </section>
              <UserEditForm
                key={detail.id}
                userId={detail.id}
                person={{ firstName: detail.firstName ?? "", lastName: detail.lastName ?? "", phone: detail.phone ?? "" }}
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
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="m-0 text-16 font-extrabold">{t("users.businessTitle")}</h3>
                    <Link href={`/admin/hamkorlar?id=${business.id}`} className="tp-link text-13 font-bold text-ink">
                      {sup("partners.title")} →
                    </Link>
                  </div>
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
                      lat: business.lat?.toString() ?? "",
                      lng: business.lng?.toString() ?? "",
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
              <JournalList rows={activity} title={sup("journal.userTitle")} allHref={`/admin/jurnal?kim=&obyekt=User&id=${detail.id}`} />
              <p className="m-0 text-12 text-muted">{t("auditNote")}</p>
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
