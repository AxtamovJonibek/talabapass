import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { NewAdminForm, OwnNameForm } from "@/components/admin/manage/forms";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { formatPhone } from "@/lib/format";
import { adminList } from "@/server/admin/directory";
import { requireRole } from "@/server/auth/session";

// Admin profili: o'z ismi, adminlar ro'yxati, yangi admin qo'shish (dizaynda yo'q — mavjud primitivlardan)
async function ProfileContent() {
  const admin = await requireRole("ADMIN");
  const [t, admins] = await Promise.all([getTranslations("adminManage"), adminList()]);
  const card = "flex min-w-0 flex-col gap-3.5 rounded-16 bg-white p-5";
  return (
    <AdminShell user={admin} active="profile">
      <header>
        <div className="text-13 text-muted">{t("profile.sub")}</div>
        <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("profile.title")}</h1>
      </header>
      <section className={card} aria-labelledby="own-title">
        <h2 id="own-title" className="m-0 text-18 font-extrabold">{t("profile.ownTitle")}</h2>
        <OwnNameForm me={{ firstName: admin.firstName ?? "", lastName: admin.lastName ?? "" }} />
        <p className="m-0 text-12 text-muted">{t("auditNote")}</p>
      </section>
      <section className={card} aria-labelledby="admins-title">
        <h2 id="admins-title" className="m-0 text-18 font-extrabold">{t("profile.adminsTitle")}</h2>
        <ul className="m-0 flex list-none flex-col p-0">
          {admins.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-0 border-b border-solid border-surface py-2.5 last:border-b-0">
              <b className="text-14">{[a.firstName, a.lastName].filter(Boolean).join(" ") || "—"}</b>
              {a.id === admin.id ? <span className="rounded-8 bg-info-bg px-2 py-0.5 text-12 font-bold">{t("profile.you")}</span> : null}
              {a.status === "BLOCKED" ? <span className="rounded-8 bg-danger-bg px-2 py-0.5 text-12 font-bold text-danger">{t("profile.blocked")}</span> : null}
              <span className="ml-auto font-mono text-13 text-muted">{formatPhone(a.phone)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className={card} aria-labelledby="new-title">
        <h2 id="new-title" className="m-0 text-18 font-extrabold">{t("profile.newTitle")}</h2>
        <NewAdminForm />
      </section>
    </AdminShell>
  );
}

export default function AdminProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}
