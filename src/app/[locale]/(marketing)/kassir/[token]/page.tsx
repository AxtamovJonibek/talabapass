import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { AcceptInvite } from "@/components/cashier/accept-invite";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { resolveLocale } from "@/i18n/locale";
import { inviteByToken } from "@/server/business/cashiers";

async function Invite({ params }: { params: Promise<{ locale: string; token: string }> }) {
  // [token] — ish vaqtidagi qiymat: params faqat Suspense ichida o'qiladi
  await resolveLocale(params);
  await connection();
  const { token } = await params;
  const invite = await inviteByToken(token);
  if (invite) return <AcceptInvite token={token} businessName={invite.businessName} />;

  const t = await getTranslations("cashiers.accept");
  const brand = await getTranslations("brand");
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col gap-3 bg-paper px-5 pt-14 pb-8 text-ink">
      <Logo size={17} chip="ink" tag={brand("business")} tagSize="md" />
      <h1 className="mt-6 mb-0 text-28 font-black tracking-[-0.03em] font-stretch-110%">{t("invalidTitle")}</h1>
      <p data-testid="invite-invalid" className="m-0 text-14 leading-[1.45] text-muted">
        {t("invalidLead")}
      </p>
      <ButtonLink href="/" variant="outline-soft" className="mt-auto">
        {t("home")}
      </ButtonLink>
    </main>
  );
}

// Kassir taklifi havolasi: bir marta, 48 soat
export default function CashierInvitePage({ params }: PageProps<"/[locale]/kassir/[token]">) {
  return (
    <Suspense fallback={null}>
      <Invite params={params} />
    </Suspense>
  );
}
