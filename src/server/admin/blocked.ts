import "server-only";
import { db } from "../db";

/** "Bloklanganlar": bloklangan talabalar va bizneslar (sabab, sana, kim blokladi). Faqat o'qish; chaqiruvchi admin. */

const LIMIT = 100;

const fullName = (first?: string | null, last?: string | null) => [first, last].filter(Boolean).join(" ");

export type BlockedStudent = {
  id: string;
  name: string;
  phone: string;
  university: string;
  reason: string | null;
  at: Date | null;
  by: string;
};

export type BlockedBusiness = {
  id: string;
  name: string;
  owner: string;
  phone: string;
  reason: string | null;
  at: Date | null;
  by: string;
};

export async function blockedStudents(): Promise<BlockedStudent[]> {
  const users = await db.user.findMany({
    where: { role: "STUDENT", status: "BLOCKED" },
    orderBy: { updatedAt: "desc" },
    take: LIMIT,
    select: { id: true, firstName: true, lastName: true, phone: true, blockedReason: true, updatedAt: true, student: { select: { university: { select: { shortName: true } } } } },
  });
  const logs = users.length
    ? await db.auditLog.findMany({ where: { action: "user.block", entityId: { in: users.map((u) => u.id) } }, orderBy: { createdAt: "desc" }, select: { entityId: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } } })
    : [];
  const latest = new Map<string, (typeof logs)[number]>();
  for (const log of logs) if (log.entityId && !latest.has(log.entityId)) latest.set(log.entityId, log);
  return users.map((u) => {
    const log = latest.get(u.id);
    return {
      id: u.id,
      name: fullName(u.firstName, u.lastName),
      phone: u.phone,
      university: u.student?.university.shortName ?? "",
      reason: u.blockedReason,
      at: log?.createdAt ?? u.updatedAt,
      by: log ? fullName(log.actor?.firstName, log.actor?.lastName) : "",
    };
  });
}

export async function blockedBusinesses(): Promise<BlockedBusiness[]> {
  const rows = await db.business.findMany({
    where: { status: "BLOCKED" },
    orderBy: { reviewedAt: "desc" },
    take: LIMIT,
    select: { id: true, name: true, rejectReason: true, reviewedAt: true, updatedAt: true, owner: { select: { firstName: true, lastName: true, phone: true } } },
  });
  const logs = rows.length
    ? await db.auditLog.findMany({ where: { action: "business.block", entityId: { in: rows.map((b) => b.id) } }, orderBy: { createdAt: "desc" }, select: { entityId: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } } })
    : [];
  const latest = new Map<string, (typeof logs)[number]>();
  for (const log of logs) if (log.entityId && !latest.has(log.entityId)) latest.set(log.entityId, log);
  return rows.map((b) => {
    const log = latest.get(b.id);
    return {
      id: b.id,
      name: b.name,
      owner: fullName(b.owner.firstName, b.owner.lastName),
      phone: b.owner.phone,
      reason: b.rejectReason,
      at: log?.createdAt ?? b.reviewedAt ?? b.updatedAt,
      by: log ? fullName(log.actor?.firstName, log.actor?.lastName) : "",
    };
  });
}
