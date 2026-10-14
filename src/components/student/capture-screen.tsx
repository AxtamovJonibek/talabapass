"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Problem = "empty" | "bad_type" | "too_large" | "not_allowed" | "daily_limit" | "network";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,application/pdf";

type Props = {
  /** "Orqaga" qayerga olib boradi */
  backHref: string;
  /** Guvohnoma muddati o'tgani sabab qayta yuklash so'ralyapti */
  expired?: boolean;
};

const roundButton = "flex size-11 items-center justify-center rounded-22 border-0 bg-ink-2 text-paper";
const corner = "absolute box-content size-[30px] border-orange";

/**
 * T2 — guvohnomani suratga olish yoki fayl yuklash.
 * Kamera ruxsati bo'lsa ramkada jonli tasvir chiqadi va tugma kadrni oladi; bo'lmasa tugma telefonning
 * o'z kamerasini (fayl tanlash orqali) ochadi.
 */
export function CaptureScreen({ backHref, expired = false }: Props) {
  const t = useTranslations("onboarding.capture");
  const step = useTranslations("onboarding");
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop());
        stream = s;
        trackRef.current = s.getVideoTracks()[0] ?? null;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setLive(true);
        }
      })
      .catch(() => {
        // Ruxsat berilmadi yoki kamera yo'q — fayl tanlash yo'li qoladi.
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function upload(file: Blob, name: string) {
    if (file.size > MAX_BYTES) return setProblem("too_large");
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/talaba/guvohnoma", {
        method: "POST",
        body: file,
        headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(name) },
      });
      const result = (await response.json()) as { ok: boolean; problem?: Problem };
      if (result.ok) {
        router.replace("/talaba/tekshiruv");
        router.refresh();
        return;
      }
      setProblem(result.problem ?? "network");
    } catch {
      setProblem("network");
    }
    setBusy(false);
  }

  function shoot() {
    const video = videoRef.current;
    if (!live || !video?.videoWidth) return cameraInput.current?.click();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob && upload(blob, "guvohnoma.jpg"), "image/jpeg", 0.9);
  }

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    try {
      // `torch` — standart turlarda yo'q, faqat ayrim telefon brauzerlarida ishlaydi.
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      // qurilma chiroqni qo'llab-quvvatlamaydi
    }
  }

  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void upload(file, file.name);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-ink-0 text-paper">
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
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="flex h-14 w-[92px] flex-col items-center justify-center gap-1 rounded-14 border-0 bg-ink-2 font-sans text-12 font-semibold text-paper"
        >
          <Icon name="upload" size={20} />
          {t("file")}
        </button>
        <button
          type="button"
          aria-label={t("shoot")}
          disabled={busy}
          onClick={shoot}
          className="box-border flex size-[78px] items-center justify-center rounded-full border-4 border-solid border-paper bg-transparent p-0 disabled:opacity-50"
        >
          <span className="block size-[60px] rounded-full bg-paper" />
        </button>
        <div className="w-[92px] text-right font-mono text-11 leading-[1.4] text-fog-4">{t.rich("formats", { br: () => <br /> })}</div>
      </div>

      <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={onPick} data-testid="card-file" />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
    </div>
  );
}
