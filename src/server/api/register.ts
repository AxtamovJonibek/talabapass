import "server-only";
import { z } from "zod";
import { cleanRequestedName, OTHER_UNIVERSITY } from "@/lib/universities";
import { NAME } from "@/lib/profile";
import { acceptPhoneInvite } from "../business/cashiers";
import { cleanBusinessInfo, createBusinessOwner } from "../business/registration";
import { db } from "../db";
import { createStudent, studentFormSchema } from "../student/registration";
import { openRegisterTicket, type NewRole, type SignedIn } from "./auth-flow";
import { ApiError } from "./http";
import { loadApiUser, meView, openApiSession, type Device } from "./session";

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
  return opened;
}

async function finish(userId: string, passwordHash: string | null, device: Device): Promise<SignedIn> {
  // Google/Apple hisobi parolsiz (ilovaga shu provayder bilan kiradi)
  if (passwordHash) await db.user.update({ where: { id: userId }, data: { passwordHash, passwordFails: 0, passwordLockedUntil: null } });
  const tokens = await openApiSession(userId, device);
  return { tokens, user: meView(await loadApiUser(userId)) };
}

/** Talaba (T1 / RoyxatTalaba): ism, familiya, OTM (yoki "Ro'yxatda yo'q" + nomi), kurs. Holat — DRAFT (guvohnoma keyin). */
export async function registerStudent(input: z.infer<typeof studentRegisterSchema>, device: Device): Promise<SignedIn> {
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
  return finish(user.id, passwordHash, device);
}

export const businessInfoSchema = z.object({
  name: z.string().max(200),
  kind: z.string().max(40),
  address: z.string().max(400),
  workingHours: z.string().max(200),
  description: z.string().max(400).default(""),
  tin: z.string().max(40),
  contactName: z.string().max(200),
});

export function cleanInfoOrThrow(info: z.infer<typeof businessInfoSchema>) {
  const cleaned = cleanBusinessInfo(info);
  if (!cleaned.ok) throw new ApiError("invalid_request", { fields: cleaned.fields });
  return cleaned.info;
}

/** Biznes egasi hisobi va ariza (hali yuborilmagan: hujjatlar keyin yuklanadi, so'ng `submit`). */
export async function registerBusiness(ticket: string, info: z.infer<typeof businessInfoSchema>, device: Device): Promise<SignedIn> {
  const clean = cleanInfoOrThrow(info);
  const { account, passwordHash } = await freshTicket(ticket, "business");
  const created = await createBusinessOwner(account, clean);
  if (!created.ok) throw new ApiError("tin_taken");
  return finish(created.userId, passwordHash, device);
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
  return finish(accepted.userId, passwordHash, device);
}
