import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "../audit";
import { db } from "../db";

/**
 * Admin biznes kartasi (A2 / `/admin/bizneslar`): ro'yxat (qidiruv, holat filtri), aloqa qaydlari va o'zgarishlar jurnali.
 * Chaqiruvchi allaqachon `requireRole("ADMIN")` qilgan.
 */

// ───────── ro'yxat ─────────

export const LIST_STATUSES = ["pending", "approved", "rejected", "blocked"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];
export const LIST_PAGE = 25;

const STATUS_WHERE: Record<ListStatus, Prisma.BusinessWhereInput> = {
  pending: { status: "PENDING" },
  approved: { status: { in: ["APPROVED", "WARNED"] } },
  rejected: { status: "REJECTED" },
  blocked: { status: "BLOCKED" },
};

export const isListStatus = (v: unknown): v is ListStatus => typeof v === "string" && (LIST_STATUSES as readonly string[]).includes(v);

/** Qidiruv: nom, STIR yoki telefon (raqamlar bo'yicha — "+998 90 123" ham, "90123" ham topadi). */
export function searchWhere(q: string): Prisma.BusinessWhereInput | null {
  const term = q.trim();
  if (!term) return null;
  const digits = term.replace(/\D/g, "");
  const or: Prisma.BusinessWhereInput[] = [{ name: { contains: term, mode: "insensitive" } }];
  if (digits.length >= 3) {
    or.push({ tin: { contains: digits } }, { contactPhone: { contains: digits } }, { publicPhone: { contains: digits } }, { owner: { phone: { contains: digits } } });
  }
  return { OR: or };
}

export async function businessList(input: { q?: string; status?: ListStatus | null; page?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.BusinessWhereInput = { AND: [input.status ? STATUS_WHERE[input.status] : {}, searchWhere(input.q ?? "") ?? {}] };
  const [items, total, counts] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (page - 1) * LIST_PAGE,
      take: LIST_PAGE,
      select: { id: true, name: true, status: true, contactPhone: true, publicPhone: true, submittedAt: true, createdAt: true, owner: { select: { phone: true } } },
    }),
    db.business.count({ where }),
    db.business.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (...s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((n, c) => n + c._count._all, 0);
  return { items, total, pages: Math.max(1, Math.ceil(total / LIST_PAGE)), page, counts: { pending: count("PENDING"), approved: count("APPROVED", "WARNED"), rejected: count("REJECTED"), blocked: count("BLOCKED") } };
}

// ───────── aloqa qaydlari ─────────

export const contactNoteSchema = z.object({
  businessId: z.string().min(1).max(40),
  contacted: z.boolean(),
  /** YYYY-MM-DD (Toshkent kuni) */
  contactedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(1000),
});

export type NoteResult = { ok: true } | { ok: false; error: "invalid" | "notFound" | "empty" };

/** Qayd: "Bog'lanildi" belgisi, sana, ichki izoh (egasi ko'rmaydi). Belgisiz va izohsiz qayd — bo'sh (rad). */
export async function addContactNote(adminId: string, raw: unknown): Promise<NoteResult> {
  const parsed = contactNoteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { businessId, contacted, contactedAt, note } = parsed.data;
  const date = new Date(`${contactedAt}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "invalid" };
  if (!contacted && note === "") return { ok: false, error: "empty" };
  if (!(await db.business.findUnique({ where: { id: businessId }, select: { id: true } }))) return { ok: false, error: "notFound" };
  await db.$transaction(async (tx) => {
    const created = await tx.businessContactNote.create({ data: { businessId, adminId, contacted, contactedAt: date, note }, select: { id: true } });
    await audit({ actorId: adminId, action: "business.contact", entity: "Business", entityId: businessId, meta: { noteId: created.id, contacted } }, tx);
  });
  return { ok: true };
}

const namesOf = async (ids: (string | null)[]) => {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ")]));
};

export async function contactNotes(businessId: string) {
  const notes = await db.businessContactNote.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 100 });
  const name = await namesOf(notes.map((n) => n.adminId));
  return notes.map((n) => ({ id: n.id, contacted: n.contacted, contactedAt: n.contactedAt, note: n.note, createdAt: n.createdAt, admin: (n.adminId && name.get(n.adminId)) || null }));
}

// ───────── o'zgarishlar jurnali ─────────

export async function businessChanges(businessId: string) {
  const rows = await db.businessChange.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 200 });
  const name = await namesOf(rows.map((r) => r.actorId));
  return rows.map((r) => ({ id: r.id, role: r.actorRole as "ADMIN" | "OWNER", actor: (r.actorId && name.get(r.actorId)) || null, field: r.field, oldValue: r.oldValue, newValue: r.newValue, createdAt: r.createdAt }));
}
