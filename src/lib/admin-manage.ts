import { z } from "zod";
import { BUSINESS_KINDS, normalizeHandle, normalizeTin } from "./business";
import { normalizePhone } from "./format";
import { COURSES, NAME } from "./profile";

/**
 * Admin tahrir formalari (foydalanuvchi, biznes, universitet, admin): forma va server bir xil sxemadan foydalanadi.
 * Bo'sh qator — qiymat yo'q (null). Xato maydon nomi `path[0]` bo'yicha qaytadi.
 */

const blank = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) ctx.addIssue({ code: "custom", message: "phone" });
    return normalized ?? "";
  });

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const normalized = normalizePhone(v);
    if (!normalized) ctx.addIssue({ code: "custom", message: "phone" });
    return normalized;
  });

const handle = (kind: "telegram" | "instagram") =>
  z.string().transform((v, ctx) => {
    const result = normalizeHandle(kind, v);
    if (result === undefined) ctx.addIssue({ code: "custom", message: kind });
    return result ?? null;
  });

const date = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
    if (!ok) ctx.addIssue({ code: "custom", message: "date" });
    return v;
  });

export const adminNameSchema = z.object({ firstName: z.string().trim().regex(NAME), lastName: z.string().trim().regex(NAME) });

export const newAdminSchema = adminNameSchema.extend({ phone });

/** Foydalanuvchining umumiy maydonlari (talaba, biznes egasi, kassir). */
export const userEditSchema = adminNameSchema.extend({ phone });

export const studentEditSchema = z.object({
  course: z.enum(COURSES),
  faculty: blank(80),
  universityId: z.string().trim().min(1).max(40),
  districtId: blank(40),
  cardNumber: blank(30),
  cardExpiresAt: date,
});

export const businessEditSchema = z.object({
  name: z.string().trim().min(2).max(60),
  legalName: blank(120),
  tin: z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const tin = normalizeTin(v);
    if (!tin) ctx.addIssue({ code: "custom", message: "tin" });
    return tin;
  }),
  kind: z.enum(BUSINESS_KINDS),
  typeLabel: blank(40),
  address: z.string().trim().min(5).max(160),
  landmark: blank(80),
  workingHours: z.string().trim().min(3).max(60),
  description: blank(120),
  contactName: z.string().trim().min(2).max(60),
  contactPhone: optionalPhone,
  publicPhone: optionalPhone,
  telegram: handle("telegram"),
  instagram: handle("instagram"),
});

export const universityEditSchema = z.object({
  name: z.string().trim().min(3).max(160),
  /** Bo'sh bo'lsa nomdan bosh harflar olinadi (`shortNameFor`) */
  shortName: z.string().trim().max(24),
  region: z.string().trim().min(2).max(60),
  kind: z.enum(["STATE", "PRIVATE", "FOREIGN"]),
  active: z.boolean(),
});

/** Zod xatosidan maydon nomlari (takrorsiz). */
export const failedFields = (error: z.ZodError): string[] => [...new Set(error.issues.map((i) => String(i.path[0])))];

/** O'zgargan maydonlar: {maydon: [oldin, keyin]} — audit uchun. */
export function diffOf(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after)) {
    const a = before[key] instanceof Date ? (before[key] as Date).toISOString().slice(0, 10) : (before[key] ?? null);
    const b = after[key] ?? null;
    if (a !== b) out[key] = [a, b];
  }
  return out;
}
