import "server-only";
import { z } from "zod";
import { validateQuickApplication } from "@/lib/business-application";
import { cleanRequestedName, OTHER_UNIVERSITY } from "@/lib/universities";
import { NAME } from "@/lib/profile";
import { acceptPhoneInvite } from "../business/cashiers";
import { createQuickBusiness } from "../business/quick-application";
import { db } from "../db";
import { createStudent, studentFormSchema } from "../student/registration";
import { apiOpener, openRegisterTicket, type NewRole, type Opener, type SignedIn } from "./auth-flow";
import { ApiError } from "./http";
import type { Device } from "./session";

/*
 * Ro'yxat API orqali: `registrationTicket` (SMS bilan tasdiqlangan yangi raqam + o'rnatilgan parol xeshi yoki
 * Google/Apple identifikatori — parolsiz) bilan hisob ochiladi va darhol tokenlar beriladi. Qoidalar saytdagi bilan bir xil (`student/registration.ts`,
 * `business/registration.ts`); hisob ochilgach parol yoziladi — `applyPendingPassword` kabi.
 */

export const studentRegisterSchema = z.object({
  registrationTicket: z.string().max(2000),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  universityId: z.string().max(40),
  universityOther: z.string().max(200).optional(),
  course: z.string().max(10),
  deviceName: z.string().max(200).optional(),
});

/**
 * Ticket ochiladi va raqam (yoki Google/Apple identifikatori va email) hali bo'shligi tekshiriladi — shu orada boshqa yo'l
 * bilan hisob ochilgan bo'lsa, qaytadan kirish kerak.
 */
async function freshTicket(ticket: string, role: NewRole) {
  const opened = openRegisterTicket(ticket, role);
  const { account } = opened;
  const taken =
    typeof account === "string"
      ? await db.user.findUnique({ where: { phone: account }, select: { id: true } })
      : ((await db.authIdentity.findUnique({ where: { provider_subject: { provider: account.provider, subject: account.subject } }, select: { id: true } })) ??
        (account.email ? await db.user.findUnique({ where: { email: account.email }, select: { id: true } }) : null));
  if (taken) throw new ApiError("step_expired");
  // Google/Apple hisobi ham parolli bo'ladi: parol ma'lumotlardan oldin o'rnatiladi, o'tkazib yuborib bo'lmaydi
  if (!opened.passwordHash) throw new ApiError("password_required");
  return { account, passwordHash: opened.passwordHash };
}

async function finish<T>(userId: string, passwordHash: string, open: Opener<T>): Promise<T> {
  await db.user.update({ where: { id: userId }, data: { passwordHash, passwordFails: 0, passwordLockedUntil: null } });
  return open(userId);
}

/** Talaba (T1 / RoyxatTalaba): ism, familiya, OTM (yoki "Ro'yxatda yo'q" + nomi), kurs. Holat — DRAFT (guvohnoma keyin). */
export const registerStudent = (input: z.infer<typeof studentRegisterSchema>, device: Device) => registerStudentWith(input, apiOpener(device));

export async function registerStudentWith<T>(input: z.infer<typeof studentRegisterSchema>, open: Opener<T>): Promise<T> {
  const form = studentFormSchema.safeParse(input);
  const fields: string[] = form.success ? [] : [...new Set(form.error.issues.map((issue) => String(issue.path[0])))];
  // "Ro'yxatda yo'q": nom matni kerak (admin keyin ro'yxatga qo'shadi); aks holda faol OTM bo'lishi shart
  const otherName = input.universityId === OTHER_UNIVERSITY ? cleanRequestedName(input.universityOther ?? "") : null;
  if (input.universityId === OTHER_UNIVERSITY) {
    if (!otherName) fields.push("universityOther");
  } else if (form.success && !(await db.university.findFirst({ where: { id: form.data.universityId, active: true, kind: { not: "OTHER" } }, select: { id: true } }))) {
    fields.push("universityId");
  }
  if (!form.success || fields.length > 0) throw new ApiError("invalid_request", { fields });

  const { account, passwordHash } = await freshTicket(input.registrationTicket, "student");
  const user = await createStudent(account, form.data, otherName);
  return finish(user.id, passwordHash, open);
}

export const quickApplicationSchema = z.object({
  name: z.string().max(200),
  address: z.string().max(400),
  tin: z.string().max(40),
  phone: z.string().max(40),
  telegram: z.string().max(100),
});

export function cleanQuickOrThrow(input: z.infer<typeof quickApplicationSchema>) {
  const cleaned = validateQuickApplication(input);
  if (!cleaned.ok) throw new ApiError("invalid_request", { fields: cleaned.fields });
  return cleaned.value;
}

/** Biznes egasi hisobi va ariza (hali yuborilmagan: rasm keyin yuklanadi, so'ng `submit`). */
export const registerBusiness = (ticket: string, input: z.infer<typeof quickApplicationSchema>, device: Device) => registerBusinessWith(ticket, input, apiOpener(device));

export async function registerBusinessWith<T>(ticket: string, input: z.infer<typeof quickApplicationSchema>, open: Opener<T>): Promise<T> {
  const clean = cleanQuickOrThrow(input);
  const { account, passwordHash } = await freshTicket(ticket, "business");
  const created = await createQuickBusiness(account, clean);
  if (!created.ok) throw new ApiError("tin_taken");
  return finish(created.userId, passwordHash, open);
}

export const cashierRegisterSchema = z.object({
  registrationTicket: z.string().max(2000),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  deviceName: z.string().max(200).optional(),
});

/**
 * Kassir (telefon taklifi bilan): ism va familiya → kassir hisobi, a'zolik va tokenlar (`acceptPhoneInvite`, saytdagi
 * havola bilan qabul qilish bilan bir xil tranzaksiya). Taklif shu orada bekor qilingan/eskirgan bo'lsa — `no_business`.
 */
export async function registerCashier(input: z.infer<typeof cashierRegisterSchema>, device: Device): Promise<SignedIn> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fields = [...(NAME.test(firstName) ? [] : ["firstName"]), ...(NAME.test(lastName) ? [] : ["lastName"])];
  if (fields.length > 0) throw new ApiError("invalid_request", { fields });
  const { account, passwordHash } = await freshTicket(input.registrationTicket, "cashier");
  // Kassir faqat telefon taklifi bilan (Google/Apple ro'yxat tokeni kassirga berilmaydi)
  if (typeof account !== "string") throw new ApiError("step_expired");
  const accepted = await acceptPhoneInvite(account, { firstName, lastName });
  if (!accepted.ok) throw new ApiError("no_business");
  return finish(accepted.userId, passwordHash, apiOpener(device));
}
