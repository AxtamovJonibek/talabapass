import "server-only";
import type { Prisma, Role } from "@/generated/prisma/client";
import { db } from "../db";

/** Admin: foydalanuvchilar va universitetlar ro'yxati/tafsiloti (faqat o'qish). */

export const PAGE_SIZE = 25;
export const USER_ROLES = ["STUDENT", "BUSINESS_OWNER", "CASHIER", "ADMIN"] as const satisfies readonly Role[];
export type UserRole = (typeof USER_ROLES)[number];

const digits = (s: string) => s.replace(/\D/g, "");

export async function listUsers({ role, q, page }: { role: UserRole; q: string; page: number }) {
  const term = q.trim();
  const phoneTerm = digits(term);
  const where: Prisma.UserWhereInput = {
    role,
    ...(term
      ? {
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            ...(phoneTerm.length >= 3 ? [{ phone: { contains: phoneTerm } }] : []),
            { ownedBusinesses: { some: { name: { contains: term, mode: "insensitive" } } } },
            { student: { publicId: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
        student: { select: { status: true, university: { select: { shortName: true } } } },
        ownedBusinesses: { orderBy: { createdAt: "asc" }, take: 1, select: { name: true, status: true } },
        memberships: { where: { active: true }, take: 1, select: { business: { select: { name: true } } } },
      },
    }),
  ]);
  return { total, rows };
}

export async function userDetail(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      blockedReason: true,
      createdAt: true,
      student: {
        select: {
          course: true,
          faculty: true,
          universityId: true,
          districtId: true,
          cardNumber: true,
          cardExpiresAt: true,
          publicId: true,
          status: true,
          avatarKey: true,
          university: { select: { name: true } },
        },
      },
      ownedBusinesses: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
      universityRequests: { where: { status: "PENDING" }, select: { name: true } },
    },
  });
  if (!user) return null;
  const logs = await db.auditLog.findMany({
    where: { OR: [{ entity: "User", entityId: id }, ...(user.ownedBusinesses[0] ? [{ entity: "Business", entityId: user.ownedBusinesses[0].id }] : [])] },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, action: true, createdAt: true, meta: true, actor: { select: { firstName: true, lastName: true } } },
  });
  return { ...user, logs };
}

export const businessFull = (id: string) =>
  db.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      legalName: true,
      tin: true,
      kind: true,
      typeLabel: true,
      address: true,
      landmark: true,
      workingHours: true,
      description: true,
      contactName: true,
      contactPhone: true,
      publicPhone: true,
      telegram: true,
      instagram: true,
      status: true,
      logoKey: true,
    },
  });

export const lookups = async () => ({
  universities: await db.university.findMany({ where: { kind: { not: "OTHER" } }, orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
  districts: await db.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
});

export const adminList = () =>
  db.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, firstName: true, lastName: true, phone: true, status: true, createdAt: true } });

export async function listUniversities({ q, region, kind, page }: { q: string; region: string; kind: string; page: number }) {
  const term = q.trim();
  const where: Prisma.UniversityWhereInput = {
    kind: kind === "STATE" || kind === "PRIVATE" || kind === "FOREIGN" ? kind : { not: "OTHER" },
    ...(region ? { region } : {}),
    ...(term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { shortName: { contains: term, mode: "insensitive" } }] } : {}),
  };
  const [total, rows, regions] = await Promise.all([
    db.university.count({ where }),
    db.university.findMany({
      where,
      orderBy: [{ region: "asc" }, { name: "asc" }],
      skip: (Math.max(1, page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, name: true, shortName: true, region: true, kind: true, active: true, source: true, _count: { select: { students: true } } },
    }),
    db.university.groupBy({ by: ["region"], where: { kind: { not: "OTHER" } }, orderBy: { region: "asc" } }),
  ]);
  return { total, rows, regions: regions.map((r) => r.region) };
}

export const pendingUniversityRequests = () =>
  db.universityRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, name: true, createdAt: true, user: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });

export const universityOne = (id: string) =>
  db.university.findUnique({ where: { id }, select: { id: true, name: true, shortName: true, region: true, kind: true, active: true, source: true, _count: { select: { students: true } } } });
