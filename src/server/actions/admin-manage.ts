"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "../auth/session";
import { createAdmin, deleteUniversity, editBusiness, editUser, rejectUniversityRequest, resolveUniversityRequest, saveUniversity, updateOwnName, type ManageResult } from "../admin/manage";

/** Admin formalari holati: `useActionState` bilan ishlatiladi. */
export type ManageState = { status: "idle" } | { status: "saved"; id?: string } | { status: "error"; fields: string[]; error?: string };

const IDLE_ERROR = (result: Extract<ManageResult, { ok: false }>): ManageState => ({ status: "error", fields: result.fields ?? [], error: result.error });

/** FormData → oddiy obyekt (faqat matn maydonlari). */
function raw(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  return out;
}

const done = (result: ManageResult, paths: string[]): ManageState => {
  if (!result.ok) return IDLE_ERROR(result);
  for (const path of paths) revalidatePath(path);
  return { status: "saved", id: result.id };
};

/** "Profil": admin o'z ism-familiyasini o'zgartiradi. */
export async function updateOwnNameAction(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  return done(await updateOwnName(admin.id, raw(formData)), ["/admin", "/admin/profil"]);
}

/** Yangi admin qo'shish. */
export async function createAdminAction(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  return done(await createAdmin(admin.id, raw(formData)), ["/admin/profil"]);
}

/** Foydalanuvchi (talaba, biznes egasi, kassir) ma'lumotlarini tahrirlash. */
export async function editUserAction(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  const data = raw(formData);
  const userId = typeof data.userId === "string" ? data.userId : "";
  if (!userId) return { status: "error", fields: [], error: "notFound" };
  return done(await editUser(admin.id, userId, data), ["/admin/foydalanuvchilar"]);
}

export async function editBusinessAction(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  const data = raw(formData);
  const businessId = typeof data.businessId === "string" ? data.businessId : "";
  if (!businessId) return { status: "error", fields: [], error: "notFound" };
  return done(await editBusiness(admin.id, businessId, data), ["/admin/foydalanuvchilar", "/admin/bizneslar"]);
}

const universityRaw = (formData: FormData): Record<string, unknown> => {
  const data = raw(formData);
  return { ...data, active: data.active === "on" || data.active === "true" };
};

/** Universitet qo'shish / tahrirlash (`id` bo'lsa tahrir). */
export async function saveUniversityAction(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  const data = universityRaw(formData);
  const id = typeof data.id === "string" && data.id ? data.id : null;
  return done(await saveUniversity(admin.id, id, data), ["/admin/universitetlar", "/talaba/royxat"]);
}

export async function deleteUniversityAction(id: string): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  return done(await deleteUniversity(admin.id, String(id).slice(0, 40)), ["/admin/universitetlar", "/talaba/royxat"]);
}

/** "Ro'yxatda yo'q" so'rovi: yangi universitet sifatida qo'shish yoki mavjudiga biriktirish. */
export async function resolveRequestAction(_prev: ManageState, formData: FormData): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  const data = universityRaw(formData);
  const requestId = typeof data.requestId === "string" ? data.requestId : "";
  const existing = typeof data.universityId === "string" ? data.universityId : "";
  const result = await resolveUniversityRequest(admin.id, requestId, existing ? { universityId: existing } : { create: data });
  return done(result, ["/admin/universitetlar", "/admin/talabalar"]);
}

export async function rejectRequestAction(requestId: string): Promise<ManageState> {
  const admin = await requireRole("ADMIN");
  return done(await rejectUniversityRequest(admin.id, String(requestId).slice(0, 40)), ["/admin/universitetlar"]);
}
