import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import type { Prisma, Role } from "@/generated/prisma/client";
import { audit } from "../audit";
import { effectiveStudentStatus } from "../auth/student-status";
import { db } from "../db";
import { authSecret } from "../env";
import { ApiError } from "./http";
import { bearerToken, refreshTokenHash, seal, unseal } from "./rules";

/*
 * API sessiyasi (`Session.kind = API`): qisqa muddatli access token (muhrlangan: sessiya va foydalanuvchi id, 15 daqiqa)
 * va aylanuvchi refresh token (tasodifiy, bazada faqat xeshi, 30 kun, har yangilashda almashadi va muddati suriladi).
 * Access token har so'rovda sessiya qatoriga qarab tekshiriladi — chiqish, bloklash, parolni tiklash yoki hisobni
 * o'chirish (sessiyalar o'chiriladi) darhol kuchga kiradi. Eski refresh token qayta kelsa — o'g'irlik belgisi,
 * sessiya yopiladi.
 */

export const ACCESS_TTL_MS = 15 * 60_000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
/** `lastUsedAt` har so'rovda emas, shuncha vaqtda bir marta yoziladi */
const TOUCH_MS = 5 * 60_000;

const USER_INCLUDE = {
  student: { include: { university: true } },
  memberships: { where: { active: true }, include: { business: true } },
} satisfies Prisma.UserInclude;

export type ApiUser = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;
export type ApiAuth = { user: ApiUser; sessionId: string };
export type StudentAuth = { user: ApiUser & { student: NonNullable<ApiUser["student"]> }; sessionId: string };

export type TokenPair = {
  tokenType: "Bearer";
  accessToken: string;
  /** ISO */
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type Device = { deviceName?: string | null; userAgent?: string | null };

/** Sayt `getCurrentUser` bilan bir xil: faol, kassir esa faqat bloklanmagan biznesdagi faol a'zoligi bilan. */
function usable(user: ApiUser): boolean {
  if (user.status !== "ACTIVE") return false;
  if (user.role === "CASHIER") return user.memberships.some((m) => m.role === "CASHIER" && m.business.status !== "BLOCKED");
  return true;
}

function accessToken(sessionId: string, userId: string, now: number) {
  return { token: seal("access", { sid: sessionId, uid: userId }, ACCESS_TTL_MS, authSecret(), now), expiresAt: new Date(now + ACCESS_TTL_MS) };
}

function pair(sessionId: string, userId: string, refreshToken: string, refreshExpiresAt: Date, now: number): TokenPair {
  const access = accessToken(sessionId, userId, now);
  return {
    tokenType: "Bearer",
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
  };
}

const newRefreshToken = () => randomBytes(32).toString("base64url");

/** Kirish/ro'yxatdan keyin: yangi API sessiyasi va token jufti. */
export async function openApiSession(userId: string, device: Device = {}, now = Date.now()): Promise<TokenPair> {
  const refresh = newRefreshToken();
  const expiresAt = new Date(now + REFRESH_TTL_MS);
  const session = await db.session.create({
    data: {
      userId,
      kind: "API",
      tokenHash: refreshTokenHash(refresh),
      expiresAt,
      lastUsedAt: new Date(now),
      deviceName: device.deviceName?.trim().slice(0, 80) || null,
      userAgent: device.userAgent?.slice(0, 255),
    },
    select: { id: true },
  });
  return pair(session.id, userId, refresh, expiresAt, now);
}

/** Refresh tokenni aylantiradi: eskisi yaroqsiz bo'ladi, yangi juft qaytadi. */
export async function rotateRefreshToken(refreshToken: string, now = Date.now()): Promise<TokenPair> {
  const hash = refreshTokenHash(refreshToken);
  const session = await db.session.findUnique({ where: { tokenHash: hash }, include: { user: { include: USER_INCLUDE } } });
  if (!session) {
    // Allaqachon almashtirilgan token qayta keldi: kimdadir nusxasi bor — sessiya yopiladi (ikkala tomon ham qayta kiradi)
    const reused = await db.session.findUnique({ where: { prevTokenHash: hash }, select: { id: true, userId: true } });
    if (reused) {
      await db.session.deleteMany({ where: { id: reused.id } });
      await audit({ actorId: reused.userId, action: "session.refresh_reused", entity: "Session", entityId: reused.id });
      throw new ApiError("refresh_reused");
    }
    throw new ApiError("refresh_invalid");
  }
  if (session.kind !== "API" || session.expiresAt.getTime() <= now || !usable(session.user)) {
    if (session.kind === "API") await db.session.deleteMany({ where: { id: session.id } });
    throw new ApiError("refresh_invalid");
  }

  const next = newRefreshToken();
  const expiresAt = new Date(now + REFRESH_TTL_MS);
  // Shartli: parallel ikki yangilashdan faqat bittasi o'tadi
  const rotated = await db.session.updateMany({
    where: { id: session.id, tokenHash: hash },
    data: { tokenHash: refreshTokenHash(next), prevTokenHash: hash, expiresAt, lastUsedAt: new Date(now) },
  });
  if (rotated.count !== 1) throw new ApiError("refresh_invalid");
  return pair(session.id, session.userId, next, expiresAt, now);
}

/**
 * Bearer access token → sessiya va foydalanuvchi. Token yo'q/buzilgan yoki sessiya yopilgan — `unauthorized`,
 * muddati o'tgan — `token_expired` (mijoz refresh qiladi). `allowExpired` — faqat chiqish uchun.
 */
export async function authenticate(request: NextRequest, { allowExpired = false } = {}): Promise<ApiAuth> {
  const token = bearerToken(request.headers.get("authorization"));
  const claims = token ? unseal("access", token, authSecret()) : null;
  if (!claims || typeof claims.sid !== "string" || typeof claims.uid !== "string") throw new ApiError("unauthorized");
  const now = Date.now();
  if (claims.exp <= now && !allowExpired) throw new ApiError("token_expired");

  const session = await db.session.findUnique({ where: { id: claims.sid }, include: { user: { include: USER_INCLUDE } } });
  if (!session || session.kind !== "API" || session.userId !== claims.uid || session.expiresAt.getTime() <= now || !usable(session.user)) {
    throw new ApiError("unauthorized");
  }
  if (!session.lastUsedAt || now - session.lastUsedAt.getTime() > TOUCH_MS) {
    await db.session.updateMany({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
  }
  return { user: session.user, sessionId: session.id };
}

/** Rol tekshiruvi (sayt `requireRole` ning API ko'rinishi): begona rol — `forbidden`. */
export async function requireApiRole(request: NextRequest, ...roles: Role[]): Promise<ApiAuth> {
  const auth = await authenticate(request);
  if (!roles.includes(auth.user.role)) throw new ApiError("forbidden");
  return auth;
}

/**
 * Talaba (sayt `requireStudent` / `requireActiveStudent`): guvohnoma muddati o'tgan bo'lsa shu yerda EXPIRED ga
 * o'tkaziladi. `approved` — faqat tasdiqlangan talaba (aks holda `student_not_approved` + joriy holat).
 */
export async function requireApiStudent(request: NextRequest, { approved = true } = {}): Promise<StudentAuth> {
  const auth = await requireApiRole(request, "STUDENT");
  const student = auth.user.student;
  if (!student) throw new ApiError("student_not_approved", { status: null });
  const status = effectiveStudentStatus(student.status, student.cardExpiresAt, new Date());
  if (status !== student.status) {
    await db.studentProfile.updateMany({ where: { userId: auth.user.id, status: "APPROVED" }, data: { status } });
    student.status = status;
  }
  if (approved && status !== "APPROVED") throw new ApiError("student_not_approved", { status });
  return auth as StudentAuth;
}

export async function closeApiSession(sessionId: string): Promise<void> {
  // Push qurilmalari sessiya bilan birga o'chadi (onDelete: Cascade)
  await db.session.deleteMany({ where: { id: sessionId, kind: "API" } });
}

export async function loadApiUser(userId: string): Promise<ApiUser> {
  return db.user.findUniqueOrThrow({ where: { id: userId }, include: USER_INCLUDE });
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** `GET /me` va kirish javobidagi foydalanuvchi. */
export function meView(user: ApiUser) {
  const student = user.student;
  const membership = user.memberships[0] ?? null;
  return {
    id: user.id,
    /** null — Google/Apple bilan ochilgan hisob */
    phone: user.phone,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    hasPassword: user.passwordHash !== null,
    student: student
      ? {
          status: effectiveStudentStatus(student.status, student.cardExpiresAt, new Date()),
          publicId: student.publicId,
          course: student.course,
          faculty: student.faculty,
          districtId: student.districtId,
          cardExpiresAt: isoDate(student.cardExpiresAt),
          university: { id: student.university.id, name: student.university.name, shortName: student.university.shortName },
        }
      : null,
    business: membership
      ? {
          id: membership.business.id,
          name: membership.business.name,
          status: membership.business.status,
          submitted: membership.business.submittedAt !== null,
          rejectReason: membership.business.rejectReason,
          memberRole: membership.role,
        }
      : null,
  };
}
export type MeView = ReturnType<typeof meView>;
