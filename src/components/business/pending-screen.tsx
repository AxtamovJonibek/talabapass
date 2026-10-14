import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { PhoneOrWeb } from "@/components/student/responsive";
import { cn } from "@/lib/cn";
import { BusinessHeading, BusinessOnboardingShell } from "./onboarding-shell";

const NEW_DISCOUNT = "/biznes/chegirma/yangi";
const CABINET = "/biznes/profil";

/** "TEKSHIRUVDA" muhri (WB1 3-qadam) */
function Stamp({ small = false, className }: { small?: boolean; className?: string }) {
  const t = useTranslations("businessOnboarding.pending");
  return (
    <div
      data-testid="business-stamp"
      className={cn(
        "shrink-0 -rotate-9 rounded-8 border-3 border-solid border-orange bg-paper px-3 py-1 font-black tracking-[0.06em] text-orange-ink font-stretch-75%",
        small ? "text-20" : "text-26",
        className,
      )}
    >
      {t("stamp")}
    </div>
  );
}

/** "Birinchi chegirmani tayyorlang" kartasi */
function DiscountCta({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("businessOnboarding.pending");
  return (
    <div className={cn("flex flex-wrap items-center gap-3.5 rounded-18 bg-white", compact ? "p-4" : "p-[18px]")}>
      <span className="-rotate-5 rounded-8 bg-orange px-2.5 pt-1.5 pb-1 text-30 font-black font-stretch-65%">{t("badge")}</span>
      <span className="flex flex-[1_1_240px] flex-col gap-0.5">
        <b className="text-17">{t("ctaTitle")}</b>
        <span className="text-14 text-muted">{t("ctaLead")}</span>
      </span>
      <ButtonLink href={NEW_DISCOUNT} variant="orange" size="card" block={compact}>
        {t("cta")}
      </ButtonLink>
    </div>
  );
}

/**
 * WB1 (3-qadam) — ariza tekshiruvda. Dizayndagi muhr sarlavha ustiga mutlaq joylashgan va tor kengliklarda
 * tavsif matnini yopardi (WT1 dagi kabi) — shuning uchun u sarlavha qatoriga, o'ng tomonga qo'yilgan.
 */
function PendingWeb() {
  const t = useTranslations("businessOnboarding");
  return (
    <BusinessOnboardingShell
      step={3}
      footer={
        <>
          <Button variant="outline-idle" size="tall-quiet" aria-disabled>
            {t("back")}
          </Button>
          <ButtonLink href={CABINET} variant="ink" size="tall-link" strong>
            {t("pending.cabinet")}
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <BusinessHeading>{t("pending.title")}</BusinessHeading>
          <Stamp className="mt-1" />
        </div>
        <p className="m-0 max-w-[560px] text-16 leading-[1.5] text-muted">{t("pending.lead")}</p>
        <DiscountCta />
      </div>
    </BusinessOnboardingShell>
  );
}

/** Telefon ko'rinishi (dizaynda chizilmagan — B1 sarlavhasi va WB1 3-qadam bloklaridan). */
function PendingPhone() {
  const t = useTranslations("businessOnboarding");
  const brand = useTranslations("brand");
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="flex items-center justify-between px-5 pt-14">
        <Logo size={17} chip="ink" tag={brand("business")} tagSize="md" />
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 pt-[18px]">
        <div className="flex items-start justify-between gap-3">
          <h1 className="m-0 text-28 leading-[1.02] font-black tracking-[-0.03em] font-stretch-110%">{t("pending.title")}</h1>
          <Stamp small className="mt-1" />
        </div>
        <p className="m-0 text-15 leading-[1.5] text-muted">{t("pending.lead")}</p>
        <DiscountCta compact />
      </div>
      <div className="border-t border-solid border-line-soft px-5 pt-3 pb-8">
        <ButtonLink href={CABINET} variant="ink" block>
          {t("pending.cabinet")}
        </ButtonLink>
      </div>
    </div>
  );
}

export function BusinessPendingScreen() {
  return <PhoneOrWeb phone={<PendingPhone />} web={<PendingWeb />} />;
}
