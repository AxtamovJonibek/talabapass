import "server-only";
import { validateBusiness, validateContacts, type BusinessField, type ContactField } from "@/lib/business";
import { audit } from "../audit";
import { db } from "../db";
import { districtFromAddress } from "./registration";

/** Aloqa maydonlari (`phone`, `telegram`, `instagram`) ixtiyoriy: berilmasa — o'zgarmaydi; bo'sh qator — o'chiradi. */
export type EditableInfo = { name: string; address: string; workingHours: string; description: string; phone?: string; telegram?: string; instagram?: string };
export const EDIT_FIELDS = ["name", "address", "workingHours", "description"] as const satisfies readonly BusinessField[];

export type EditResult = { ok: true; rereview: boolean } | { ok: false; fields: (BusinessField | ContactField)[] } | { ok: false; error: "notEditable" };

const clean = (v: string) => v.trim().replace(/\s+/g, " ");

/**
 * Tasdiqlangan (yoki tekshiruvdagi) biznes ma'lumotlarini tahrirlash. Nom yoki manzil o'zgarsa — biznes qayta
 * tekshiruvga tushadi (talabaga ko'rinmay qoladi); ish vaqti va tavsif — tekshiruvsiz. Rad etilgan/bloklangan
 * biznes bu yo'l bilan tahrirlanmaydi (rad etilgan — ariza formasi, bloklangan — admin).
 * Talabalarga ko'rinadigan aloqa (telefon, Telegram, Instagram) ham tekshiruvsiz o'zgaradi.
 */
export async function editBusinessInfo(ownerId: string, input: EditableInfo): Promise<EditResult> {
  const info = { name: clean(input.name), address: clean(input.address), workingHours: clean(input.workingHours), description: input.description.trim() };
  const fields = validateBusiness({ ...info, kind: "CAFE", tin: "000000000", contactName: "Ali" }, EDIT_FIELDS);
  const contactsGiven = input.phone !== undefined || input.telegram !== undefined || input.instagram !== undefined;
  const contacts = contactsGiven ? validateContacts({ phone: input.phone ?? "", telegram: input.telegram ?? "", instagram: input.instagram ?? "" }) : null;
  const contactFields = contacts && !contacts.ok ? contacts.fields : [];
  if (fields.length > 0 || contactFields.length > 0) return { ok: false, fields: [...fields, ...contactFields] };

  const business = await db.business.findFirst({
    where: { ownerId, submittedAt: { not: null }, status: { in: ["APPROVED", "WARNED", "PENDING"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!business) return { ok: false, error: "notEditable" };

  const identityChanged = info.name !== business.name || info.address !== business.address;
  const rereview = identityChanged && (business.status === "APPROVED" || business.status === "WARNED");
  const changed = EDIT_FIELDS.filter((f) => (f === "description" ? info.description : info[f]) !== (f === "description" ? (business.description ?? "") : business[f]));
  const newContacts = contacts?.ok ? contacts.value : null;
  const contactChanged = newContacts
    ? (["phone", "telegram", "instagram"] as const).filter((f) => newContacts[f] !== (f === "phone" ? business.publicPhone : business[f]))
    : [];
  if (changed.length === 0 && contactChanged.length === 0) return { ok: true, rereview: false };

  const districtId = info.address !== business.address ? await districtFromAddress(info.address) : business.districtId;
  await db.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: business.id },
      data: {
        ...info,
        description: info.description || null,
        districtId,
        ...(newContacts ? { publicPhone: newContacts.phone, telegram: newContacts.telegram, instagram: newContacts.instagram } : {}),
        ...(rereview ? { status: "PENDING" as const, rejectReason: null } : {}),
      },
    });
    await audit({ actorId: ownerId, action: "business.edit", entity: "Business", entityId: business.id, meta: { changed: [...changed, ...contactChanged], rereview } }, tx);
  });
  return { ok: true, rereview };
}

export const editableInfo = (ownerId: string) =>
  db.business.findFirst({
    where: { ownerId, submittedAt: { not: null }, status: { in: ["APPROVED", "WARNED", "PENDING"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, logoKey: true, name: true, address: true, workingHours: true, description: true, status: true, publicPhone: true, telegram: true, instagram: true },
  });
