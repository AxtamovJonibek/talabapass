import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { AddPartnerForm, LandingSettingsForm, PartnerRow } from "@/components/admin/super/landing";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { Link } from "@/i18n/navigation";
import { landingAdminData } from "@/server/admin/landing-admin";
import { requireRole } from "@/server/auth/session";

const card = "flex min-w-0 flex-col gap-3 rounded-16 bg-white p-5";
const th = "border-0 border-b-[1.5px] border-solid border-ink p-2 text-left text-12 font-semibold text-muted";

// Landing boshqaruvi (super admin): raqamlar, "Hozir Toshkentda ochiq", hamkorlar
async function LandingContent() {
  const admin = await requireRole("ADMIN");
  const [t, data] = await Promise.all([getTranslations("adminSuper.landing"), landingAdminData()]);
  const { settings } = data;
  return (
    <AdminShell user={admin} active="landing">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-13 text-muted">{t("sub")}</div>
          <h1 className="mt-1 mb-0 text-36 leading-none font-black tracking-[-0.035em] font-stretch-112%">{t("title")}</h1>
        </div>
        <Link href="/" className="tp-link text-14 font-bold text-ink">
          {t("open")}
        </Link>
      </header>
      <section className={card}>
        <LandingSettingsForm
          initial={{
            statsMode: settings.statsMode,
            statsStudents: settings.statsStudents,
            statsBusinesses: settings.statsBusinesses,
            statsDiscounts: settings.statsDiscounts,
            statsSaved: settings.statsSaved,
            dealsMode: settings.dealsMode,
            dealIds: settings.dealIds,
          }}
          deals={data.deals}
        />
      </section>
      <section className={card} aria-label={t("partners.title")}>
        <h2 className="m-0 text-18 font-extrabold">{t("partners.title")}</h2>
        <p className="m-0 text-13 text-muted">{t("partners.hint")}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className={th}>{t("partners.name")}</th>
                <th className={th}>{t("partners.sort")}</th>
                <th className={th}>{t("partners.hidden")}</th>
                <th className={th}>{t("partners.logo")}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {data.partners.map((p) => (
                <PartnerRow key={p.businessId ?? p.partnerId ?? p.name} partner={p} />
              ))}
            </tbody>
          </table>
        </div>
        <AddPartnerForm />
      </section>
    </AdminShell>
  );
}

export default function AdminLandingPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LandingContent />
    </Suspense>
  );
}
