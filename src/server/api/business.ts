import "server-only";
import type { NextRequest } from "next/server";
import type { ScanResult } from "@/generated/prisma/client";
import { scannerFor, type Scanner } from "../coupons/scan";
import type { OrderScanError } from "../preorder/scan";
import { db } from "../db";
import { LIVE_BUSINESS_STATUSES } from "../student/feed";
import { ApiError, type ApiErrorCode } from "./http";
import { requireApiRole, type ApiAuth } from "./session";

/*
 * Biznes ilovasi uchun rol tekshiruvlari (sayt `requireRole` + `scannerFor` / tasdiqlangan biznes bilan bir xil).
 * Biznes hech qachon so'rovdan olinmaydi — faqat sessiyadagi foydalanuvchidan.
 */

export type OwnerAuth = ApiAuth & { business: { id: string; name: string } };

/** Egasi va uning tasdiqlangan (APPROVED/WARNED, yuborilgan) biznesi. Tekshiruvdagi/rad etilgan — `business_not_ready`. */
export async function requireApiOwner(request: NextRequest): Promise<OwnerAuth> {
  const auth = await requireApiRole(request, "BUSINESS_OWNER");
  const business = await db.business.findFirst({
    where: { ownerId: auth.user.id, status: { in: LIVE_BUSINESS_STATUSES }, submittedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!business) throw new ApiError("business_not_ready");
  return { ...auth, business };
}

/** Skanerlay oladigan foydalanuvchi: kassir (faol a'zolik) yoki egasi (tasdiqlangan biznes). */
export async function requireApiScanner(request: NextRequest): Promise<ApiAuth & { scanner: Scanner }> {
  const auth = await requireApiRole(request, "BUSINESS_OWNER", "CASHIER");
  const scanner = await scannerFor(auth.user);
  if (!scanner) throw new ApiError("business_not_ready");
  return { ...auth, scanner };
}

const SCAN_ERRORS: Record<Exclude<ScanResult, "OK"> | Exclude<OrderScanError, ScanResult>, ApiErrorCode> = {
  INVALID: "scan_invalid",
  EXPIRED: "scan_expired",
  REPLAYED: "scan_replayed",
  OUT_OF_HOURS: "scan_out_of_hours",
  LIMIT: "scan_limit",
  WRONG_BUSINESS: "scan_wrong_business",
  BLOCKED: "scan_blocked",
  MANUAL_LOCKED: "scan_manual_locked",
  ORDER_NOT_CONFIRMED: "order_not_confirmed",
  ORDER_CLOSED: "order_closed",
};

/** Skan natijasi → API xatosi (sababi `result` da ham: ilova natija ekranini shunga qarab chizadi). */
export function scanError(result: keyof typeof SCAN_ERRORS, attemptsLeft?: number): ApiError {
  return new ApiError(SCAN_ERRORS[result], { result, ...(attemptsLeft !== undefined ? { attemptsLeft } : {}) });
}
