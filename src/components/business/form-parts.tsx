"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { BUSINESS_KINDS } from "@/lib/business";
import { cn } from "@/lib/cn";
import type { BusinessRegistration } from "./use-business-registration";

type Size = "phone" | "web";

/** Tanlangan rasmning vaqtinchalik ko'rinishi (brauzer xotirasidan). */
function usePreview(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}

/** B1/WB1 — logotip tanlash kvadrati (72 / 84 px). */
export function LogoPicker({ r, size }: { r: BusinessRegistration; size: Size }) {
  const t = useTranslations("businessOnboarding");
  const preview = usePreview(r.logo);
  return (
    <label
      aria-label={t("logoUpload")}
      className={cn(
        "relative box-border flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden border-hair border-dashed border-placeholder bg-white text-muted",
        size === "phone" ? "size-18 rounded-16 text-11" : "size-21 rounded-18 text-12",
      )}
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- brauzerdagi blob: manzil, optimallashtirish kerak emas
        <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <Icon name="plus" size={size === "phone" ? 20 : 22} />
          {t("logo")}
        </>
      )}
      <input type="file" accept="image/jpeg,image/png,image/heic" className="sr-only" onChange={(e) => r.pickFiles("logo", e.target.files)} />
    </label>
  );
}

/** Biznes turi chiplari. */
export function KindPicker({ r, size }: { r: BusinessRegistration; size: Size }) {
  const t = useTranslations("businessOnboarding");
  const kind = useTranslations("businessKind");
  const error = r.fieldError("kind");
  return (
    <fieldset className={cn("m-0 border-0 p-0", size === "phone" && "flex flex-col gap-1.5")}>
      <legend className={cn("p-0 text-13 font-semibold", size === "phone" ? "mb-1.5" : "mb-2")}>{t("kind")}</legend>
      <input type="hidden" name="kind" value={r.kind} />
      <div className="flex flex-wrap gap-1.5">
        {BUSINESS_KINDS.map((k) => (
          <Chip key={k} size={size === "phone" ? "form" : "lg"} selected={r.kind === k} onClick={() => r.pickKind(k)}>
            {kind(k)}
          </Chip>
        ))}
      </div>
      {error ? <p className="mt-1.5 mb-0 text-12 font-semibold text-danger">{error}</p> : null}
    </fieldset>
  );
}

type TileProps = { icon: "file" | "camera"; title: ReactNode; status: ReactNode; done: boolean; children?: ReactNode };

/** Hujjat kartasi: bo'sh — uzuq chegara, to'q sariq ikonka; tanlangan/yuklangan — oddiy chegara, yashil holat. */
function DocTile({ icon, title, status, done, children }: TileProps) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-16 border-hair bg-white p-3.5",
        done ? "border-line" : "border-dashed border-placeholder",
      )}
    >
      <Icon name={icon} size={28} strokeWidth={1.8} className={done ? "shrink-0 text-ink" : "shrink-0 text-rust"} />
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-14">{title}</b>
        <span className={cn("truncate text-12", done ? "font-bold text-green" : "text-muted")}>{status}</span>
      </span>
      {children}
    </label>
  );
}

/** Ro'yxatdan o'tganlik guvohnomasi va joy fotolari. */
export function DocTiles({ r }: { r: BusinessRegistration }) {
  const t = useTranslations("businessOnboarding");
  const savedRegistration = r.docs.find((d) => d.kind === "REGISTRATION");
  const photoCount = r.savedPhotos.length + r.photos.length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-2.5">
        <DocTile
          icon="file"
          title={t("registrationDoc")}
          done={Boolean(r.registration || savedRegistration)}
          status={
            r.registration
              ? t("selected", { name: r.registration.name })
              : savedRegistration
                ? t("uploaded", { name: savedRegistration.fileName })
                : t("registrationHint")
          }
        >
          <input
            type="file"
            name="registrationFile"
            accept="application/pdf,image/jpeg,image/png,image/heic"
            className="sr-only"
            onChange={(e) => r.pickFiles("registration", e.target.files)}
          />
        </DocTile>
        <DocTile icon="camera" title={t("photos")} done={photoCount > 0} status={photoCount > 0 ? t("photosCount", { count: photoCount }) : t("photosHint")}>
          <input
            type="file"
            name="photoFiles"
            multiple
            accept="image/jpeg,image/png,image/heic"
            className="sr-only"
            onChange={(e) => r.pickFiles("photo", e.target.files)}
          />
        </DocTile>
      </div>
      {r.savedPhotos.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {r.savedPhotos.map((d) => (
            <li key={d.id} className="flex h-9 items-center gap-1.5 rounded-10 border-hair border-line bg-white pr-1 pl-3 text-13">
              <span className="max-w-[180px] truncate">{d.fileName}</span>
              <button
                type="button"
                aria-label={t("remove")}
                disabled={r.pending || d.id.startsWith("local-")}
                onClick={() => r.removeDoc(d.id)}
                className="flex size-7 items-center justify-center rounded-8 border-0 bg-transparent text-muted"
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** "Biznes hamkorlik shartlari bilan tanishdim va roziman" */
export function Consent({ r }: { r: BusinessRegistration }) {
  const t = useTranslations("businessOnboarding");
  return (
    <label className="flex items-start gap-2.5 text-14 leading-[1.5] text-ink-5">
      <input
        type="checkbox"
        name="consent"
        checked={r.consent}
        onChange={(e) => r.setConsent(e.target.checked)}
        className="mt-px mb-0 ml-0 size-5 shrink-0 accent-ink"
      />
      <span>
        {t.rich("consent", {
          terms: (chunks) => (
            <Link href="/huquqiy/biznes" target="_blank" className="font-bold text-ink underline">
              {chunks}
            </Link>
          ),
        })}
      </span>
    </label>
  );
}

/** Forma ostidagi umumiy xato / yuklash jarayoni. */
export function FormStatus({ r }: { r: BusinessRegistration }) {
  const t = useTranslations("businessOnboarding");
  if (r.progress) return <p className="m-0 text-13 font-semibold text-muted">{t("uploading", { done: r.progress.done + 1, total: r.progress.total })}</p>;
  if (!r.failureText || r.codePhone) return null;
  const shownByField = r.failure?.kind === "save" && r.failure.error === "tinTaken";
  return shownByField ? null : (
    <p role="alert" className="m-0 text-13 font-semibold text-danger">
      {r.failureText}
    </p>
  );
}
