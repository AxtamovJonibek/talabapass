/**
 * Biznes arizasi qoidalari — forma (brauzer) va server bir xil funksiyani ishlatadi (B1, WB1).
 * Server baribir qayta tekshiradi; STIR yagonaligi faqat serverda (bazada unique).
 */

import { normalizePhone } from "./format";

export const BUSINESS_KINDS = ["CAFE", "SHOP", "SERVICE", "SPORT", "BEAUTY", "EDUCATION", "ENTERTAINMENT"] as const;
export type BusinessKindValue = (typeof BUSINESS_KINDS)[number];

export const DESCRIPTION_MAX = 120;
/** Joy fotolari: peshtaxta, zal, kassa */
export const PHOTOS_MAX = 3;

export type BusinessInfo = {
  name: string;
  kind: string;
  address: string;
  workingHours: string;
  description: string;
  /** STIR (INN) — bo'sh joylar bilan yozilishi mumkin: "307 482 915" */
  tin: string;
  contactName: string;
};

export type BusinessField = keyof BusinessInfo;
/** 1-qadam maydonlari (veb). Telefonda STIR ham 1-qadamda (B1). */
export const INFO_FIELDS = ["name", "kind", "address", "workingHours", "description"] as const satisfies readonly BusinessField[];

const PERSON = /^[\p{L}][\p{L}'ʻʼ’` .-]{1,59}$/u;
const length = (s: string, min: number, max: number) => s.trim().length >= min && s.trim().length <= max;

/** "307 482 915" → "307482915"; 9 raqam bo'lmasa null */
export function normalizeTin(value: string): string | null {
  const digits = value.replace(/[\s-]/g, "");
  return /^\d{9}$/.test(digits) ? digits : null;
}

/** "307482915" → "307 482 915" */
export const formatTin = (tin: string) => tin.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3");

/** Xato maydonlar ro'yxati (bo'sh — hammasi to'g'ri). `only` berilsa — faqat shu maydonlar tekshiriladi. */
export function validateBusiness(d: BusinessInfo, only?: readonly BusinessField[]): BusinessField[] {
  const checks: Record<BusinessField, boolean> = {
    name: length(d.name, 2, 60),
    kind: (BUSINESS_KINDS as readonly string[]).includes(d.kind),
    address: length(d.address, 5, 160),
    workingHours: length(d.workingHours, 3, 60),
    description: d.description.trim().length <= DESCRIPTION_MAX,
    tin: normalizeTin(d.tin) !== null,
    contactName: PERSON.test(d.contactName.trim()),
  };
  return (only ?? (Object.keys(checks) as BusinessField[])).filter((field) => !checks[field]);
}

// ───────── talabaga ko'rinadigan aloqa (ixtiyoriy maydonlar) ─────────

export type ContactField = "phone" | "telegram" | "instagram";
export type ContactInput = Record<ContactField, string>;
export type Contacts = { phone: string | null; telegram: string | null; instagram: string | null };

const HANDLE: Record<"telegram" | "instagram", { host: RegExp; valid: RegExp }> = {
  telegram: { host: /^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, valid: /^[A-Za-z][A-Za-z0-9_]{4,31}$/ },
  instagram: { host: /^(https?:\/\/)?(www\.)?instagram\.com\//i, valid: /^(?!.*\.\.)[A-Za-z0-9._]{1,30}$/ },
};

/** "@nom", "t.me/nom", "https://instagram.com/nom/" → "nom"; bo'sh → null; noto'g'ri → undefined. */
export function normalizeHandle(kind: "telegram" | "instagram", value: string): string | null | undefined {
  const raw = value.trim();
  if (!raw) return null;
  const handle = raw.replace(HANDLE[kind].host, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return HANDLE[kind].valid.test(handle) ? handle : undefined;
}

/** Aloqa maydonlarini tekshiradi va tozalaydi: bo'sh maydon — null (ko'rsatilmaydi). */
export function validateContacts(input: ContactInput): { ok: true; value: Contacts } | { ok: false; fields: ContactField[] } {
  const phoneRaw = input.phone.trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  const telegram = normalizeHandle("telegram", input.telegram);
  const instagram = normalizeHandle("instagram", input.instagram);
  const fields: ContactField[] = [];
  if (phoneRaw && !phone) fields.push("phone");
  if (telegram === undefined) fields.push("telegram");
  if (instagram === undefined) fields.push("instagram");
  return fields.length ? { ok: false, fields } : { ok: true, value: { phone, telegram: telegram ?? null, instagram: instagram ?? null } };
}

export const telegramUrl = (handle: string) => `https://t.me/${handle}`;
export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`;
