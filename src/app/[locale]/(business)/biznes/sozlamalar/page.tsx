import { PermissionNotice } from "@/components/business/permission-notice";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageSkeleton } from "@/components/state/page-skeleton";
import { BusinessShell } from "@/components/business/business-shell";
import { PreorderSettingsForm } from "@/components/business/preorder/preorder-settings";
import { BackLink } from "@/components/ui/back-button";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";
import { requireRole } from "@/server/auth/session";
import { ownerPreorder } from "@/server/preorder/settings";

// Biznes → Sozlamalar → "Oldindan band qilish" (dizaynda chizilmagan, mavjud primitivlardan)
async function Settings() {
  const user = await requireRole("BUSINESS_OWNER");
  const data = await ownerPreorder(user.id);
  if (!data) return redirect({ href: "/biznes", locale: await getLocale() });
  const t = await getTranslations("preorder");
  const header = (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 text-30 leading-none font-black tracking-[-0.03em] font-stretch-110%">{t("title")}</h1>
      <h2 className="m-0 mt-2 text-18 font-extrabold font-stretch-110%">{t("section")}</h2>
    </div>
  );
  // Forma bir marta chiziladi (BusinessShell phoneTab): telefonda pastki navigatsiya, kompyuterda yon panel
  return (
    <BusinessShell active="settings" phoneTab="orders">
      <BackLink href="/biznes/buyurtmalar" variant="text" className="-mb-2 @min-[700px]:hidden" />
      {header}
      <PermissionNotice ownerId={user.id} only={["canPreorder"]} />
      <PreorderSettingsForm data={data} />
    </BusinessShell>
  );
}

export default async function BusinessSettingsPage({ params }: PageProps<"/[locale]/biznes/sozlamalar">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}
