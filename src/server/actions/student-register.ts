"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { confirmPhone } from "../auth/phone-check";
import { createSession, forgetVerifiedPhone, homePathFor } from "../auth/session";
import { effectiveStudentStatus, studentPathFor } from "../auth/student-status";
import { db } from "../db";
import { cleanRequestedName, OTHER_UNIVERSITY } from "@/lib/universities";
import { createStudent, studentFormSchema } from "../student/registration";
import type { AuthError } from "./auth";

export type RegisterField = "phone" | "firstName" | "lastName" | "universityId" | "universityOther" | "course";
export type RegisterResult =
  | { ok: false; fields: RegisterField[] }
  | { ok: false; error: AuthError; retryInSeconds?: number }
  /** SMS kod yuborildi (yoki yaqinda yuborilgan) — kod kiritish qadami */
  | { ok: true; step: "code"; phone: string; retryInSeconds?: number };

const inputSchema = z.object({
  phone: z.string().max(32),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  universityId: z.string().max(40),
  universityOther: z.string().max(200).optional(),
  course: z.string().max(10),
  code: z.string().max(12).optional(),
});

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
  // "Ro'yxatda yo'q": nom matni kerak (admin keyin ro'yxatga qo'shadi); aks holda faol OTM bo'lishi shart
  const otherName = input.data.universityId === OTHER_UNIVERSITY ? cleanRequestedName(input.data.universityOther ?? "") : null;
  if (input.data.universityId === OTHER_UNIVERSITY) {
    if (!otherName) fields.push("universityOther");
  } else if (form.success && !(await db.university.findFirst({ where: { id: form.data.universityId, active: true, kind: { not: "OTHER" } }, select: { id: true } }))) {
    fields.push("universityId");
  }
  if (!phone || !form.success || fields.length > 0) return { ok: false, fields };

  const check = await confirmPhone(phone, input.data.code);
  if (check.status === "code") return { ok: true, step: "code", phone, retryInSeconds: check.retryInSeconds };
  if (check.status === "error") return { ok: false, error: check.error, retryInSeconds: check.retryInSeconds };

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

  const user = await createStudent(phone, form.data, otherName);
  await forgetVerifiedPhone();
  await createSession(user.id, userAgent);
  return redirect({ href: "/talaba/guvohnoma", locale });
}
