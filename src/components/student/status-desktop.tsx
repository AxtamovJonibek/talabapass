import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { OnboardingHeading, OnboardingShell } from "./onboarding-shell";

type Props = {
  /** "bugun, 14:02" */
  sentAt: string;
  queuePosition: number;
  rejected?: { reason: string };
};

function Fact({ label, tone = "plain", mono = false, children }: { label: string; tone?: "plain" | "warn" | "bad"; mono?: boolean; children: ReactNode }) {
  return (
    <div className={cn("rounded-14 p-3.5", tone === "warn" ? "bg-warn-bg" : tone === "bad" ? "bg-danger-bg" : "bg-paper")}>
      <div className={cn("text-12", tone === "warn" ? "text-warn" : tone === "bad" ? "text-danger" : "text-muted")}>{label}</div>
      <b className={cn("text-16", mono && "font-mono")}>{children}</b>
    </div>
  );
}

/** WT1 (3-qadam) — tekshiruv holati, veb ko'rinishi (rad etilgan varianti dizaynda yo'q, shu asosda). */
export function StatusDesktop({ sentAt, queuePosition, rejected }: Props) {
  const t = useTranslations("onboarding");

  return (
    <OnboardingShell
      step={3}
      footer={
        <>
          <ButtonLink href="/talaba/guvohnoma" variant="outline-soft" size="wide-quiet">
            {rejected ? t("web.reupload") : t("web.back")}
          </ButtonLink>
          <ButtonLink href="/talaba/tekshiruv" prefetch={false} variant="ink" size="wide" strong>
            {t("web.refresh")}
          </ButtonLink>
        </>
      }
    >
      <div className="flex flex-col gap-[18px]">
        {/* Dizaynda muhr absolute bo'lib, tavsif matnining ustiga tushardi. Endi sarlavha bilan bir qatorda va
            pastdan joy oladi: burilgan burchaklari ham matnga tegmaydi. */}
        <div className="flex items-start justify-between gap-4">
          <OnboardingHeading className="max-w-[70%]">{rejected ? t("web.rejectedTitle") : t("web.statusTitle")}</OnboardingHeading>
          <div
            data-testid="status-stamp-web"
            className={cn(
              "mt-1 mb-3 shrink-0 -rotate-10 rounded-8 border-[3px] border-solid px-3 py-1 text-26 font-black tracking-[0.06em] font-stretch-75%",
              rejected ? "border-danger text-danger" : "border-orange text-orange-ink",
            )}
          >
            {rejected ? t("status.stampRejected") : t("status.stampPending")}
          </div>
        </div>
        <p className="m-0 max-w-[520px] text-16 leading-[1.5] text-muted">{rejected ? t("status.leadRejected") : t("web.statusLead")}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2.5">
          <Fact label={t("web.sentLabel")} mono>
            {sentAt}
          </Fact>
          <Fact label={t("web.stateLabel")} tone={rejected ? "bad" : "warn"}>
            {rejected ? t("web.stateRejected") : t("web.statePending")}
          </Fact>
          {rejected ? (
            <Fact label={t("web.reasonLabel")}>{rejected.reason}</Fact>
          ) : (
            <Fact label={t("web.queueLabel")} mono>
              {t("web.queueValue", { n: queuePosition })}
            </Fact>
          )}
        </div>
        {rejected ? null : (
          <div className="border-t-hair-dashed pt-4 text-15">
            {t.rich("web.whileWaiting", {
              deals: (chunks) => (
                <Link href="/" className="font-bold text-blue underline">
                  {chunks}
                </Link>
              ),
            })}
          </div>
        )}
      </div>
    </OnboardingShell>
  );
}
