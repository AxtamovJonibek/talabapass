import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  /** "TATU · 2-kurs" */
  meta: string;
  /** "guvohnoma_old.jpg · 1.8 MB" */
  file: string;
  /** "bugun, 14:02" */
  sentAt: string;
  rejected?: { reason: string };
};

function Step({ marker, line, children }: { marker: ReactNode; line?: "solid" | "dashed"; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center">
        {marker}
        {line ? <div className={cn("min-h-[22px] w-0.5 flex-1", line === "solid" ? "bg-ink" : "timeline-dashed")} /> : null}
      </div>
      {children}
    </li>
  );
}

/** T3 — "tekshiruvda" holati (va rad etilgan varianti: dizaynda chizilmagan, shu ekran asosida). */
export function StatusScreen({ name, meta, file, sentAt, rejected }: Props) {
  const t = useTranslations("onboarding");

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div className="flex items-center justify-between px-6 pt-[60px]">
        <Logo size={18} />
        <div className="font-mono text-12 text-muted">{t("step", { n: 3 })}</div>
      </div>

      <div className="relative mx-6 mt-[30px] overflow-hidden rounded-20 border-hair border-ink bg-white p-[22px]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-[70px] w-[54px] shrink-0 items-center justify-center rounded-8 bg-surface-2 text-muted">
            <Icon name="idCard" size={26} strokeWidth={1.8} />
          </div>
          <div className="flex flex-col gap-[3px]">
            <div className="text-17 font-bold">{name}</div>
            <div className="text-13 text-muted">{meta}</div>
            <div className="font-mono text-12 text-muted">{file}</div>
          </div>
        </div>
        <div
          data-testid="status-stamp"
          className={cn(
            "absolute top-[18px] -right-1.5 -rotate-12 rounded-8 border-[3px] border-solid bg-white px-2.5 py-1 text-22 font-black tracking-[0.06em] font-stretch-75%",
            rejected ? "border-danger text-danger" : "border-orange text-orange-ink",
          )}
        >
          {rejected ? t("status.stampRejected") : t("status.stampPending")}
        </div>
      </div>

      <div className="px-6 pt-[30px]">
        <h1 className="m-0 text-30 leading-[1.02] font-extrabold tracking-[-0.03em] font-stretch-110%">
          {t.rich(rejected ? "status.titleRejected" : "status.titlePending", { br: () => <br /> })}
        </h1>
        <p className="mt-2.5 mb-0 text-15 leading-[1.45] text-muted">{rejected ? t("status.leadRejected") : t("status.leadPending")}</p>
      </div>

      <ol className="mx-6 mt-[26px] mb-0 flex list-none flex-col p-0">
        <Step
          line="solid"
          marker={
            <div className="flex size-[26px] items-center justify-center rounded-full bg-ink text-white">
              <Icon name="check" size={14} strokeWidth={3} />
            </div>
          }
        >
          <div className="flex flex-col gap-0.5 pt-[3px] pb-[18px]">
            <div className="text-15 font-bold">{t("status.sent")}</div>
            <div className="font-mono text-12 text-muted">{sentAt}</div>
          </div>
        </Step>
        <Step
          line="dashed"
          marker={
            <div className={cn("flex size-[26px] items-center justify-center rounded-full", rejected ? "bg-danger" : "bg-orange")}>
              <div className={cn("size-2 rounded-full", rejected ? "bg-white" : "bg-ink")} />
            </div>
          }
        >
          <div className="flex flex-col gap-0.5 pt-[3px] pb-[18px]">
            <div className="text-15 font-bold">{t("status.review")}</div>
            <div className={cn("text-13", rejected ? "font-semibold text-danger" : "text-muted")}>
              {rejected ? rejected.reason : t("status.reviewHint")}
            </div>
          </div>
        </Step>
        <Step marker={<div className="box-border size-[26px] shrink-0 rounded-full border-2 border-solid border-line-strong" />}>
          <div className="pt-[3px] text-15 font-semibold text-muted">{t("status.access")}</div>
        </Step>
      </ol>

      <div className="mt-auto flex flex-col gap-2.5 px-6 pb-[34px]">
        {rejected ? (
          <ButtonLink href="/talaba/guvohnoma" variant="ink">
            {t("status.reupload")}
          </ButtonLink>
        ) : (
          <>
            <ButtonLink href="/talaba/tekshiruv" variant="ink" prefetch={false}>
              {t("status.refresh")}
            </ButtonLink>
            <ButtonLink href="/talaba/guvohnoma" variant="ghost" size="sm" className="text-blue">
              {t("status.reupload")}
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
