"use client";

import { useStepHistory } from "@/lib/use-step-history";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RESEND_SECONDS } from "@/components/auth/code-entry";
import { useRouter } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { INFO_FIELDS, PHOTOS_MAX, validateBusiness, type BusinessField, type BusinessInfo } from "@/lib/business";
import type { AuthError } from "@/server/actions/auth";
import { removeBusinessDocAction, saveBusinessAction, submitBusinessAction, type SaveError, type SaveField } from "@/server/actions/business-register";

export type ExistingDoc = { id: string; kind: "REGISTRATION" | "PHOTO" | "OTHER"; fileName: string };
type UploadProblem = "empty" | "bad_type" | "too_large" | "not_allowed" | "daily_limit" | "too_many" | "network";
type Failure =
  | { kind: "auth"; error: AuthError; retryInSeconds?: number }
  | { kind: "save"; error: Exclude<SaveError, AuthError> | "noRegistration" | "noPhotos" | "consent" }
  | { kind: "upload"; problem: UploadProblem };

/** Qaysi ko'rinish: telefonda (B1) STIR birinchi qadamda, vebda (WB1) — ikkinchisida. */
export type View = "phone" | "web";
const MAX_BYTES = 10 * 1024 * 1024;

type Options = {
  verifiedPhone: string | null;
  /** Kirgan egasining yuborilmagan yoki rad etilgan arizasi */
  initial?: (BusinessInfo & { phone: string }) | null;
  docs?: ExistingDoc[];
  signedIn: boolean;
};

const EMPTY: BusinessInfo & { phone: string } = { name: "", kind: "", address: "", workingHours: "", description: "", tin: "", contactName: "", phone: "" };
const TEXT_FIELDS = ["name", "address", "workingHours", "description", "tin", "contactName", "phone"] as const;

async function uploadFile(kind: "registration" | "photo" | "logo", file: File): Promise<UploadProblem | null> {
  try {
    const response = await fetch(`/api/biznes/hujjat?tur=${kind}`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
      body: file,
    });
    if (response.ok) return null;
    const body = (await response.json().catch(() => null)) as { problem?: UploadProblem } | null;
    return body?.problem ?? "network";
  } catch {
    return "network";
  }
}

/**
 * Biznes arizasi holati — telefon (B1) va veb (WB1) ko'rinishlari uchun bitta.
 * Matnlar formaning o'zidan qadam almashganda o'qiladi (sahifa ulanmasdan oldin yozilgan matn yo'qolmasligi uchun).
 * Yuborish tartibi: matnlar (+ kerak bo'lsa SMS kod, hisob ochiladi) → fayllar → tekshiruvga yuborish.
 */
export function useBusinessRegistration({ verifiedPhone, initial, docs: initialDocs = [], signedIn }: Options) {
  const t = useTranslations("businessOnboarding");
  const auth = useTranslations("auth");
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState(initial ?? { ...EMPTY, phone: verifiedPhone ?? "" });
  const [invalid, setInvalid] = useState<SaveField[]>([]);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [docs, setDocs] = useState(initialDocs);
  const [logo, setLogo] = useState<File | null>(null);
  const [registration, setRegistration] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [descriptionLength, setDescriptionLength] = useState(values.description.length);
  const [codePhone, setCodePhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pending, startTransition] = useTransition();
  /** Bir qadam orqaga: kod → 2-qadam → 1-qadam (holat; tarix yozuvini `goBack` boshqaradi) */
  function stepBack() {
    setFailure(null);
    if (codePhone) setCodePhone(null);
    else setStep(1);
  }
  // Telefondagi "orqaga" ham shu qadamlar bo'ylab yuradi; 1-qadamda — bosh sahifaga
  const goBack = useStepHistory((step === 2 ? 1 : 0) + (codePhone ? 1 : 0), stepBack);
  // Hisob shu sahifada ochilgan bo'lsa — keyingi urinishlarda kod qayta so'ralmaydi
  const [hasAccount, setHasAccount] = useState(signedIn);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function read(form: FormData) {
    const next = { ...values };
    for (const field of TEXT_FIELDS) {
      const value = form.get(field);
      if (typeof value === "string") next[field] = value;
    }
    if (verifiedPhone) next.phone = verifiedPhone;
    setValues(next);
    return next;
  }

  const stepOneFields = (view: View): BusinessField[] => (view === "phone" ? [...INFO_FIELDS, "tin"] : [...INFO_FIELDS]);
  const hasRegistration = Boolean(registration) || docs.some((d) => d.kind === "REGISTRATION");
  const savedPhotos = docs.filter((d) => d.kind === "PHOTO");

  function send(info: typeof values, otp?: string, view: View = "web") {
    setFailure(null);
    startTransition(async () => {
      if (!hasRegistration) return setFailure({ kind: "save", error: "noRegistration" });
      if (savedPhotos.length + photos.length === 0) return setFailure({ kind: "save", error: "noPhotos" });
      if (!consent) return setFailure({ kind: "save", error: "consent" });

      const saved = await saveBusinessAction({ ...info, code: hasAccount ? undefined : otp });
      if (!saved.ok) {
        if ("fields" in saved) {
          setInvalid(saved.fields);
          setCodePhone(null);
          if (saved.fields.some((f) => (stepOneFields(view) as string[]).includes(f))) setStep(1);
        } else if (saved.error === "tinTaken") {
          setInvalid(["tin"]);
          setCodePhone(null);
          setFailure({ kind: "save", error: "tinTaken" });
          if (view === "phone") setStep(1);
        } else if (saved.error === "phoneInUse" || saved.error === "notEditable") {
          setCodePhone(null);
          setFailure({ kind: "save", error: saved.error });
        } else {
          setFailure({ kind: "auth", error: saved.error, retryInSeconds: saved.retryInSeconds });
          setCode("");
        }
        return;
      }
      if (saved.step === "code") {
        setCodePhone(saved.phone);
        setCode("");
        setResendIn(saved.retryInSeconds ?? RESEND_SECONDS);
        return;
      }
      if (saved.step === "existing") return router.replace(saved.href);

      setHasAccount(true);
      setCodePhone(null);
      // Fayllar ketma-ket: har biri alohida tekshiriladi va tozalanadi. Yuklangani qayta yuborilmaydi.
      const queue: { kind: "registration" | "photo" | "logo"; file: File }[] = [
        ...(registration ? [{ kind: "registration" as const, file: registration }] : []),
        ...photos.map((file) => ({ kind: "photo" as const, file })),
        ...(logo ? [{ kind: "logo" as const, file: logo }] : []),
      ];
      for (let i = 0; i < queue.length; i++) {
        setProgress({ done: i, total: queue.length });
        const problem = await uploadFile(queue[i].kind, queue[i].file);
        if (problem) {
          setProgress(null);
          return setFailure({ kind: "upload", problem });
        }
        const item = queue[i];
        if (item.kind === "registration") setRegistration(null);
        if (item.kind === "logo") setLogo(null);
        if (item.kind === "photo") setPhotos((list) => list.filter((f) => f !== item.file));
        if (item.kind !== "logo") {
          setDocs((list) => [
            ...list.filter((d) => item.kind !== "registration" || d.kind !== "REGISTRATION"),
            { id: `local-${i}`, kind: item.kind === "registration" ? "REGISTRATION" : "PHOTO", fileName: item.file.name },
          ]);
        }
      }
      setProgress(null);
      const submitted = await submitBusinessAction(true);
      // Muvaffaqiyatda bitta aniq o'tish: /biznes holatga qarab tekshiruv sahifasini ko'rsatadi
      if (submitted.ok) return router.replace("/biznes");
      setFailure({ kind: "save", error: submitted.problem });
    });
  }

  function pickFiles(kind: "registration" | "photo" | "logo", files: FileList | null) {
    const list = [...(files ?? [])];
    if (list.length === 0) return;
    if (list.some((f) => f.size > MAX_BYTES)) return setFailure({ kind: "upload", problem: "too_large" });
    setFailure(null);
    if (kind === "registration") setRegistration(list[0]);
    if (kind === "logo") setLogo(list[0]);
    if (kind === "photo") {
      const room = PHOTOS_MAX - savedPhotos.length;
      if (list.length > room) return setFailure({ kind: "upload", problem: "too_many" });
      setPhotos(list);
    }
  }

  const failureText = (() => {
    if (!failure) return null;
    if (failure.kind === "auth") {
      const seconds = failure.retryInSeconds ?? 0;
      return auth(`errors.${failure.error}`, { seconds, minutes: Math.ceil(seconds / 60) });
    }
    if (failure.kind === "upload") return t(`errors.upload.${failure.problem}`);
    return t(`errors.${failure.error}`);
  })();

  return {
    step,
    values,
    invalid,
    pending,
    progress,
    docs,
    savedPhotos,
    logo,
    registration,
    photos,
    consent,
    setConsent,
    descriptionLength,
    setDescriptionLength,
    code,
    setCode,
    resendIn,
    signedIn: hasAccount,
    phoneLocked: Boolean(verifiedPhone) || hasAccount,
    codePhone,
    kind: values.kind,
    pickKind: (kind: string) => setValues((v) => ({ ...v, kind })),
    pickFiles,
    removeDoc(id: string) {
      startTransition(async () => {
        const removed = await removeBusinessDocAction(id);
        if (removed.ok) setDocs((list) => list.filter((d) => d.id !== id));
      });
    },
    /** 1-qadam → 2-qadam (shu qadam maydonlari brauzerda tekshiriladi) */
    next(form: FormData, view: View) {
      const info = read(form);
      const wrong = validateBusiness(info, stepOneFields(view));
      setInvalid(wrong);
      setFailure(null);
      if (wrong.length === 0) setStep(2);
    },
    back: goBack,
    submit(form: FormData, view: View) {
      const info = read(form);
      const wrong: SaveField[] = validateBusiness(info);
      if (!hasAccount && !normalizePhone(info.phone)) wrong.push("phone");
      setInvalid(wrong);
      setFailure(null);
      if (wrong.length > 0) {
        if (wrong.some((f) => (stepOneFields(view) as string[]).includes(f))) setStep(1);
        return;
      }
      send(info, undefined, view);
    },
    submitCode(otp: string, view: View) {
      send(values, otp, view);
    },
    resend(view: View) {
      send(values, undefined, view);
    },
    failure,
    failureText,
    fieldError(field: SaveField) {
      if (!invalid.includes(field)) return undefined;
      return field === "tin" && failure?.kind === "save" && failure.error === "tinTaken" ? t("errors.tinTaken") : t(`errors.${field}`);
    },
  };
}

export type BusinessRegistration = ReturnType<typeof useBusinessRegistration>;
