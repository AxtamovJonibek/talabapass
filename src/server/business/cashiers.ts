import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { toTashkent, fromTashkent } from "@/lib/time";
import { audit } from "../audit";
import { db } from "../db";

/** Taklif havolasi 48 soat amal qiladi va bir marta ishlatiladi. */
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
/** Bir biznesda bir vaqtda ochiq takliflar (spamga qarshi). */
export const OPEN_INVITES_MAX = 10;
/** Oxirgi skan shuncha daqiqa ichida bo'lsa — "Smenada". */
const ON_SHIFT_MINUTES = 60;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const LIVE_BUSINESS = { status: { in: ["APPROVED" as const, "WARNED" as const] } };

/**
 * Kassirning biznesi: faqat faol a'zolik va bloklanmagan biznes. Kassir faqat shu biznesni ko'radi —
 * kassirga tegishli har bir so'rov biznesni shu yerdan oladi (so'rovdagi id ga ishonilmaydi).
 */
export async function cashierBusiness(userId: string) {
  const member = await db.businessMember.findFirst({
    where: { userId, role: "CASHIER", active: true, business: { status: { not: "BLOCKED" } } },
    select: { business: { select: { id: true, name: true } } },
  });
  return member?.business ?? null;
}

async function ownerLiveBusiness(ownerId: string) {
  return db.business.findFirst({ where: { ownerId, ...LIVE_BUSINESS }, select: { id: true, name: true } });
}

export type CreateInviteResult = { ok: true; token: string; expiresAt: Date } | { ok: false; error: "notApproved" | "tooMany" };

/** Yangi taklif: tasodifiy token (bazada faqat xeshi). Faqat tasdiqlangan biznes kassir qo'sha oladi. */
export async function createInvite(ownerId: string, now = new Date()): Promise<CreateInviteResult> {
  const business = await ownerLiveBusiness(ownerId);
  if (!business) return { ok: false, error: "notApproved" };
  const open = await db.cashierInvite.count({ where: { businessId: business.id, acceptedAt: null, expiresAt: { gt: now } } });
  if (open >= OPEN_INVITES_MAX) return { ok: false, error: "tooMany" };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  const invite = await db.cashierInvite.create({ data: { businessId: business.id, tokenHash: hashToken(token), expiresAt }, select: { id: true } });
  await audit({ actorId: ownerId, action: "cashier.invite", entity: "CashierInvite", entityId: invite.id });
  return { ok: true, token, expiresAt };
}

/** Ochiq taklifni bekor qilish (havolani yuborib bo'lgandan keyin fikr o'zgarsa). */
export async function revokeInvite(ownerId: string, inviteId: string): Promise<boolean> {
  const deleted = await db.cashierInvite.deleteMany({ where: { id: inviteId, acceptedAt: null, business: { ownerId } } });
  return deleted.count === 1;
}

/** Havola ochilganda: amal qiladigan taklif bo'lsa — biznes nomi. Ishlatilgan/eskirgan — null. */
export async function inviteByToken(token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const invite = await db.cashierInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, acceptedAt: true, expiresAt: true, business: { select: { name: true, status: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt <= now || !["APPROVED", "WARNED"].includes(invite.business.status)) return null;
  return { id: invite.id, businessName: invite.business.name };
}

export type AcceptError = "invalid" | "phoneInUse" | "otherBusiness" | "blocked";

/**
 * Taklifni qabul qilish (raqam SMS bilan tasdiqlangandan keyin). Bir tranzaksiyada: taklif "ishlatildi" deb
 * belgilanadi (faqat bir marta — `acceptedAt IS NULL` sharti bilan), kassir hisobi va a'zoligi yaratiladi.
 * Bitta raqam — bitta rol; kassir bir vaqtda faqat bitta biznesda.
 */
export async function acceptInvite(
  token: string,
  phone: string,
  name: { firstName: string; lastName: string },
  now = new Date(),
): Promise<{ ok: true; userId: string } | { ok: false; error: AcceptError }> {
  const invite = await inviteByToken(token, now);
  if (!invite) return { ok: false, error: "invalid" };

  return db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { phone },
      select: { id: true, role: true, status: true, memberships: { where: { active: true }, select: { businessId: true } } },
    });
    if (existing && existing.status !== "ACTIVE") return { ok: false as const, error: "blocked" as const };
    if (existing && existing.role !== "CASHIER") return { ok: false as const, error: "phoneInUse" as const };

    const full = await tx.cashierInvite.findUniqueOrThrow({ where: { id: invite.id }, select: { businessId: true } });
    if (existing?.memberships.some((m) => m.businessId !== full.businessId)) return { ok: false as const, error: "otherBusiness" as const };

    const user = existing ?? (await tx.user.create({ data: { phone, role: "CASHIER", firstName: name.firstName, lastName: name.lastName }, select: { id: true } }));
    const claimed = await tx.cashierInvite.updateMany({
      where: { id: invite.id, acceptedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedById: user.id },
    });
    // Parallel qabul: ikkinchisi hech narsa o'zgartirmaydi va tranzaksiya bekor qilinadi
    if (claimed.count !== 1) throw new InviteTakenError();

    await tx.businessMember.upsert({
      where: { businessId_userId: { businessId: full.businessId, userId: user.id } },
      create: { businessId: full.businessId, userId: user.id, role: "CASHIER" },
      update: { active: true },
    });
    await audit({ actorId: user.id, action: "cashier.accept", entity: "Business", entityId: full.businessId }, tx);
    return { ok: true as const, userId: user.id };
  }).catch((error: unknown) => {
    if (error instanceof InviteTakenError) return { ok: false as const, error: "invalid" as const };
    throw error;
  });
}

class InviteTakenError extends Error {}

/**
 * Egasi kassirni o'chiradi: a'zolik nofaol bo'ladi va kassirning barcha sessiyalari darhol yopiladi
 * (skaner ochiq turgan telefonda ham keyingi so'rovdayoq chiqib ketadi).
 */
export async function removeCashier(ownerId: string, memberId: string): Promise<boolean> {
  const member = await db.businessMember.findFirst({
    where: { id: memberId, role: "CASHIER", active: true, business: { ownerId } },
    select: { id: true, userId: true, businessId: true },
  });
  if (!member) return false;
  await db.$transaction(async (tx) => {
    await tx.businessMember.update({ where: { id: member.id }, data: { active: false } });
    await tx.session.deleteMany({ where: { userId: member.userId } });
    await audit({ actorId: ownerId, action: "cashier.remove", entity: "Business", entityId: member.businessId, meta: { cashier: member.userId } }, tx);
  });
  // Tranzaksiyadan tashqarida ham — boshqa jarayonda shu payt yaratilgan sessiya qolmasin
  await db.session.deleteMany({ where: { userId: member.userId } });
  return true;
}

/** B5 kassirlar bloki: faol kassirlar (bugungi skanlar, smenada-yo'qligi) va ochiq takliflar. */
export async function ownerCashiers(ownerId: string, now = new Date()) {
  const business = await db.business.findFirst({ where: { ownerId }, select: { id: true, status: true } });
  if (!business) return { canInvite: false, cashiers: [], invites: [] };
  const today = fromTashkent(toTashkent(now).date, 0);
  const [members, invites] = await Promise.all([
    db.businessMember.findMany({
      where: { businessId: business.id, role: "CASHIER", active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, user: { select: { firstName: true, lastName: true, phone: true, id: true } } },
    }),
    db.cashierInvite.findMany({
      where: { businessId: business.id, acceptedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true },
    }),
  ]);
  // Skan = muvaffaqiyatli sotuv (Redemption) yoki rad etilgan urinish (ScanAttempt, OK dan boshqa)
  const ids = members.map((m) => m.user.id);
  const [sold, failed] = await Promise.all([
    db.redemption.groupBy({ by: ["cashierId"], where: { businessId: business.id, createdAt: { gte: today }, cashierId: { in: ids } }, _count: { _all: true }, _max: { createdAt: true } }),
    db.scanAttempt.groupBy({
      by: ["cashierId"],
      where: { businessId: business.id, createdAt: { gte: today }, cashierId: { in: ids }, result: { not: "OK" } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  const activity = (id: string) => {
    const a = sold.find((x) => x.cashierId === id);
    const b = failed.find((x) => x.cashierId === id);
    const times = [a?._max.createdAt, b?._max.createdAt].filter((d): d is Date => Boolean(d));
    return { count: (a?._count._all ?? 0) + (b?._count._all ?? 0), last: times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null };
  };
  return {
    canInvite: business.status === "APPROVED" || business.status === "WARNED",
    cashiers: members.map((m) => {
      const { count, last } = activity(m.user.id);
      return {
        memberId: m.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        phone: m.user.phone,
        scansToday: count,
        shift: last && now.getTime() - last.getTime() < ON_SHIFT_MINUTES * 60_000 ? ("on" as const) : last ? ("ended" as const) : ("none" as const),
      };
    }),
    invites,
  };
}
export type OwnerCashiers = Awaited<ReturnType<typeof ownerCashiers>>;
