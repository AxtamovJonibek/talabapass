import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "../audit";
import { db } from "../db";
import { landingSettings } from "../landing";
import { LIVE_BUSINESS_STATUSES, visibleDiscountWhere } from "../student/feed";
import { storage } from "../storage";
import { checkUpload } from "../storage/file-rules";
import { sanitizeDocument, UnreadableFileError } from "../storage/sanitize";

/*
 * Landing boshqaruvi (`/admin/landing`): "Raqamlarda" rejimi (avtomatik / qo'lda / yashirin), "Hozir Toshkentda ochiq"
 * (avtomatik / tanlanganlar / aralash), hamkorlar (tartib, yashirish, logotip, qo'lda qo'shilgan nom). Har amal auditda.
 */

export const DEALS_PICK_MAX = 12;
const count = z.number().int().min(0).max(1_000_000_000).nullable();

export const landingSettingsInput = z.object({
  statsMode: z.enum(["AUTO", "MANUAL", "HIDDEN"]),
  statsStudents: count,
  statsBusinesses: count,
  statsDiscounts: count,
  statsSaved: count,
  dealsMode: z.enum(["AUTO", "MANUAL", "MIXED"]),
  dealIds: z.array(z.string().min(1).max(40)).max(DEALS_PICK_MAX),
});

export type LandingAdminResult = { ok: true; id?: string } | { ok: false; error: "invalid" | "notFound" | "badFile"; fields?: string[] };

export async function saveLandingSettings(actorId: string, raw: unknown): Promise<LandingAdminResult> {
  const parsed = landingSettingsInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const data = { ...parsed.data, dealIds: [...new Set(parsed.data.dealIds)] };
  const before = await landingSettings();
  const changed: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(data)) {
    const was = (before as Record<string, unknown>)[k];
    if (JSON.stringify(was ?? null) !== JSON.stringify(v ?? null)) changed[k] = [was ?? null, v ?? null];
  }
  if (Object.keys(changed).length === 0) return { ok: true };
  await db.$transaction(async (tx) => {
    await tx.landingSettings.upsert({ where: { id: "landing" }, create: { id: "landing", ...data }, update: data });
    await audit({ actorId, action: "landing.settings", entity: "Landing", entityId: "landing", meta: { changed } as Prisma.InputJsonValue }, tx);
  });
  return { ok: true };
}

/** Admin sahifasi uchun: sozlamalar, hamkor nomzodlari (tasdiqlangan bizneslar + qo'lda qo'shilganlar), tanlash mumkin chegirmalar */
export async function landingAdminData(now = new Date()) {
  const [settings, businesses, overrides, deals] = await Promise.all([
    landingSettings(),
    db.business.findMany({
      where: { status: { in: LIVE_BUSINESS_STATUSES }, owner: { status: { not: "DELETED" } } },
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, logoKey: true },
    }),
    db.landingPartner.findMany({ orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    db.discount.findMany({
      where: visibleDiscountWhere(now),
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, business: { select: { name: true } } },
    }),
  ]);
  const byBusiness = new Map(overrides.filter((o) => o.businessId).map((o) => [o.businessId!, o]));
  const partners = [
    ...businesses.map((b) => {
      const o = byBusiness.get(b.id);
      return { businessId: b.id, partnerId: o?.id ?? null, name: b.name, sort: o?.sort ?? 0, hidden: o?.hidden ?? false, hasLogo: Boolean(o?.logoKey), hasBusinessLogo: Boolean(b.logoKey), custom: false };
    }),
    ...overrides
      .filter((o) => !o.businessId)
      .map((o) => ({ businessId: null, partnerId: o.id, name: o.name, sort: o.sort, hidden: o.hidden, hasLogo: Boolean(o.logoKey), hasBusinessLogo: false, custom: true })),
  ].sort((a, b) => a.sort - b.sort);
  return { settings, partners, deals: deals.map((d) => ({ id: d.id, title: d.title, business: d.business.name })) };
}

const partnerInput = z.object({ sort: z.number().int().min(-1000).max(1000), hidden: z.boolean(), name: z.string().trim().min(1).max(60).optional() });

/**
 * Hamkor qatori: biznes bo'yicha (birinchi o'zgarishda yaratiladi) yoki qo'lda qo'shilgan (`partnerId`). Tartib, yashirish
 * va (qo'lda qo'shilganda) nom.
 */
export async function savePartner(actorId: string, target: { businessId: string } | { partnerId: string }, raw: unknown): Promise<LandingAdminResult> {
  const parsed = partnerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid", fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
  const { sort, hidden, name } = parsed.data;
  if ("businessId" in target) {
    const business = await db.business.findUnique({ where: { id: target.businessId }, select: { id: true, name: true } });
    if (!business) return { ok: false, error: "notFound" };
    const before = await db.landingPartner.findUnique({ where: { businessId: business.id } });
    const row = await db.$transaction(async (tx) => {
      const row = await tx.landingPartner.upsert({ where: { businessId: business.id }, create: { businessId: business.id, name: business.name, sort, hidden }, update: { sort, hidden } });
      await audit({ actorId, action: "landing.partner", entity: "Business", entityId: business.id, meta: { changed: { sort: [before?.sort ?? 0, sort], hidden: [before?.hidden ?? false, hidden] } } }, tx);
      return row;
    });
    return { ok: true, id: row.id };
  }
  const before = await db.landingPartner.findUnique({ where: { id: target.partnerId } });
  if (!before) return { ok: false, error: "notFound" };
  await db.$transaction(async (tx) => {
    await tx.landingPartner.update({ where: { id: before.id }, data: { sort, hidden, ...(name && !before.businessId ? { name } : {}) } });
    await audit({ actorId, action: "landing.partner", entity: "LandingPartner", entityId: before.id, meta: { changed: { sort: [before.sort, sort], hidden: [before.hidden, hidden], ...(name && name !== before.name ? { name: [before.name, name] } : {}) } } }, tx);
  });
  return { ok: true, id: before.id };
}

/** Qo'lda hamkor (bizneslar ro'yxatida yo'q brend): nom, oxirida */
export async function addCustomPartner(actorId: string, nameRaw: unknown): Promise<LandingAdminResult> {
  const name = z.string().trim().min(1).max(60).safeParse(nameRaw);
  if (!name.success) return { ok: false, error: "invalid", fields: ["name"] };
  const last = await db.landingPartner.aggregate({ _max: { sort: true } });
  const row = await db.$transaction(async (tx) => {
    const row = await tx.landingPartner.create({ data: { name: name.data, sort: (last._max.sort ?? 0) + 1 } });
    await audit({ actorId, action: "landing.partner.add", entity: "LandingPartner", entityId: row.id, meta: { name: name.data } }, tx);
    return row;
  });
  return { ok: true, id: row.id };
}

/** Qo'lda qo'shilgan hamkorni o'chirish (biznes qatori o'chirilmaydi — yashiriladi) */
export async function deleteCustomPartner(actorId: string, partnerId: string): Promise<LandingAdminResult> {
  const row = await db.landingPartner.findUnique({ where: { id: partnerId } });
  if (!row || row.businessId) return { ok: false, error: "notFound" };
  await db.$transaction(async (tx) => {
    await tx.landingPartner.delete({ where: { id: row.id } });
    await audit({ actorId, action: "landing.partner.delete", entity: "LandingPartner", entityId: row.id, meta: { name: row.name } }, tx);
  });
  if (row.logoKey) await storage().delete(row.logoKey).catch(() => undefined);
  return { ok: true };
}

/** Hamkor logotipi (landing uchun, biznes logotipidan ustun): rasm tozalanadi, private omborda */
export async function setPartnerLogo(actorId: string, target: { businessId: string } | { partnerId: string }, bytes: Uint8Array): Promise<LandingAdminResult> {
  const checked = checkUpload(bytes);
  if (!checked.ok || checked.type.ext === "pdf") return { ok: false, error: "badFile" };
  let clean;
  try {
    clean = await sanitizeDocument(bytes, checked.type);
  } catch (error) {
    if (error instanceof UnreadableFileError) return { ok: false, error: "badFile" };
    throw error;
  }
  let row = "businessId" in target ? await db.landingPartner.findUnique({ where: { businessId: target.businessId } }) : await db.landingPartner.findUnique({ where: { id: target.partnerId } });
  if (!row && "businessId" in target) {
    const business = await db.business.findUnique({ where: { id: target.businessId }, select: { id: true, name: true } });
    if (!business) return { ok: false, error: "notFound" };
    row = await db.landingPartner.create({ data: { businessId: business.id, name: business.name } });
  }
  if (!row) return { ok: false, error: "notFound" };
  const key = `landing/${randomUUID()}.${clean.ext}`;
  await storage().put(key, clean.bytes);
  await db.$transaction(async (tx) => {
    await tx.landingPartner.update({ where: { id: row.id }, data: { logoKey: key } });
    await audit({ actorId, action: "landing.partner.logo", entity: "LandingPartner", entityId: row.id }, tx);
  });
  if (row.logoKey) await storage().delete(row.logoKey).catch(() => undefined);
  return { ok: true, id: row.id };
}

export async function removePartnerLogo(actorId: string, partnerId: string): Promise<LandingAdminResult> {
  const row = await db.landingPartner.findUnique({ where: { id: partnerId } });
  if (!row) return { ok: false, error: "notFound" };
  if (!row.logoKey) return { ok: true };
  await db.$transaction(async (tx) => {
    await tx.landingPartner.update({ where: { id: row.id }, data: { logoKey: null } });
    await audit({ actorId, action: "landing.partner.logo.remove", entity: "LandingPartner", entityId: row.id }, tx);
  });
  await storage().delete(row.logoKey).catch(() => undefined);
  return { ok: true };
}

/** Landing'dagi hamkor logotipi — hammaga ochiq, faqat yashirilmagan qator (aks holda null → 404) */
export async function readPartnerLogo(partnerId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const row = await db.landingPartner.findUnique({ where: { id: partnerId }, select: { logoKey: true, hidden: true } });
  if (!row?.logoKey || row.hidden) return null;
  const bytes = await storage().get(row.logoKey);
  return bytes ? { bytes, mime: row.logoKey.endsWith(".png") ? "image/png" : "image/jpeg" } : null;
}
