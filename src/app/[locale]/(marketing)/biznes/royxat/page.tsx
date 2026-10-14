import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { GuestOnly } from "@/components/auth/role-gate";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { resolveLocale } from "@/i18n/locale";
import { formatPhone } from "@/lib/format";
import { getVerifiedPhone } from "@/server/auth/session";

async function VerifiedPhone() {
  const phone = await getVerifiedPhone();
  const t = await getTranslations("placeholder");
  return phone ? (
    <p data-testid="verified-phone" className="m-0 font-mono text-15">
      {t("verifiedPhone", { phone: formatPhone(phone) })}
    </p>
  ) : null;
}

// 6-bosqichda: B1 / WB1 — biznes ro'yxati. Hozircha vaqtinchalik sahifa.
export default async function BusinessRegisterPage({ params }: PageProps<"/[locale]/biznes/royxat">) {
  await resolveLocale(params);
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Suspense fallback={null}>
        <GuestOnly />
      </Suspense>
      <Logo size={20} tag={t("brand.business")} />
      <h1 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">{t("placeholder.businessRegister")}</h1>
      <Suspense fallback={null}>
        <VerifiedPhone />
      </Suspense>
      <p className="m-0 text-13 text-muted">{t("placeholder.comingSoon")}</p>
      <ButtonLink href="/kirish?rol=biznes" variant="outline" size="sm">
        {t("common.login")}
      </ButtonLink>
    </main>
  );
}
