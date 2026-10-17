"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { myCardStateAction } from "@/server/actions/student-card";
import { OnboardingHeading, OnboardingShell } from "./onboarding-shell";

type Problem = "empty" | "bad_type" | "too_large" | "not_allowed" | "daily_limit" | "network";
type Upload = { name: string; progress: number; done: boolean };
const MAX_BYTES = 10 * 1024 * 1024;
const POLL_MS = 3000;

type Props = {
  /** Telefonga o'tish havolasining QR matritsasi (true — qora katak) */
  qr: boolean[][];
  /** Avval yuklangan, tekshiruvni kutayotgan fayl nomi (bo'lsa) */
  pendingFileName: string | null;
  backHref: string | null;
};

/** WT1 (2-qadam) — guvohnomani kompyuterdan yuklash yoki telefon bilan suratga olish. */
export function CardUploadDesktop({ qr, pendingFileName, backHref }: Props) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [upload, setUpload] = useState<Upload | null>(pendingFileName ? { name: pendingFileName, progress: 100, done: true } : null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploading = Boolean(upload && !upload.done);

  // Telefondan yuborilgan rasm kelganini kuzatish — faqat shu ko'rinish ekranda bo'lsa.
  useEffect(() => {
    if (upload) return;
    const timer = setInterval(async () => {
      if (!root.current?.offsetParent) return;
      const state = await myCardStateAction();
      if (state.status === "pending") setUpload({ name: state.fileName, progress: 100, done: true });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [upload]);

  function send(file: File) {
    if (file.size > MAX_BYTES) return setProblem("too_large");
    setProblem(null);
    setUpload({ name: file.name, progress: 0, done: false });
    // fetch yuklash jarayonini bildirmaydi — progress uchun XMLHttpRequest.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/talaba/guvohnoma");
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setUpload({ name: file.name, progress: Math.round((e.loaded / e.total) * 100), done: false });
    };
    const fail = (reason: Problem) => {
      setUpload(null);
      setProblem(reason);
    };
    xhr.onerror = () => fail("network");
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText) as { ok: boolean; problem?: Problem };
        if (result.ok) return setUpload({ name: file.name, progress: 100, done: true });
        fail(result.problem ?? "network");
      } catch {
        fail("network");
      }
    };
    xhr.send(file);
  }

  return (
    <div ref={root}>
      <OnboardingShell
        step={2}
        footer={
          <>
            {backHref ? (
              <ButtonLink href={backHref} variant="outline-soft" size="wide-quiet">
                {t("web.back")}
              </ButtonLink>
            ) : (
              <Button variant="outline-idle" size="wide-quiet" aria-disabled>
                {t("web.back")}
              </Button>
            )}
            <Button
              variant="blue"
              size="wide"
              strong
              disabled={uploading} aria-busy={uploading}
              className="gap-2.5"
              onClick={() => {
                if (!upload?.done) return input.current?.click();
                router.push("/talaba/tekshiruv");
              }}
            >
              {t("web.submit")}
              <Icon name="arrowRight" size={18} strokeWidth={2.2} />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <OnboardingHeading>{t("web.cardTitle")}</OnboardingHeading>
          <div className="flex flex-wrap gap-3.5">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file && !uploading) send(file);
              }}
              className={cn(
                "relative box-border flex min-h-[240px] flex-[2_1_320px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-18 border-2 border-dashed p-6 text-center",
                dragging ? "border-blue bg-white" : "border-placeholder bg-paper-2",
              )}
            >
              <Icon name="upload" size={40} strokeWidth={1.8} className="text-blue" />
              <b className="text-18">{t("web.drop")}</b>
              <span className="text-14 text-muted">
                {t.rich("web.dropHint", { pick: (chunks) => <span className="font-bold text-blue underline">{chunks}</span> })}
              </span>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif,application/pdf"
                disabled={uploading} aria-busy={uploading}
                data-testid="card-file-web"
                className="absolute size-px opacity-0"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) send(file);
                }}
              />
            </label>
            <div className="box-content flex flex-[1_1_200px] flex-col items-start gap-3 rounded-18 bg-ink p-5 text-paper">
              <b className="text-16">{t("web.phoneTitle")}</b>
              <span className="text-13 leading-[1.45] text-fog-2">{t("web.phoneHint")}</span>
              <div
                role="img"
                aria-label={t("web.qrLabel")}
                className="grid rounded-10 bg-white p-2"
                style={{ gridTemplateColumns: `repeat(${qr.length}, 3px)`, gridAutoRows: "3px" }}
              >
                {qr.flatMap((row, y) => row.map((on, x) => <div key={`${y}-${x}`} className={on ? "bg-ink" : "bg-white"} />))}
              </div>
            </div>
          </div>

          {problem ? (
            <p role="alert" className="m-0 text-14 font-semibold text-danger">
              {t(`capture.errors.${problem}`)}
            </p>
          ) : null}

          {upload ? (
            <div data-testid="upload-row" className="flex items-center gap-3 rounded-14 bg-paper px-3.5 py-3">
              <div className="h-14 w-11 shrink-0 rounded-6 bg-tile-xizmat" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <b className="truncate text-14">{upload.name}</b>
                <div className="h-[5px] overflow-hidden rounded-3 bg-line-soft">
                  <div className="h-[5px] bg-green-live" style={{ width: `${upload.progress}%` }} />
                </div>
              </div>
              <span className="text-13 font-bold text-green">{upload.done ? t("web.uploaded") : t("web.uploading")}</span>
            </div>
          ) : null}
        </div>
      </OnboardingShell>
    </div>
  );
}
