/**
 * Biznes ma'lumotlarini kim o'zgartira oladi (server `changeBusiness` va admin kartasi uchun bitta jadval).
 * "admin" — faqat admin; "both" — admin ham, ega ham.
 */
export const BUSINESS_FIELD_ACCESS = {
  tin: "admin",
  kind: "admin",
  lat: "admin",
  lng: "admin",
  status: "admin",
  legalName: "admin",
  typeLabel: "admin",
  contactName: "admin",
  contactPhone: "admin",
  name: "both",
  publicPhone: "both",
  telegram: "both",
  instagram: "both",
  description: "both",
  logoKey: "both",
  address: "both",
  workingHours: "both",
  landmark: "both",
} as const;

export type BusinessFieldKey = keyof typeof BUSINESS_FIELD_ACCESS;
export type ChangeRole = "ADMIN" | "OWNER";

export const canChangeField = (role: ChangeRole, field: string): field is BusinessFieldKey => {
  const access = (BUSINESS_FIELD_ACCESS as Record<string, "admin" | "both" | undefined>)[field];
  return access === "both" || (access === "admin" && role === "ADMIN");
};

/** Ega talabaga ko'rinadigan aloqa maydonlari — admin ruxsati (`canEditContacts`) alohida */
export const CONTACT_FIELDS: readonly BusinessFieldKey[] = ["publicPhone", "telegram", "instagram"];
/** Nom yoki manzil o'zgarsa tasdiqlangan biznes qayta tekshiruvga tushadi (egasi o'zgartirsa) */
export const IDENTITY_FIELDS: readonly BusinessFieldKey[] = ["name", "address"];

/** Tasdiqlashdan oldin to'liq bo'lishi shart: kategoriya, ish vaqti, joylashuv. */
export type ApprovalGap = "kind" | "workingHours" | "location";
export function approvalGaps(b: { kind: string | null; workingHours: string; lat: number | null; lng: number | null }): ApprovalGap[] {
  const gaps: ApprovalGap[] = [];
  if (!b.kind) gaps.push("kind");
  if (!b.workingHours.trim()) gaps.push("workingHours");
  if (b.lat === null || b.lng === null) gaps.push("location");
  return gaps;
}

/** Jurnalga yoziladigan qiymat: bo'sh → null; sonlar/matn — matn */
export const changeText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
