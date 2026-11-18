import type { ReactNode } from "react";
import type { Role } from "@/generated/prisma/client";
import { redirectIfSignedIn, requireRole } from "@/server/auth/session";

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
