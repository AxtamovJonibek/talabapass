import type { StudentStatus } from "@/generated/prisma/client";
import { toTashkent } from "@/lib/time";

/** Talaba holati qoidalari — sof funksiyalar (test bilan). */

/**
 * Haqiqiy holat: tasdiqlangan, lekin guvohnoma muddati o'tgan talaba — EXPIRED.
 * Guvohnoma muddatining oxirgi kuni (Toshkent vaqti bilan) hali amal qiladi.
 */
export function effectiveStudentStatus(status: StudentStatus, cardExpiresAt: Date | null, now: Date): StudentStatus {
  if (status === "APPROVED" && cardExpiresAt && cardExpiresAt.getTime() < toTashkent(now).date.getTime()) return "EXPIRED";
  return status;
}

/** Shu holatdagi talaba qayerda bo'lishi kerak. */
export function studentPathFor(status: StudentStatus): string {
  switch (status) {
    case "APPROVED":
      return "/chegirmalar";
    case "PENDING":
    case "REJECTED":
      return "/talaba/tekshiruv";
    case "DRAFT":
    case "EXPIRED":
    case "BLOCKED":
      return "/talaba/guvohnoma";
  }
}

/** Guvohnoma yuklash mumkin bo'lgan holatlar (tasdiqlangan talaba qayta yuklamaydi). */
export function canUploadCard(status: StudentStatus): boolean {
  return status === "DRAFT" || status === "PENDING" || status === "REJECTED" || status === "EXPIRED";
}
