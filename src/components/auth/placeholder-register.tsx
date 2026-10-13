import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { formatPhone } from "@/lib/format";
import { getVerifiedPhone, redirectIfSignedIn } from "@/server/auth/session";

/** Vaqtinchalik ro'yxat sahifasi: SMS bilan tasdiqlangan raqam shu yerga yetib kelishini ko'rsatadi. */
export async function PlaceholderRegister({ kind }: { kind: "student" | "business" }) {
  await redirectIfSignedIn();
  const t = await getTranslations();
  const phone = await getVerifiedPhone();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={20} tag={kind === "business" ? t("brand.business") : undefined} />
      <h1 className="m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%">
        {t(kind === "business" ? "placeholder.businessRegister" : "placeholder.studentRegister")}
      </h1>
      {phone ? (
        <p data-testid="verified-phone" className="m-0 font-mono text-15">
          {t("placeholder.verifiedPhone", { phone: formatPhone(phone) })}
        </p>
      ) : null}
      <p className="m-0 text-13 text-muted">{t("placeholder.comingSoon")}</p>
      <ButtonLink href="/kirish" variant="outline" size="sm">
        {t("common.login")}
      </ButtonLink>
    </main>
  );
}
