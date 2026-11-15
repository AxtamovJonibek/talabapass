"use client";

import { useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppLead, AppScreen, AppTitle, FooterLink, Highlight, TickDot } from "@/components/ui/app-kit";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icons";
import { CARD_ACCEPT, useCardCapture } from "@/components/student/use-card-capture";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { RegisterTitle, RegisterTop } from "./register-parts";

const corner = "absolute size-[30px] border-green-bright";

/** Fayl / Chiroq: oq doira (52px) + yozuv */
function RoundAction({ icon, label, onClick, disabled, pressed }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="tp-lift flex min-h-11 min-w-16 flex-col items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-13 font-bold text-ink disabled:opacity-50"
    >
      <span className={cn("flex size-[52px] items-center justify-center rounded-full border-2 border-solid border-ink", pressed ? "bg-ink text-white" : "bg-white")}>
        <Icon name={icon} size={24} strokeWidth={2.2} />
      </span>
      {label}
    </button>
  );
}

/** 9 · Talaba 2/3: guvohnomani ramkaga joylash (design/app-flow Guvohnoma). Mantiq saytdagi T2 bilan bitta (`useCardCapture`). */
/** `backHref` null — orqaga yo'l yo'q (hisob ochilgan, 1-qadamga qaytilmaydi). */
export function AppCardCapture({ backHref, expired = false }: { backHref: string | null; expired?: boolean }) {
  const t = useTranslations("app.register.student");
  const capture = useTranslations("onboarding.capture");
  const { rootRef, videoRef, cameraInput, fileInput, live, torch, busy, problem, cameraIssue, shoot, toggleTorch, onPick } = useCardCapture();

  return (
    <AppScreen>
      {/* Ko'rinib turgan ildiz: kamera faqat shunda so'raladi (useCardCapture) */}
      <div ref={rootRef} className="flex flex-1 flex-col">
        <RegisterTop role="student" step={2} back={backHref ? { href: backHref } : null} />
        <RegisterTitle eyebrow={t("eyebrow2")} size={38}>
          {t.rich("title2", { hl: (chunks: ReactNode) => <Highlight tone="orange">{chunks}</Highlight> })}
        </RegisterTitle>
        <AppLead size={15} className="mt-3">
          {expired ? capture("expiredNotice") : t("lead2")}
        </AppLead>

        <div className="relative mt-5 flex h-[230px] items-center justify-center overflow-hidden rounded-28 bg-ink-2">
          <video ref={videoRef} autoPlay playsInline muted className={cn("absolute inset-0 size-full object-cover", !live && "hidden")} />
          <div className="relative flex h-[158px] w-[250px] items-center justify-center rounded-16 border-[3px] border-dashed border-white/55">
            {live ? null : <Icon name="idCard" size={64} strokeWidth={1.6} className="text-white/35" />}
          </div>
          <span className={cn(corner, "top-3.5 left-3.5 rounded-tl-10 border-t-4 border-l-4")} />
          <span className={cn(corner, "top-3.5 right-3.5 rounded-tr-10 border-t-4 border-r-4")} />
          <span className={cn(corner, "bottom-3.5 left-3.5 rounded-bl-10 border-b-4 border-l-4")} />
          <span className={cn(corner, "right-3.5 bottom-3.5 rounded-br-10 border-r-4 border-b-4")} />
          <span
            role="status"
            className={cn(
              "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-3 pt-1 pb-[5px] text-12 font-extrabold whitespace-nowrap",
              problem ? "bg-danger-bg text-danger" : "bg-white text-ink",
            )}
          >
            {problem ? capture(`errors.${problem}`) : busy ? capture("uploading") : t("frameHint")}
          </span>
        </div>

        {cameraIssue ? (
          <p data-testid="camera-issue" role="status" className="mt-3 mb-0 rounded-16 bg-white px-3.5 py-3 text-13 leading-[1.45] text-ink-5">
            {capture(`camera.${cameraIssue}`)}
          </p>
        ) : null}

        <ul className="m-0 mt-[18px] flex list-none flex-col gap-2.5 p-0">
          {(["tipLight", "tipValid"] as const).map((tip) => (
            <li key={tip} className="flex items-center gap-2.5 text-14 font-semibold">
              <TickDot size={22} tone="peach" />
              {t(tip)}
            </li>
          ))}
        </ul>

        <div className="flex-1" />
        <div className="mt-6 flex items-center justify-between px-1.5">
          <RoundAction icon="doc" label={t("file")} onClick={() => fileInput.current?.click()} disabled={busy} />
          <button
            type="button"
            aria-label={t("shoot")}
            disabled={busy}
            aria-busy={busy}
            onClick={shoot}
            className="tp-lift box-border flex size-[84px] items-center justify-center rounded-full border-[6px] border-solid border-blue-tint bg-blue p-0 disabled:opacity-50"
          >
            <span className="block size-[52px] rounded-full bg-white" />
          </button>
          <RoundAction icon="bolt" label={t("torch")} onClick={toggleTorch} disabled={!live} pressed={torch} />
        </div>
        <p className="mt-4 mb-0 text-center text-13 leading-[1.4] text-muted-2">{t("formats")}</p>

        <input ref={fileInput} type="file" accept={CARD_ACCEPT} hidden onChange={onPick} data-testid="card-file" />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      </div>
    </AppScreen>
  );
}

type Review = { sentAt: string; rejected?: { reason: string } };

/** Vaqt chizig'i qatori: belgi, chiziq (oxirgisida yo'q), sarlavha va izoh */
function TimelineRow({ marker, line, title, note, muted = false }: { marker: ReactNode; line?: "done" | "todo"; title: string; note?: string; muted?: boolean }) {
  return (
    <li className="flex gap-3.5">
      <div className="flex flex-col items-center">
        {marker}
        {line ? <span className={cn("min-h-[26px] w-[3px] flex-1", line === "done" ? "bg-green-bright" : "bg-line")} /> : null}
      </div>
      <div className="pb-[18px]">
        <div className={cn("text-17 font-extrabold", muted && "text-muted-2")}>{title}</div>
        {note ? <div className="mt-0.5 text-14 text-muted-2">{note}</div> : null}
      </div>
    </li>
  );
}

/** 10 · Talaba 3/3: tekshiruvda (va rad etilgan holati — dizaynda chizilmagan, shu ekran asosida). */
export function AppStudentReview({ sentAt, rejected }: Review) {
  const t = useTranslations("app.register.student");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AppScreen>
      <RegisterTop role="student" step={3} back={null} />
      <div className="mt-9">
        <span
          data-testid="status-stamp"
          className={cn(
            "inline-block -rotate-4 rounded-10 border-[3px] border-solid px-3 pt-1 pb-[5px] text-15 font-black tracking-[0.1em]",
            rejected ? "border-danger text-danger" : "border-orange text-orange",
          )}
        >
          {rejected ? t("stampRejected") : t("stamp")}
        </span>
        <AppTitle size={44} className="mt-5">
          {t.rich(rejected ? "rejectedTitle" : "title3", { br: () => <br /> })}
        </AppTitle>
        <AppLead size={16} className="mt-3.5">
          {rejected ? t("rejectedLead", { reason: rejected.reason }) : t("lead3")}
        </AppLead>
      </div>

      <ol className="m-0 mt-[30px] list-none rounded-24 bg-white px-5 pt-5 pb-1.5">
        <TimelineRow
          marker={<TickDot size={32} />}
          line="done"
          title={t("sent")}
          note={sentAt}
        />
        {rejected ? (
          <TimelineRow
            marker={
              <span className="flex size-8 items-center justify-center rounded-full bg-danger text-white">
                <Icon name="close" size={16} strokeWidth={3.2} />
              </span>
            }
            line="todo"
            title={t("rejected")}
            note={t("rejectedNote")}
          />
        ) : (
          <TimelineRow
            marker={
              <span className="flex size-8 items-center justify-center rounded-full bg-orange">
                <span className="size-2.5 rounded-full bg-ink" />
              </span>
            }
            line="todo"
            title={t("review")}
            note={t("reviewNote")}
          />
        )}
        <TimelineRow marker={<span className="box-border size-8 rounded-full border-2 border-solid border-line bg-track" />} title={t("open")} muted />
      </ol>

      <div className="flex-1" />
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => startTransition(() => router.refresh())}
        className={buttonClass({ variant: "blue", size: "app", strong: true, block: true }, "mt-6")}
      >
        {pending ? t("refreshing") : t("refresh")}
        <Icon name="refresh" size={22} strokeWidth={2.4} />
      </button>
      <div className="mt-1.5 flex justify-center">
        <FooterLink href="/talaba/guvohnoma" lead={rejected ? t("newPhoto") : t("otherPhoto")} />
      </div>
    </AppScreen>
  );
}
