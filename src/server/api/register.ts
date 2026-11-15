import "server-only";
import { z } from "zod";
import { cleanRequestedName, OTHER_UNIVERSITY } from "@/lib/universities";
import { cleanBusinessInfo, createBusinessOwner } from "../business/registration";
import { db } from "../db";
import { createStudent, studentFormSchema } from "../student/registration";
import { openRegisterTicket, type SignedIn } from "./auth-flow";
import { ApiError } from "./http";
import { loadApiUser, meView, openApiSession, type Device } from "./session";

/*
 * Ro'yxat API orqali: `registrationTicket` (SMS bilan tasdiqlangan yangi raqam + o'rnatilgan parol xeshi) bilan hisob
 * ochiladi va darhol tokenlar beriladi. Qoidalar saytdagi bilan bir xil (`student/registration.ts`,
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

/** Ticket ochiladi va raqam hali bo'shligi tekshiriladi (shu orada boshqa yo'l bilan hisob ochilgan bo'lsa — qaytadan). */
async function freshTicket(ticket: string, role: "student" | "business") {
  const opened = openRegisterTicket(ticket, role);
  if (await db.user.findUnique({ where: { phone: opened.phone }, select: { id: true } })) throw new ApiError("step_expired");
  return opened;
}

async function finish(userId: string, passwordHash: string, device: Device): Promise<SignedIn> {
  await db.user.update({ where: { id: userId }, data: { passwordHash, passwordFails: 0, passwordLockedUntil: null } });
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

  const { phone, passwordHash } = await freshTicket(input.registrationTicket, "student");
  const user = await createStudent(phone, form.data, otherName);
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
  const { phone, passwordHash } = await freshTicket(ticket, "business");
  const created = await createBusinessOwner(phone, clean);
  if (!created.ok) throw new ApiError("tin_taken");
  return finish(created.userId, passwordHash, device);
}
