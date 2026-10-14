import type { ReactNode } from "react";
import type { Role } from "@/generated/prisma/client";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { adminUnlocked, getCurrentUser, homePathFor, redirectIfSignedIn, requireRole } from "@/server/auth/session";

const go = async (href: string): Promise<never> => redirect({ href, locale: await getLocale() });

/**
 * Rol guruhi layout'ida ishlatiladi: ruxsat bo'lmasa bolalar umuman chizilmaydi.
 * Suspense ichida turishi kerak (cookie o'qiydi). Sahifalar va action'lar baribir o'zi ham `requireRole` chaqiradi.
 */
export async function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  await requireRole(...roles);
  return children;
}

/** Kirish/ro'yxat sahifalarida: kirgan foydalanuvchini o'z bosh sahifasiga o'tkazadi. */
export async function GuestOnly() {
  await redirectIfSignedIn();
  return null;
}

/** Admin parol sahifasi: faqat SMS bilan kirgan, lekin parol kiritmagan admin uchun. */
export async function AdminPasswordGate() {
  const user = await getCurrentUser();
  if (!user) return go("/kirish");
  if (user.role !== "ADMIN" || (await adminUnlocked())) return go(homePathFor(user.role));
  return null;
}
