"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { ADMIN_LOCK_MS, ADMIN_MAX_FAILS, isAdminPasswordHash, verifyAdminPassword } from "../auth/admin-password";
import { getCurrentUser, homePathFor, revokeUserSessions, unlockAdmin } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";

export type AdminPasswordResult = { ok: false; error: "wrong" | "locked" | "notConfigured"; retryInSeconds?: number };

/** Oxirgi muvaffaqiyatdan (yoki 15 daqiqadan) beri xato urinishlar — AuditLog'dan. */
async function recentFailures(userId: string, now: Date) {
  const lastOk = await db.auditLog.findFirst({
    where: { actorId: userId, action: "admin.password.ok" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const windowStart = new Date(now.getTime() - ADMIN_LOCK_MS);
  const since = lastOk && lastOk.createdAt > windowStart ? lastOk.createdAt : windowStart;
  return db.auditLog.findMany({
    where: { actorId: userId, action: "admin.password.fail", createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
}

/**
 * Admin ikkinchi qadami: SMS koddan keyin parol (`ADMIN_PASSWORD_HASH`). 5 ta xato → barcha sessiyalar yopiladi
 * va 15 daqiqa parol qabul qilinmaydi (SMS bilan qayta kirish kerak). Har urinish AuditLog'da.
 */
export async function verifyAdminPasswordAction(rawPassword: string): Promise<AdminPasswordResult> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) return redirect({ href: "/kirish", locale });
  if (user.role !== "ADMIN") return redirect({ href: homePathFor(user.role), locale });

  // Xesh sozlanmagan/buzilgan — bu admin xatosi emas: urinish hisoblanmaydi, sabab aniq aytiladi
  if (!isAdminPasswordHash(process.env.ADMIN_PASSWORD_HASH)) {
    console.error("ADMIN_PASSWORD_HASH o'rnatilmagan yoki formati buzilgan (kutilgan: scrypt:N:r:p:salt:hash). `npm run admin:hash`.");
    return { ok: false, error: "notConfigured" };
  }

  const password = z.string().max(256).catch("").parse(rawPassword);
  const now = new Date();
  const failures = await recentFailures(user.id, now);
  if (failures.length >= ADMIN_MAX_FAILS) {
    const retryAt = failures[failures.length - ADMIN_MAX_FAILS]!.createdAt.getTime() + ADMIN_LOCK_MS;
    return { ok: false, error: "locked", retryInSeconds: Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000)) };
  }

  if (!verifyAdminPassword(password, process.env.ADMIN_PASSWORD_HASH)) {
    await audit({ actorId: user.id, action: "admin.password.fail", entity: "User", entityId: user.id });
    if (failures.length + 1 >= ADMIN_MAX_FAILS) {
      await revokeUserSessions(user.id);
      return { ok: false, error: "locked", retryInSeconds: Math.ceil(ADMIN_LOCK_MS / 1000) };
    }
    return { ok: false, error: "wrong" };
  }

  await audit({ actorId: user.id, action: "admin.password.ok", entity: "User", entityId: user.id });
  await unlockAdmin();
  return redirect({ href: homePathFor(user.role), locale });
}
