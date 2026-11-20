import "server-only";
import type { BusinessKind, BusinessStatus, Prisma } from "@/generated/prisma/client";
import { canChangeField, changeText, CONTACT_FIELDS, IDENTITY_FIELDS, type BusinessFieldKey, type ChangeRole } from "@/lib/business-fields";
import { audit } from "../audit";
import { db } from "../db";
import { isUniqueViolation } from "../db-errors";
import { permissionsOf } from "./permissions";
import { districtFromAddress } from "./registration";

type Tx = Prisma.TransactionClient;

/** O'zgartirilishi mumkin bo'lgan qiymatlar (kalit — `BUSINESS_FIELD_ACCESS` dagi maydon) */
export type BusinessChanges = Partial<{
  name: string;
  address: string;
  workingHours: string;
  description: string | null;
  landmark: string | null;
  publicPhone: string | null;
  telegram: string | null;
  instagram: string | null;
  legalName: string | null;
  tin: string | null;
  kind: BusinessKind;
  typeLabel: string | null;
  lat: number | null;
  lng: number | null;
  contactName: string;
  contactPhone: string | null;
  logoKey: string | null;
  status: BusinessStatus;
}>;

export type ChangeActor = { id: string; role: ChangeRole };

export type ChangeResult =
  | { ok: true; changed: string[]; rereview: boolean }
  | { ok: false; error: "notFound" | "forbidden" | "noPermission" | "tinInUse"; fields?: string[] };

/** Jurnalga: rasm kalitlari o'rniga "rasm" belgisi (fayl yo'li ko'rsatilmaydi) */
const shown = (field: string, value: unknown) => (field === "logoKey" ? (value ? "rasm" : null) : changeText(value));

/** Jurnal yozuvi (o'zgarish jurnali): `changeBusiness` va holat/rasm amallari shu orqali yozadi. */
export async function logBusinessChange(tx: Pick<Tx, "businessChange">, entry: { businessId: string; actor: ChangeActor; field: string; oldValue: unknown; newValue: unknown }): Promise<void> {
  await tx.businessChange.create({
    data: { businessId: entry.businessId, actorId: entry.actor.id, actorRole: entry.actor.role, field: entry.field, oldValue: shown(entry.field, entry.oldValue), newValue: shown(entry.field, entry.newValue) },
  });
}

/**
 * Biznes ma'lumotini o'zgartirishning YAGONA joyi (admin kartasi, ega profili — sayt va `/api/v1`, logotip).
 * Maydon ruxsatlari `BUSINESS_FIELD_ACCESS` jadvalida: ruxsatsiz maydon bo'lsa hech narsa yozilmaydi (`forbidden`).
 * Ega: admin cheklovlari (`canEditProfile`/`canEditContacts`) tekshiriladi; nom yoki manzil o'zgarsa tasdiqlangan biznes
 * qayta tekshiruvga tushadi. Har o'zgargan maydon `BusinessChange` ga (kim, oldin → keyin) va `AuditLog` ga yoziladi.
 * O'zgarish bo'lmasa — hech narsa yozilmaydi. `tx` berilsa — chaqiruvchi tranzaksiyasida bajariladi.
 */
export async function changeBusiness(input: { actor: ChangeActor; businessId: string; changes: BusinessChanges }, tx?: Tx): Promise<ChangeResult> {
  if (!tx) {
    try {
      return await db.$transaction((t) => changeBusiness(input, t));
    } catch (error) {
      if (isUniqueViolation(error, "tin")) return { ok: false, error: "tinInUse", fields: ["tin"] };
      throw error;
    }
  }
  const { actor, businessId } = input;
  const keys = Object.keys(input.changes) as BusinessFieldKey[];
  const denied = keys.filter((k) => !canChangeField(actor.role, k));
  if (denied.length > 0) return { ok: false, error: "forbidden", fields: denied };

  const business = await tx.business.findUnique({ where: { id: businessId } });
  if (!business) return { ok: false, error: "notFound" };

  const before = business as unknown as Record<string, unknown>;
  const changes = input.changes as Record<string, unknown>;
  const diff = keys.filter((k) => shown(k, changes[k]) !== shown(k, before[k]));
  if (diff.length === 0) return { ok: true, changed: [], rereview: false };

  if (actor.role === "OWNER") {
    const permissions = await permissionsOf(businessId, tx);
    const contacts = diff.filter((k) => CONTACT_FIELDS.includes(k));
    const rest = diff.filter((k) => !CONTACT_FIELDS.includes(k));
    if ((rest.length > 0 && !permissions.canEditProfile) || (contacts.length > 0 && !permissions.canEditContacts)) return { ok: false, error: "noPermission" };
  }

  const rereview = actor.role === "OWNER" && diff.some((k) => IDENTITY_FIELDS.includes(k)) && (business.status === "APPROVED" || business.status === "WARNED");
  const data: Record<string, unknown> = {};
  for (const k of diff) data[k] = changes[k];
  if (diff.includes("address")) data.districtId = await districtFromAddress(String(changes.address), tx);
  if (rereview) Object.assign(data, { status: "PENDING", rejectReason: null });

  await tx.business.update({ where: { id: businessId }, data: data as Prisma.BusinessUncheckedUpdateInput });
  for (const k of diff) await logBusinessChange(tx, { businessId, actor, field: k, oldValue: before[k], newValue: changes[k] });
  if (rereview) await logBusinessChange(tx, { businessId, actor, field: "status", oldValue: business.status, newValue: "PENDING" });

  const meta =
    actor.role === "ADMIN"
      ? { changed: Object.fromEntries(diff.map((k) => [k, [shown(k, before[k]), shown(k, changes[k])]])) as Prisma.InputJsonObject }
      : { changed: diff.filter((k) => k !== "logoKey"), rereview };
  // Logotip alohida audit amallari bilan yoziladi (chaqiruvchi); boshqa maydonlar — umumiy tahrir amali
  if (diff.some((k) => k !== "logoKey" && k !== "status")) {
    await audit({ actorId: actor.id, action: actor.role === "ADMIN" ? "business.edit.admin" : "business.edit", entity: "Business", entityId: businessId, meta }, tx);
  }
  return { ok: true, changed: diff, rereview };
}
