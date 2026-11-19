/**
 * Ilovadagi biznes arizasi: bitta ekran, 5 ta maydon (nom, manzil, STIR, telefon, Telegram). Forma va server bir xil funksiyani
 * ishlatadi. Boshqa ma'lumotlarni (kategoriya, ish vaqti, joylashuv) tasdiqlashda admin to'ldiradi.
 */

import { normalizeHandle, normalizeTin } from "./business";
import { normalizePhone } from "./format";

export type QuickApplicationInput = { name: string; address: string; tin: string; phone: string; telegram: string };
export type QuickApplication = { name: string; address: string; tin: string; phone: string; telegram: string };
export type QuickField = keyof QuickApplicationInput;

const length = (s: string, min: number, max: number) => s.trim().length >= min && s.trim().length <= max;

/** Tozalangan ariza yoki xato maydonlar ro'yxati. Telefon va Telegram majburiy. */
export function validateQuickApplication(d: QuickApplicationInput): { ok: true; value: QuickApplication } | { ok: false; fields: QuickField[] } {
  const tin = normalizeTin(d.tin);
  const phone = normalizePhone(d.phone.trim());
  const telegram = normalizeHandle("telegram", d.telegram);
  const fields: QuickField[] = [];
  if (!length(d.name, 2, 60)) fields.push("name");
  if (!length(d.address, 5, 160)) fields.push("address");
  if (!tin) fields.push("tin");
  if (!phone) fields.push("phone");
  if (!telegram) fields.push("telegram");
  if (fields.length > 0 || !tin || !phone || !telegram) return { ok: false, fields };
  return { ok: true, value: { name: d.name.trim().replace(/\s+/g, " "), address: d.address.trim().replace(/\s+/g, " "), tin, phone, telegram } };
}
