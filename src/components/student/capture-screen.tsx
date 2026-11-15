"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { CARD_ACCEPT, useCardCapture } from "./use-card-capture";

type Props = {
  /** "Orqaga" qayerga olib boradi */
  backHref: string;
  /** Guvohnoma muddati o'tgani sabab qayta yuklash so'ralyapti */
  expired?: boolean;
  /**
   * Kompyuterdagi sahifadan QR orqali o'tilgan (sessiyasiz): yuklash shu token nomidan bajariladi,
   * tugagach tekshiruv sahifasiga o'tilmaydi — "kompyuterga qayting" ko'rsatiladi.
   */
  uploadToken?: string;
};

const roundButton = "tp-lift flex size-11 items-center justify-center rounded-22 border-0 bg-ink-2 text-paper";
const corner = "absolute box-content size-[30px] border-orange";

/**
 * T2 — guvohnomani suratga olish yoki fayl yuklash.
 * Mantiq — `useCardCapture` (ilova Guvohnoma ekrani bilan bitta).
 */
export function CaptureScreen({ backHref, expired = false, uploadToken }: Props) {
  const t = useTranslations("onboarding.capture");
  const step = useTranslations("onboarding");
  const handoff = useTranslations("onboarding.handoff");
  const { rootRef, videoRef, cameraInput, fileInput, live, torch, busy, problem, sent, cameraIssue, shoot, toggleTorch, onPick } = useCardCapture(uploadToken);

  if (sent) {
    return (
      <div data-edge="ink-0" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-0 px-6 text-center text-paper">
        <div className="flex size-14 items-center justify-center rounded-full bg-mint-2 text-ink">
          <Icon name="check" size={28} strokeWidth={3} />
        </div>
        <h1 className="m-0 text-28 leading-[1.05] font-extrabold tracking-[-0.03em] font-stretch-110%">{handoff("doneTitle")}</h1>
        <p className="m-0 text-14 leading-[1.45] text-fog-3">{handoff("doneLead")}</p>
      </div>
    );
  }

  return (
    <div ref={rootRef} data-edge="ink-0" className="flex min-h-dvh flex-col bg-ink-0 text-paper">
      <div className="flex items-center justify-between px-4 pt-14">
        <Link href={backHref} aria-label={t("back")} className={roundButton}>
          <Icon name="chevronLeft" size={20} />
        </Link>
        <div className="font-mono text-12 text-fog-3">{step("step", { n: 2 })}</div>
        <button type="button" aria-label={t("torch")} aria-pressed={torch} onClick={toggleTorch} className={roundButton}>
          <Icon name="bolt" size={20} />
        </button>
      </div>

      <div className="px-6 pt-[22px]">
        <h1 className="m-0 text-28 leading-[1.05] font-extrabold tracking-[-0.03em] font-stretch-110%">
          {t.rich("title", { br: () => <br /> })}
        </h1>
        <p className="mt-2.5 mb-0 text-14 leading-[1.45] text-fog-3">{expired ? t("expiredNotice") : t("lead")}</p>
      </div>

      <div className="relative mx-6 mt-[26px] h-[222px] overflow-hidden rounded-18 bg-ink-1">
        {/* Kamera yoqilmaguncha — guvohnoma qanday joylashishini ko'rsatuvchi namuna */}
        <div className={cn("absolute inset-x-[22px] inset-y-[26px] box-border flex -rotate-[2.5deg] gap-3.5 rounded-12 bg-ink-3 p-4", live && "hidden")}>
          <div className="h-24 w-[74px] shrink-0 rounded-6 bg-ink-5" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-2 w-[70%] rounded-4 bg-ink-7" />
            <div className="h-3 w-[90%] rounded-4 bg-ink-8" />
            <div className="h-2 w-[55%] rounded-4 bg-ink-7" />
            <div className="h-2 w-[80%] rounded-4 bg-ink-7" />
            <div className="mt-auto h-2 w-[40%] rounded-4 bg-ink-7" />
          </div>
        </div>
        <video ref={videoRef} autoPlay playsInline muted className={cn("absolute inset-0 size-full object-cover", !live && "hidden")} />
        <div className={cn(corner, "top-3 left-3 rounded-tl-10 border-t-[3px] border-l-[3px]")} />
        <div className={cn(corner, "top-3 right-3 rounded-tr-10 border-t-[3px] border-r-[3px]")} />
        <div className={cn(corner, "bottom-3 left-3 rounded-bl-10 border-b-[3px] border-l-[3px]")} />
        <div className={cn(corner, "right-3 bottom-3 rounded-br-10 border-r-[3px] border-b-[3px]")} />
        <div
          role="status"
          className={cn(
            "absolute bottom-3.5 left-1/2 -translate-x-1/2 rounded-20 px-2.5 py-[5px] text-12 font-bold whitespace-nowrap",
            problem ? "bg-danger-bg text-danger" : "bg-orange text-ink",
          )}
        >
          {problem ? t(`errors.${problem}`) : busy ? t("uploading") : t("hint")}
        </div>
      </div>

      {cameraIssue ? (
        <p data-testid="camera-issue" role="status" className="mx-6 mt-3 mb-0 rounded-12 bg-ink-2 px-3.5 py-3 text-13 leading-[1.45] text-fog-1">
          {t(`camera.${cameraIssue}`)}
        </p>
      ) : null}

      <div className="mx-6 mt-[18px] flex flex-col gap-2.5">
        {(["tipLight", "tipValid"] as const).map((tip) => (
          <div key={tip} className="flex items-center gap-2.5 text-14 text-fog-1">
            <Icon name="check" size={18} strokeWidth={2.4} className="text-mint-2" />
            {t(tip)}
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between px-6 pb-10">
        <button
          type="button"
          disabled={busy} aria-busy={busy}
          onClick={() => fileInput.current?.click()}
          className="tp-lift flex h-14 w-[92px] flex-col items-center justify-center gap-1 rounded-14 border-0 bg-ink-2 font-sans text-12 font-semibold text-paper"
        >
          <Icon name="upload" size={20} />
          {t("file")}
        </button>
        <button
          type="button"
          aria-label={t("shoot")}
          disabled={busy} aria-busy={busy}
          onClick={shoot}
          className="tp-lift box-border flex size-[78px] items-center justify-center rounded-full border-4 border-solid border-paper bg-transparent p-0 disabled:opacity-50"
        >
          <span className="block size-[60px] rounded-full bg-paper" />
        </button>
        <div className="w-[92px] text-right font-mono text-11 leading-[1.4] text-fog-4">{t.rich("formats", { br: () => <br /> })}</div>
      </div>

      <input ref={fileInput} type="file" accept={CARD_ACCEPT} hidden onChange={onPick} data-testid="card-file" />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
    </div>
  );
}
