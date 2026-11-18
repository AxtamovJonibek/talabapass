"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { localizedPath } from "@/i18n/routing";
import { addCustomPartner, deleteCustomPartner, removePartnerLogo, saveLandingSettings, savePartner } from "../admin/landing-admin";
import {
  changeRole,
  closeSessions,
  createUser,
  deleteDiscountByAdmin,
  deleteUser,
  removeLogoByAdmin,
  removePhotoByAdmin,
  requirePasswordReset,
  saveDiscountByAdmin,
  setBusinessPermissions,
  setDiscountStatusByAdmin,
  setUserBlocked,
} from "../admin/super";
import { requireRole } from "../auth/session";
import { blockBusiness, unblockBusiness } from "../moderation";

/*
 * Super admin amallari. Har birida avval `requireRole("ADMIN")` (SMS + admin paroli); audit — server funksiyalarida.
 */

export type SuperState = { status: "idle" } | { status: "saved"; id?: string } | { status: "error"; error: string; fields: string[]; problems?: Record<string, string> };
export type SuperActionResult = { ok: boolean; error?: string; fields?: string[]; id?: string; problems?: Record<string, string> };

const id = z.string().min(1).max(40);
const USERS = "/admin/foydalanuvchilar";
const BUSINESSES = "/admin/hamkorlar";
const LANDING = "/admin/landing";

function refresh(...paths: string[]) {
  for (const path of [...paths, "/admin/jurnal"]) revalidatePath(localizedPath(path));
}

const fromResult = (r: { ok: boolean; error?: string; fields?: string[]; id?: string; errors?: Record<string, string> }): SuperActionResult =>
  r.ok ? { ok: true, id: r.id } : { ok: false, error: r.error, fields: r.fields, problems: r.errors };

// ───────── foydalanuvchilar ─────────

export async function closeSessionsAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ userId: id, sessionId: id.optional() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await closeSessions(admin.id, input.data.userId, input.data.sessionId);
  refresh(USERS);
  return fromResult(r);
}

export async function requirePasswordResetAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ userId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await requirePasswordReset(admin.id, input.data.userId);
  refresh(USERS);
  return fromResult(r);
}

export async function changeRoleAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ userId: id, role: z.string().max(20) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await changeRole(admin.id, input.data.userId, input.data.role);
  refresh(USERS);
  return fromResult(r);
}

export async function deleteUserAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ userId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await deleteUser(admin.id, input.data.userId);
  refresh(USERS);
  return fromResult(r);
}

/** Bloklash / blokdan chiqarish (sabab bilan) — `moderation.ts` orqali (sessiyalar bilan birga) */
export async function setUserBlockedAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ userId: id, blocked: z.boolean(), reason: z.string().trim().max(200).default("") }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await setUserBlocked(admin.id, input.data.userId, input.data.blocked, input.data.reason);
  refresh(USERS, "/admin/bloklanganlar");
  return fromResult(r);
}

export async function createUserAction(_prev: SuperState, formData: FormData): Promise<SuperState> {
  const admin = await requireRole("ADMIN");
  const field = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  const r = await createUser(admin.id, { role: field("role"), firstName: field("firstName"), lastName: field("lastName"), phone: field("phone"), email: field("email"), password: field("password") });
  if (!r.ok) return { status: "error", error: r.error, fields: r.fields ?? [] };
  refresh(USERS);
  return { status: "saved", id: r.id };
}

// ───────── bizneslar ─────────

export async function setPermissionsAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, permissions: z.unknown() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await setBusinessPermissions(admin.id, input.data.businessId, input.data.permissions);
  refresh(BUSINESSES);
  return fromResult(r);
}

export async function setBusinessBlockedAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, blocked: z.boolean(), reason: z.string().trim().max(200).default("") }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  if (input.data.blocked) {
    if (input.data.reason.length < 3) return { ok: false, error: "invalid", fields: ["reason"] };
    await blockBusiness(input.data.businessId, input.data.reason, admin.id);
  } else if (!(await unblockBusiness(input.data.businessId, admin.id))) return { ok: false, error: "invalid" };
  refresh(BUSINESSES, "/admin/bloklanganlar");
  return { ok: true };
}

export async function removeLogoAdminAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await removeLogoByAdmin(admin.id, input.data.businessId);
  refresh(BUSINESSES);
  return fromResult(r);
}

export async function removePhotoAdminAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ docId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await removePhotoByAdmin(admin.id, input.data.docId);
  refresh(BUSINESSES);
  return fromResult(r);
}

// ───────── chegirmalar ─────────

export async function saveDiscountAdminAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ discountId: id, draft: z.unknown() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await saveDiscountByAdmin(admin.id, input.data.discountId, input.data.draft);
  refresh(BUSINESSES, "/admin/chegirmalar");
  return r.ok ? { ok: true } : r.error === "errors" ? { ok: false, error: "errors", problems: r.errors } : fromResult(r);
}

export async function setDiscountStatusAdminAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ discountId: id, active: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await setDiscountStatusByAdmin(admin.id, input.data.discountId, input.data.active);
  refresh(BUSINESSES);
  return fromResult(r);
}

export async function deleteDiscountAdminAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ discountId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await deleteDiscountByAdmin(admin.id, input.data.discountId);
  refresh(BUSINESSES, "/admin/chegirmalar");
  return fromResult(r);
}

// ───────── landing ─────────

export async function saveLandingSettingsAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const r = await saveLandingSettings(admin.id, raw);
  refresh(LANDING, "/");
  return fromResult(r);
}

export async function savePartnerAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id.nullable(), partnerId: id.nullable(), sort: z.number(), hidden: z.boolean(), name: z.string().max(60).optional() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const { businessId, partnerId, ...data } = input.data;
  const target = businessId ? { businessId } : partnerId ? { partnerId } : null;
  if (!target) return { ok: false, error: "invalid" };
  const r = await savePartner(admin.id, target, data);
  refresh(LANDING, "/");
  return fromResult(r);
}

export async function addCustomPartnerAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ name: z.string().max(60) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await addCustomPartner(admin.id, input.data.name);
  refresh(LANDING, "/");
  return fromResult(r);
}

export async function deleteCustomPartnerAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ partnerId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await deleteCustomPartner(admin.id, input.data.partnerId);
  refresh(LANDING, "/");
  return fromResult(r);
}

export async function removePartnerLogoAction(raw: unknown): Promise<SuperActionResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ partnerId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const r = await removePartnerLogo(admin.id, input.data.partnerId);
  refresh(LANDING, "/");
  return fromResult(r);
}
