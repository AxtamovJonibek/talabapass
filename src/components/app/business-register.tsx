"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CodeBoxes } from "@/components/ui/app-code";
import { AppLabel, AppLead, AppScreen, AppTitle, BoxInput, Choice, FieldBox, FieldNote, FooterLink, Highlight, TickDot } from "@/components/ui/app-kit";
import { buttonClass, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { RejectedNote } from "@/components/business/register-mobile";
import { useBusinessRegistration, type BusinessRegistration, type ExistingDoc } from "@/components/business/use-business-registration";
import { Link } from "@/i18n/navigation";
import { BUSINESS_KINDS, DESCRIPTION_MAX, PHOTOS_MAX, type BusinessInfo } from "@/lib/business";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { RegisterTitle, RegisterTop } from "./register-parts";

const OTP_LENGTH = 6;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/heic";

/**
 * Tanlangan rasmning vaqtinchalik ko'rinishi (brauzer xotirasidan). Manzil effektda yaratiladi va o'sha effektda bo'shatiladi —
 * effekt qayta ishlaganda (StrictMode) bo'shatilgan manzil qolib ketmaydi.
 */
function usePreview(file: File | null) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tashqi resurs (blob manzil) bilan sinxronlash
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview && preview.file === file ? preview.url : null;
}

type Props = {
  verifiedPhone: string | null;
  initial?: (BusinessInfo & { phone: string }) | null;
  docs?: ExistingDoc[];
  rejectReason?: string | null;
  signedIn?: boolean;
};

/**
 * Biznes arizasi ilovada (design/app-flow): B6 biznes haqida → B7 tafsilotlar → B8 hujjatlar → B9 tekshiruvda (`/biznes`).
 * Holat va server — saytdagi B1/WB1 bilan bitta (`useBusinessRegistration`, `saveBusinessAction`), maydonlar ham o'sha.
 */
export function AppBusinessRegister({ rejectReason, signedIn = false, ...props }: Props) {
  const r = useBusinessRegistration({ ...props, signedIn });
  const t = useTranslations("app.register.business");
  const auth = useTranslations("auth");
  const onboarding = useTranslations("businessOnboarding");
  const kinds = useTranslations("businessKind");
  const common = useTranslations("app");
  const cta = buttonClass({ variant: "orange", size: "app", strong: true, block: true }, "mt-6");
  // 1-qadamdan orqaga: kirmagan — kirish ekraniga; kirgan egasi uchun orqa yo'q (/biznes shu forma)
  const back = r.step > 1 || r.codePhone ? { onClick: r.back } : signedIn ? null : { href: "/kirish?rol=biznes" };

  if (r.codePhone) {
    return (
      <AppScreen>
        <RegisterTop role="business" step={3} back={back} />
        <form
          className="flex flex-1 flex-col"
          action={() => {
            if (r.code.length === OTP_LENGTH) r.submitCode(r.code, "app");
          }}
        >
          <p className="mt-8 mb-4 text-16 leading-[1.5] text-ink-5">{auth("codeSentTo", { phone: formatPhone(r.codePhone) })}</p>
          <CodeBoxes
            id="app-biz-code"
            label={auth("digit", { n: 1 })}
            value={r.code}
            onChange={(next) => {
              r.setCode(next);
              if (next.length === OTP_LENGTH && !r.pending) r.submitCode(next, "app");
            }}
            invalid={r.failure?.kind === "auth" && r.failure.error === "wrongCode"}
            disabled={r.pending}
            autoFocus
          />
          {r.failureText ? <FieldNote error>{r.failureText}</FieldNote> : null}
          <div className="flex-1" />
          <button type="submit" disabled={r.pending} aria-busy={r.pending} className={cta}>
            {r.pending ? auth("checking") : onboarding("confirm")}
            <Icon name="tick" size={22} strokeWidth={2.4} />
          </button>
        </form>
      </AppScreen>
    );
  }

  const arrow = <Icon name="arrowRight" size={22} strokeWidth={2.4} />;

  if (r.step === 1) {
    return (
      <AppScreen>
        <RegisterTop role="business" step={1} back={back} />
        <RegisterTitle eyebrow={t("eyebrow1")} size={40} className="mt-[26px]">
          {t.rich("title1", { hl: (chunks: ReactNode) => <Highlight tone="orange">{chunks}</Highlight> })}
        </RegisterTitle>
        <form className="flex flex-1 flex-col" action={(form) => r.next(form, "app")}>
          {rejectReason ? (
            <div className="mt-4">
              <RejectedNote reason={rejectReason} />
            </div>
          ) : null}
          <div className="mt-[22px] flex items-end gap-3">
            <div className="shrink-0">
              <AppLabel>{t("logo")}</AppLabel>
              <LogoBox r={r} />
            </div>
            <div className="min-w-0 flex-1">
              <AppLabel htmlFor="app-biz-name">{t("name")}</AppLabel>
              <FieldBox invalid={r.invalid.includes("name")}>
                <BoxInput id="app-biz-name" name="name" autoComplete="organization" defaultValue={r.values.name} />
              </FieldBox>
            </div>
          </div>
          {r.fieldError("name") ? <FieldNote error>{r.fieldError("name")}</FieldNote> : null}

          <fieldset className="m-0 mt-[18px] border-0 p-0">
            <legend className="mb-2 p-0 text-14 font-bold">{t("kind")}</legend>
            <input type="hidden" name="kind" value={r.kind} />
            <div className="flex flex-wrap gap-2">
              {BUSINESS_KINDS.map((k) => (
                <Choice key={k} shape="pill" selected={r.kind === k} onClick={() => r.pickKind(k)}>
                  {kinds(k)}
                </Choice>
              ))}
            </div>
            {r.fieldError("kind") ? <FieldNote error>{r.fieldError("kind")}</FieldNote> : null}
          </fieldset>

          <div className="mt-[18px]">
            <AppLabel htmlFor="app-biz-address">{t("address")}</AppLabel>
            <FieldBox invalid={r.invalid.includes("address")}>
              <Icon name="pin" size={22} strokeWidth={2.4} className="shrink-0 text-orange" />
              <BoxInput id="app-biz-address" name="address" text={17} autoComplete="street-address" defaultValue={r.values.address} />
            </FieldBox>
            {r.fieldError("address") ? <FieldNote error>{r.fieldError("address")}</FieldNote> : null}
          </div>

          <Status r={r} />
          <div className="flex-1" />
          <button type="submit" className={cta}>
            {common("next")}
            {arrow}
          </button>
        </form>
      </AppScreen>
    );
  }

  if (r.step === 2) {
    return (
      <AppScreen>
        <RegisterTop role="business" step={2} back={back} />
        <RegisterTitle eyebrow={t("eyebrow2")} size={40} className="mt-[26px]">
          {t.rich("title2", { hl: (chunks: ReactNode) => <Highlight tone="blue">{chunks}</Highlight> })}
        </RegisterTitle>
        <form className="flex flex-1 flex-col" action={(form) => r.next(form, "app")}>
          <div className="mt-6">
            <AppLabel htmlFor="app-biz-hours">{t("hours")}</AppLabel>
            <FieldBox invalid={r.invalid.includes("workingHours")}>
              <Icon name="time" size={22} strokeWidth={2.4} className="shrink-0 text-blue" />
              <BoxInput id="app-biz-hours" name="workingHours" placeholder={t("hoursPlaceholder")} defaultValue={r.values.workingHours} />
            </FieldBox>
            {r.fieldError("workingHours") ? <FieldNote error>{r.fieldError("workingHours")}</FieldNote> : null}
          </div>

          <div className="mt-[18px]">
            <AppLabel htmlFor="app-biz-tin">{t("tin")}</AppLabel>
            <FieldBox invalid={r.invalid.includes("tin")}>
              <BoxInput id="app-biz-tin" name="tin" inputMode="numeric" placeholder={t("tinPlaceholder")} className="tracking-[0.06em]" defaultValue={r.values.tin} />
            </FieldBox>
            {r.fieldError("tin") ? <FieldNote error>{r.fieldError("tin")}</FieldNote> : <p className="mx-0.5 mt-2 mb-0 text-13 leading-[1.4] text-muted-2">{t("tinNote")}</p>}
          </div>

          <div className="mt-[18px]">
            <div className="mb-2 flex items-baseline justify-between">
              <label htmlFor="app-biz-desc" className="text-14 font-bold">
                {t("description")}
              </label>
              <span className="text-13 font-semibold text-muted-2 tabular-nums">
                {r.descriptionLength}/{DESCRIPTION_MAX}
              </span>
            </div>
            <div className={cn("rounded-18 border-2 border-solid bg-white px-4 py-3 focus-within:border-blue focus-within:shadow-focus-blue", r.invalid.includes("description") ? "border-danger" : "border-ink")}>
              <textarea
                id="app-biz-desc"
                name="description"
                rows={3}
                maxLength={DESCRIPTION_MAX}
                defaultValue={r.values.description}
                onInput={(e) => r.setDescriptionLength(e.currentTarget.value.length)}
                className="block min-h-[79px] w-full resize-none border-0 bg-transparent p-0 font-sans text-17 leading-[1.4] font-semibold text-ink outline-none"
              />
            </div>
          </div>

          <Status r={r} />
          <div className="flex-1" />
          <button type="submit" className={cta}>
            {t("nextDocs")}
            {arrow}
          </button>
        </form>
      </AppScreen>
    );
  }

  const savedRegistration = r.docs.find((d) => d.kind === "REGISTRATION");
  const registrationName = r.registration?.name ?? savedRegistration?.fileName;
  const photoCount = r.savedPhotos.length + r.photos.length;
  const busy = r.pending ? (r.progress ? onboarding("uploading", { done: r.progress.done + 1, total: r.progress.total }) : onboarding("saving")) : null;

  return (
    <AppScreen className="pb-[max(16px,calc(32px-var(--safe-bottom)))]">
      <RegisterTop role="business" step={3} back={back} />
      <RegisterTitle eyebrow={t("eyebrow3")} size={36} className="mt-[22px]">
        {t.rich("title3", { hl: (chunks: ReactNode) => <Highlight tone="green" tight>{chunks}</Highlight> })}
      </RegisterTitle>
      <form className="flex flex-1 flex-col" action={(form) => r.submit(form, "app")}>
        <div className="mt-[18px]">
          <AppLabel htmlFor="app-biz-contact" className="mb-1.5">
            {t("contact")}
          </AppLabel>
          <FieldBox height={54} invalid={r.invalid.includes("contactName")}>
            <BoxInput id="app-biz-contact" name="contactName" text={18} autoComplete="name" defaultValue={r.values.contactName} />
          </FieldBox>
          {r.fieldError("contactName") ? <FieldNote error>{r.fieldError("contactName")}</FieldNote> : null}
        </div>

        <div className="mt-3">
          <AppLabel className="mb-1.5">{t("phone")}</AppLabel>
          <div className="box-border flex h-[54px] items-center gap-2.5 rounded-16 border-2 border-solid border-line bg-track px-4">
            <span className="flex-1 text-18 font-extrabold text-ink-5 tabular-nums">{formatPhone(r.values.phone)}</span>
            <span className="flex items-center gap-1.5 text-13 font-extrabold text-green-ok">
              <TickDot size={18} />
              {t("verified")}
            </span>
          </div>
          <input type="hidden" name="phone" value={r.values.phone} />
        </div>

        <div className="mt-3">
          <AppLabel className="mb-1.5">{t("registration")}</AppLabel>
          {registrationName ? (
            <div className="flex items-center gap-3 rounded-16 border-2 border-solid border-green-bright bg-white px-3.5 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-12 bg-green-bg">
                <Icon name="doc" size={22} strokeWidth={2.2} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-15 font-extrabold break-words">{t(r.registration ? "registrationSelected" : "registrationDone", { name: registrationName })}</span>
                <span className="text-12 text-muted-2">{t("registrationHint")}</span>
              </span>
              <button
                type="button"
                disabled={r.pending}
                onClick={() => (r.registration ? r.clearRegistration() : savedRegistration && r.removeDoc(savedRegistration.id))}
                className="tap shrink-0 border-0 bg-transparent p-0 font-sans text-13 font-bold text-muted underline"
              >
                {t("remove")}
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-3 rounded-16 border-2 border-dashed border-muted-2 bg-white px-3.5 py-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-12 bg-surface text-muted">
                <Icon name="plus" size={22} strokeWidth={2.4} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-15 font-extrabold">{t("registrationPick")}</span>
                <span className="text-12 text-muted-2">{t("registrationHint")}</span>
              </span>
              <input type="file" accept={`application/pdf,${IMAGE_ACCEPT}`} className="sr-only" onChange={(e) => r.pickFiles("registration", e.target.files)} />
            </label>
          )}
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-14 font-bold">{t("photos")}</span>
            <span className="text-12 font-semibold text-muted-2">{t("photosHint")}</span>
          </div>
          <div className="flex gap-2.5">
            {r.savedPhotos.map((d) => (
              <PhotoTile key={d.id} label={d.fileName} onRemove={d.id.startsWith("local-") || r.pending ? undefined : () => r.removeDoc(d.id)} />
            ))}
            {r.photos.map((file) => (
              <PhotoTile key={`${file.name}-${file.size}-${file.lastModified}`} file={file} label={file.name} onRemove={r.pending ? undefined : () => r.dropPhoto(file)} />
            ))}
            {photoCount < PHOTOS_MAX ? (
              <label aria-label={t("addPhoto")} className="box-border flex h-[74px] flex-1 cursor-pointer items-center justify-center rounded-16 border-2 border-dashed border-muted-2 bg-white text-muted">
                <Icon name="plus" size={26} strokeWidth={2.4} />
                <input type="file" multiple accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => r.pickFiles("photo", e.target.files, { append: true })} />
              </label>
            ) : null}
            {Array.from({ length: Math.max(0, PHOTOS_MAX - photoCount - 1) }, (_, i) => (
              <span key={i} aria-hidden="true" className="flex-1" />
            ))}
          </div>
        </div>

        <Status r={r} />
        <div className="flex-1" />

        <label className="mt-5 mb-3 flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" name="consent" checked={r.consent} onChange={(e) => r.setConsent(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden="true"
            className={cn(
              "flex size-[26px] shrink-0 items-center justify-center rounded-8 border-2 border-solid peer-focus-visible:shadow-focus-blue",
              r.consent ? "border-blue bg-blue text-white" : "border-ink bg-white",
            )}
          >
            {r.consent ? <Icon name="tick" size={16} strokeWidth={3.4} /> : null}
          </span>
          <span className="text-14 leading-[1.4] text-ink-5">
            {t.rich("consent", {
              terms: (chunks: ReactNode) => (
                <Link href="/huquqiy/biznes" className="font-bold text-blue underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        <button type="submit" disabled={r.pending} aria-busy={r.pending} className={buttonClass({ variant: "orange", size: "app", strong: true, block: true })}>
          {busy ?? t("submit")}
          {arrow}
        </button>
      </form>
    </AppScreen>
  );
}

/** Logotip: 58px uzuq chegarali kvadrat, tanlangach — rasm. */
function LogoBox({ r }: { r: BusinessRegistration }) {
  const t = useTranslations("app.register.business");
  const preview = usePreview(r.logo);
  return (
    <label
      aria-label={t("logoUpload")}
      className="relative box-border flex size-[58px] cursor-pointer items-center justify-center overflow-hidden rounded-18 border-2 border-dashed border-muted-2 bg-white text-muted"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- brauzerdagi blob: manzil
        <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Icon name="plus" size={24} strokeWidth={2.4} />
      )}
      <input type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(e) => r.pickFiles("logo", e.target.files)} />
    </label>
  );
}

/** Joy fotosi plitkasi: tanlangani — rasm, yuklangani (ochiq manzili yo'q) — belgi va nom. */
function PhotoTile({ file, label, onRemove }: { file?: File; label: string; onRemove?: () => void }) {
  const t = useTranslations("app.register.business");
  const preview = usePreview(file ?? null);
  return (
    <div className="relative flex h-[74px] flex-1 items-center justify-center overflow-hidden rounded-16 bg-surface-2 text-muted" title={label}>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- brauzerdagi blob: manzil
        <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Icon name="camera" size={24} strokeWidth={2} />
      )}
      {onRemove ? (
        <button
          type="button"
          aria-label={t("removePhoto")}
          onClick={onRemove}
          className="tap absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full border-0 bg-ink text-white"
        >
          <Icon name="close" size={12} strokeWidth={3} />
        </button>
      ) : null}
    </div>
  );
}

/** Umumiy xato yoki yuklash jarayoni (maydon ostida ko'rsatilmaganlari) */
function Status({ r }: { r: BusinessRegistration }) {
  if (!r.failureText || r.failure?.kind === "auth" || (r.failure?.kind === "save" && r.failure.error === "tinTaken")) return null;
  return (
    <p role="alert" className="mt-3 mb-0 text-13 font-semibold text-danger">
      {r.failureText}
    </p>
  );
}

/** B9 · Biznes 4/4: ariza tekshiruvda (`/biznes`, PENDING). */
export function AppBusinessReview() {
  const t = useTranslations("app.register.business");
  return (
    <AppScreen>
      <RegisterTop role="business" step={4} back={null} />
      <div className="mt-9">
        <span data-testid="business-stamp" className="inline-block -rotate-4 rounded-10 border-[3px] border-solid border-orange px-3 pt-1 pb-[5px] text-15 font-black tracking-[0.1em] text-orange">
          {t("stamp")}
        </span>
        <AppTitle size={44} className="mt-5">
          {t.rich("title4", { br: () => <br /> })}
        </AppTitle>
        <AppLead size={16} className="mt-3.5">
          {t("lead4")}
        </AppLead>
      </div>
      <div className="relative mt-7 -rotate-1 rounded-28 bg-ink p-[22px] text-white shadow-float-ink-soft">
        <span className="absolute -top-[18px] right-[18px] flex size-16 rotate-10 items-center justify-center rounded-full bg-orange text-26 font-black text-ink font-stretch-62%">
          {t("ctaBadge")}
        </span>
        <div className="max-w-[220px] text-20 leading-[1.2] font-extrabold">{t("ctaTitle")}</div>
        <div className="mt-2 text-14 leading-[1.45] opacity-80">{t("ctaLead")}</div>
      </div>
      <div className="flex-1" />
      <ButtonLink href="/biznes/chegirma/yangi" variant="orange" size="app" strong block className="mt-6">
        {t("createDiscount")}
        <Icon name="arrowRight" size={22} strokeWidth={2.4} />
      </ButtonLink>
      <div className="mt-1.5 flex justify-center">
        <FooterLink href="/biznes/profil" lead={t("cabinet")} />
      </div>
    </AppScreen>
  );
}
