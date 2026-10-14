"use server";

import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { requestOtp, verifyOtp } from "../auth/otp";
import { createSession, forgetVerifiedPhone, getVerifiedPhone, homePathFor } from "../auth/session";
import { effectiveStudentStatus, studentPathFor } from "../auth/student-status";
import { db } from "../db";
import { createStudent, studentFormSchema } from "../student/registration";
import type { AuthError } from "./auth";

export type RegisterField = "phone" | "firstName" | "lastName" | "universityId" | "course";
export type RegisterResult =
  | { ok: false; fields: RegisterField[] }
  | { ok: false; error: AuthError; retryInSeconds?: number }
  /** SMS kod yuborildi (yoki yaqinda yuborilgan) — kod kiritish qadami */
  | { ok: true; step: "code"; phone: string; retryInSeconds?: number };

const SEND_ERRORS = { too_soon: "tooSoon", daily_limit: "dailyLimit", ip_limit: "ipLimit", locked: "locked" } as const;

const inputSchema = z.object({
  phone: z.string().max(32),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  universityId: z.string().max(40),
  course: z.string().max(10),
  code: z.string().max(12).optional(),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/**
 * T1 / WT1 — talaba ro'yxati. Raqam egaligi SMS kod bilan tasdiqlanadi (kirish sahifasidan tasdiqlangan
 * raqam bilan kelgan bo'lsa — qayta so'ralmaydi). Raqam allaqachon ro'yxatda bo'lsa, kod tasdiqlangach
 * shunchaki o'sha hisobga kiriladi — bu haqda koddan oldin hech narsa oshkor qilinmaydi.
 */
export async function registerStudentAction(raw: unknown): Promise<RegisterResult> {
  const input = inputSchema.safeParse(raw);
  if (!input.success) return { ok: false, fields: ["phone"] };

  const phone = normalizePhone(input.data.phone);
  const form = studentFormSchema.safeParse(input.data);
  const fields: RegisterField[] = [];
  if (!phone) fields.push("phone");
  if (!form.success) fields.push(...new Set(form.error.issues.map((issue) => issue.path[0] as RegisterField)));
  if (form.success && !(await db.university.findUnique({ where: { id: form.data.universityId }, select: { id: true } }))) {
    fields.push("universityId");
  }
  if (!phone || !form.success || fields.length > 0) return { ok: false, fields };

  const alreadyVerified = (await getVerifiedPhone()) === phone;
  if (!alreadyVerified) {
    const code = input.data.code?.replace(/\D/g, "");
    if (!code) {
      const t = await getTranslations("auth");
      try {
        const sent = await requestOtp(phone, await clientIp(), (c) => t("sms", { code: c }));
        if (!sent.ok) {
          const retryInSeconds = Math.ceil(sent.retryInMs / 1000);
          // Kod hozirgina yuborilgan — foydalanuvchida u bor, kiritish qadamiga o'tamiz.
          if (sent.reason === "too_soon") return { ok: true, step: "code", phone, retryInSeconds };
          return { ok: false, error: SEND_ERRORS[sent.reason], retryInSeconds };
        }
      } catch (error) {
        console.error("SMS yuborilmadi:", error);
        return { ok: false, error: "sms" };
      }
      return { ok: true, step: "code", phone };
    }
    const verified = await verifyOtp(phone, code);
    if (verified !== "ok") {
      return { ok: false, error: verified === "locked" ? "locked" : verified === "wrong" ? "wrongCode" : "expired" };
    }
  }

  const locale = await getLocale();
  const userAgent = (await headers()).get("user-agent");
  const existing = await db.user.findUnique({
    where: { phone },
    select: { id: true, role: true, status: true, student: { select: { status: true, cardExpiresAt: true } } },
  });
  if (existing) {
    if (existing.status !== "ACTIVE") return { ok: false, error: "blocked" };
    await forgetVerifiedPhone();
    await createSession(existing.id, userAgent);
    const href = existing.student
      ? studentPathFor(effectiveStudentStatus(existing.student.status, existing.student.cardExpiresAt, new Date()))
      : homePathFor(existing.role);
    return redirect({ href, locale });
  }

  const user = await createStudent(phone, form.data);
  await forgetVerifiedPhone();
  await createSession(user.id, userAgent);
  return redirect({ href: "/talaba/guvohnoma", locale });
}
