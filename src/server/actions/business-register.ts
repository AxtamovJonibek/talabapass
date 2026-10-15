"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { BusinessField } from "@/lib/business";
import { normalizePhone } from "@/lib/format";
import { confirmPhone } from "../auth/phone-check";
import { createSession, forgetVerifiedPhone, getCurrentUser, homePathFor, requireRole } from "../auth/session";
import { cleanBusinessInfo, createBusinessOwner, removeBusinessDoc, submitBusiness, updateBusinessInfo, type SubmitProblem } from "../business/registration";
import { db } from "../db";
import type { AuthError } from "./auth";

export type SaveField = BusinessField | "phone";
export type SaveError = AuthError | "phoneInUse" | "tinTaken" | "notEditable";
export type SaveResult =
  | { ok: false; fields: SaveField[] }
  | { ok: false; error: SaveError; retryInSeconds?: number }
  | { ok: true; step: "code"; phone: string; retryInSeconds?: number }
  /** Hisob va ariza saqlandi (sessiya ochiq) — endi fayllar yuklanadi */
  | { ok: true; step: "saved" }
  /** Raqam allaqachon biznes egasiga tegishli — o'sha hisobga kirildi, ariza formasi e'tiborsiz qoldirildi */
  | { ok: true; step: "existing"; href: string };

const inputSchema = z.object({
  name: z.string().max(200),
  kind: z.string().max(40),
  address: z.string().max(400),
  workingHours: z.string().max(200),
  description: z.string().max(400),
  tin: z.string().max(40),
  contactName: z.string().max(200),
  phone: z.string().max(32),
  code: z.string().max(12).optional(),
});

/**
 * B1 / WB1 — biznes arizasi matnlari. Kirmagan foydalanuvchi uchun: raqam SMS kod bilan tasdiqlanadi va
 * biznes egasi hisobi ochiladi. Kirgan egasi uchun: yuborilmagan yoki rad etilgan arizasi yangilanadi.
 * Fayllar keyin `/api/biznes/hujjat` orqali yuklanadi, so'ng `submitBusinessAction`.
 */
export async function saveBusinessAction(raw: unknown): Promise<SaveResult> {
  const input = inputSchema.safeParse(raw);
  if (!input.success) return { ok: false, fields: ["name"] };
  const cleaned = cleanBusinessInfo(input.data);

  const user = await getCurrentUser();
  if (user) {
    if (user.role !== "BUSINESS_OWNER") return { ok: false, error: "notEditable" };
    if (!cleaned.ok) return { ok: false, fields: cleaned.fields };
    const updated = await updateBusinessInfo(user.id, cleaned.info);
    return updated.ok ? { ok: true, step: "saved" } : { ok: false, error: updated.error };
  }

  const phone = normalizePhone(input.data.phone);
  const fields: SaveField[] = cleaned.ok ? [] : [...cleaned.fields];
  if (!phone) fields.push("phone");
  if (!phone || !cleaned.ok) return { ok: false, fields };

  const check = await confirmPhone(phone, input.data.code);
  if (check.status === "code") return { ok: true, step: "code", phone, retryInSeconds: check.retryInSeconds };
  if (check.status === "error") return { ok: false, error: check.error, retryInSeconds: check.retryInSeconds };

  const userAgent = (await headers()).get("user-agent");
  const existing = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true } });
  if (existing) {
    if (existing.status !== "ACTIVE") return { ok: false, error: "blocked" };
    // Raqam talaba/kassir/admin hisobiga biriktirilgan — bitta raqam bitta rolda (kirish sahifasi ham shunday).
    if (existing.role !== "BUSINESS_OWNER") return { ok: false, error: "phoneInUse" };
    await forgetVerifiedPhone();
    await createSession(existing.id, userAgent);
    return { ok: true, step: "existing", href: homePathFor(existing.role) };
  }

  const created = await createBusinessOwner(phone, cleaned.info);
  if (!created.ok) return { ok: false, error: created.error };
  await forgetVerifiedPhone();
  await createSession(created.userId, userAgent);
  return { ok: true, step: "saved" };
}

export type SubmitResult = { ok: true } | { ok: false; problem: SubmitProblem };

/** Arizani tekshiruvga yuborish (WB1 "Tekshiruvga yuborish"). Muvaffaqiyatda klient /biznes ga o'tadi (3-qadam: tekshiruvda). */
export async function submitBusinessAction(consent: boolean): Promise<SubmitResult> {
  const user = await requireRole("BUSINESS_OWNER");
  return submitBusiness(user.id, consent === true);
}

export async function removeBusinessDocAction(docId: string): Promise<{ ok: boolean }> {
  const user = await requireRole("BUSINESS_OWNER");
  return { ok: await removeBusinessDoc(user.id, z.string().max(40).catch("").parse(docId)) };
}
