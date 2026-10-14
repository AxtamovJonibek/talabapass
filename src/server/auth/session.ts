import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import type { Role } from "@/generated/prisma/client";
import { db } from "../db";
import { authSecret } from "../env";
import { authCookieOptions as cookieOptions } from "./cookie-options";

const SESSION_COOKIE = "tp_session";
const VERIFIED_PHONE_COOKIE = "tp_verified_phone";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const VERIFIED_PHONE_TTL_MS = 30 * 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// ───────── sessiya ─────────

export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS), userAgent: userAgent?.slice(0, 255) },
  });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Foydalanuvchining barcha qurilmalardagi sessiyalarini yopadi (bloklash, hisobni o'chirish). */
export async function revokeUserSessions(userIds: string | string[]): Promise<number> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.length === 0) return 0;
  return (await db.session.deleteMany({ where: { userId: { in: ids } } })).count;
}

/** Joriy foydalanuvchi (bir so'rov ichida bir marta o'qiladi). Bloklangan yoki sessiyasi eskirgan bo'lsa — null. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          student: { include: { university: true } },
          memberships: { where: { active: true }, include: { business: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Har bir rolning bosh sahifasi. */
export function homePathFor(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "/chegirmalar";
    case "BUSINESS_OWNER":
      return "/biznes";
    case "CASHIER":
      return "/biznes/skaner";
    case "ADMIN":
      // TODO(10-bosqich): A1 umumiy ko'rinish tayyor bo'lgach "/admin" ga qaytariladi.
      return "/admin/talabalar";
  }
}

async function go(href: string): Promise<never> {
  return redirect({ href, locale: await getLocale() });
}

/**
 * Har bir himoyalangan sahifa, layout va server action boshida chaqiriladi.
 * Kirmagan — /kirish ga; boshqa rol — o'z bosh sahifasiga yo'naltiriladi.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) return go("/kirish");
  if (!roles.includes(user.role)) return go(homePathFor(user.role));
  return user;
}

/** Kirgan foydalanuvchini kirish sahifasidan o'z bosh sahifasiga o'tkazadi. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await go(homePathFor(user.role));
}

// ───────── tasdiqlangan, lekin hali ro'yxatdan o'tmagan raqam ─────────
// SMS kod to'g'ri kiritilgan, ammo bu raqamli hisob yo'q: ro'yxat formasi shu imzolangan cookie'ga tayanadi.

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(`verified-phone:${payload}`).digest("base64url");
}

export async function rememberVerifiedPhone(phone: string): Promise<void> {
  const payload = `${phone}.${Date.now() + VERIFIED_PHONE_TTL_MS}`;
  (await cookies()).set(VERIFIED_PHONE_COOKIE, `${payload}.${sign(payload)}`, cookieOptions(VERIFIED_PHONE_TTL_MS));
}

export async function getVerifiedPhone(): Promise<string | null> {
  // Muddat joriy vaqt bilan solishtiriladi — faqat so'rov vaqtida hisoblanadi (prerender'da emas).
  await connection();
  const raw = (await cookies()).get(VERIFIED_PHONE_COOKIE)?.value;
  if (!raw) return null;
  const cut = raw.lastIndexOf(".");
  const payload = raw.slice(0, cut);
  const given = Buffer.from(raw.slice(cut + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [phone, expires] = payload.split(".");
  return phone && Number(expires) > Date.now() ? phone : null;
}

export async function forgetVerifiedPhone(): Promise<void> {
  (await cookies()).delete(VERIFIED_PHONE_COOKIE);
}
