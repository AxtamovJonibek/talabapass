"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { RESEND_SECONDS } from "@/components/auth/code-entry";
import type { AuthError } from "@/server/actions/auth";
import { registerStudentAction, type RegisterField } from "@/server/actions/student-register";

export const COURSES = ["C1", "C2", "C3", "C4", "MASTER"] as const;
export type Course = (typeof COURSES)[number];
export type RegistrationValues = { phone: string; firstName: string; lastName: string; universityId: string; course: string };

/**
 * Talaba ro'yxati holati va mantig'i — mobil (T1) va veb (WT1) ko'rinishlar uchun bitta.
 * Maydon qiymatlari formaning o'zidan o'qiladi (sahifa ulanmasdan oldin yozilgan matn yo'qolmasligi uchun);
 * bu yerda faqat oxirgi yuborilgan qiymatlar saqlanadi.
 */
export function useRegistration(verifiedPhone: string | null) {
  const t = useTranslations("onboarding.register");
  const auth = useTranslations("auth");
  const [picked, setPicked] = useState<Course | null>(null);
  const [values, setValues] = useState<RegistrationValues | null>(null);
  const [invalid, setInvalid] = useState<RegisterField[]>([]);
  const [failure, setFailure] = useState<{ error: AuthError; retryInSeconds?: number } | null>(null);
  const [codePhone, setCodePhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  function submit(next: RegistrationValues, otp?: string) {
    setValues(next);
    setInvalid([]);
    setFailure(null);
    startTransition(async () => {
      // Muvaffaqiyatli ro'yxatda server keyingi qadamga yo'naltiradi; bu yerga faqat oraliq natija qaytadi.
      const result = await registerStudentAction({ ...next, code: otp });
      if (!result) return;
      if (result.ok) {
        setCodePhone(result.phone);
        setCode("");
        setResendIn(result.retryInSeconds ?? RESEND_SECONDS);
      } else if ("fields" in result) {
        setInvalid(result.fields);
      } else {
        setFailure(result);
        setCode("");
      }
    });
  }

  return {
    course: picked ?? values?.course ?? "",
    pickCourse: setPicked,
    values,
    invalid,
    failure,
    pending,
    code,
    setCode,
    resendIn,
    /** Kod kiritish qadamidamiz (va qaysi raqamga yuborilgan) */
    codePhone: values ? codePhone : null,
    submitForm(form: FormData) {
      submit({
        phone: verifiedPhone ?? String(form.get("phone") ?? ""),
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        universityId: String(form.get("universityId") ?? ""),
        course: String(form.get("course") ?? ""),
      });
    },
    submitCode(otp: string) {
      if (values) submit(values, otp);
    },
    resend() {
      if (values) submit(values);
    },
    backToForm() {
      setCodePhone(null);
      setFailure(null);
    },
    errorText: failure
      ? auth(`errors.${failure.error}`, { seconds: failure.retryInSeconds ?? 0, minutes: Math.ceil((failure.retryInSeconds ?? 0) / 60) })
      : null,
    fieldError: (field: RegisterField) => (invalid.includes(field) ? t(`errors.${field}`) : undefined),
  };
}

export type Registration = ReturnType<typeof useRegistration>;
