"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PhotoOr } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { useRouter } from "@/i18n/navigation";
import { ImageCropper } from "./image-cropper";

type Kind = "student" | "business";
const ENDPOINT: Record<Kind, string> = { student: "/api/talaba/avatar", business: "/api/biznes/logo" };
const PROBLEMS = new Set(["bad_type", "too_large", "daily_limit", "not_allowed", "empty"]);

/**
 * Profil rasmi: hozirgi rasm (yo'q bo'lsa — zaxira), "Rasm tanlash" → kesish oynasi → yuklash, "O'chirish".
 * Talaba — avatar, biznes — logotip. Yuklangach sahifa yangilanadi (barcha joyda yangi rasm chiqadi).
 */
export function AvatarEditor({ kind, url, fallback, idPrefix }: { kind: Kind; url: string | null; fallback: ReactNode; idPrefix: string }) {
  const t = useTranslations("avatar");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (problem: string | undefined) => t(`errors.${problem && PROBLEMS.has(problem) ? (problem as "bad_type") : "network"}`);

  async function send(method: "POST" | "DELETE", body?: Blob) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(ENDPOINT[kind], { method, body, headers: body ? { "content-type": "image/jpeg" } : undefined });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { problem?: string } | null;
        setError(message(data?.problem));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(message(undefined));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const shape = kind === "student" ? "rounded-full" : "rounded-16";
  return (
    <div className="flex items-center gap-4">
      <div
        data-testid="avatar-preview"
        className={cn("flex size-20 shrink-0 items-center justify-center overflow-hidden bg-surface text-26 font-black text-ink font-stretch-110%", shape)}
      >
        <PhotoOr src={url}>{fallback}</PhotoOr>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <input
          ref={input}
          id={`${idPrefix}-photo`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t(`${kind}.choose`)}
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (picked) {
              setError(null);
              setFile(picked);
            }
          }}
        />
        <Button variant="outline-soft" size="sm" onClick={() => input.current?.click()}>
          {url ? t("change") : t(`${kind}.choose`)}
        </Button>
        {url ? (
          <Button variant="danger-ghost" size="sm" disabled={busy} aria-busy={busy} onClick={() => send("DELETE")} className="px-0">
            {t("remove")}
          </Button>
        ) : null}
        <p className="m-0 text-12 leading-[1.4] text-muted">{t(`${kind}.hint`)}</p>
        {error && !file ? (
          <p role="alert" className="m-0 text-12 font-bold text-danger">
            {error}
          </p>
        ) : null}
      </div>
      {file ? (
        <ImageCropper
          file={file}
          busy={busy}
          error={error}
          onCancel={() => {
            setFile(null);
            setError(null);
          }}
          onSave={async (blob) => {
            if (await send("POST", blob)) setFile(null);
          }}
        />
      ) : null}
    </div>
  );
}
