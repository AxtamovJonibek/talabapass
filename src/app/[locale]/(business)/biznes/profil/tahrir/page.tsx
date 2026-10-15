import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { BusinessEditForm } from "@/components/business/business-edit-form";
import { OwnerFrame } from "@/components/business/owner-pages";
import { Link } from "@/i18n/navigation";
import { businessLogoUrl } from "@/lib/profile-image";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { editableInfo } from "@/server/business/profile-edit";

async function EditContent() {
  const user = await requireRole("BUSINESS_OWNER");
  const info = await editableInfo(user.id);
  if (!info) return redirect({ href: "/biznes", locale: await getLocale() });
  const t = await getTranslations("businessProfile");
  const initial = { name: info.name, address: info.address, workingHours: info.workingHours, description: info.description ?? "" };
  const logoUrl = businessLogoUrl(info.id, info.logoKey);
  const head = (
    <>
      <Link href="/biznes/profil" className="flex h-11 items-center text-14 font-bold text-rust no-underline">
        ← {t("title")}
      </Link>
      <h1 className="m-0 mb-4 text-28 font-black tracking-[-0.03em] font-stretch-110%">{t("editTitle")}</h1>
    </>
  );
  return (
    <OwnerFrame
      tab="profile"
      section="profile"
      phone={
        <div className="px-5 pt-[50px] pb-5">
          {head}
          <BusinessEditForm initial={initial} logoUrl={logoUrl} idPrefix="bp" />
        </div>
      }
      web={
        <section className="max-w-[560px] rounded-22 bg-white p-5">
          {head}
          <BusinessEditForm initial={initial} logoUrl={logoUrl} idPrefix="bw" />
        </section>
      }
    />
  );
}

// B5 — biznes ma'lumotlarini tahrirlash
export default async function BusinessEditPage({ params }: PageProps<"/[locale]/biznes/profil/tahrir">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditContent />
    </Suspense>
  );
}
