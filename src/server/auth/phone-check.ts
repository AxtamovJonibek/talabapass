import "server-only";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { AuthError } from "../actions/auth";
import { requestOtp, verifyOtp } from "./otp";
import { getVerifiedPhone } from "./session";

const SEND_ERRORS = { too_soon: "tooSoon", daily_limit: "dailyLimit", ip_limit: "ipLimit", locked: "locked" } as const;

/** So'rov yuborgan IP. Vercel x-forwarded-for ni o'zi qo'yadi (mijoz yuborganini ustidan yozadi). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export type PhoneCheck =
  | { status: "verified" }
  /** SMS kod yuborildi (yoki yaqinda yuborilgan) — kod kiritish qadami */
  | { status: "code"; retryInSeconds?: number }
  | { status: "error"; error: AuthError; retryInSeconds?: number };

/**
 * Ro'yxat formalarida raqam egaligini tasdiqlash (T1/WT1, B1/WB1).
 * Kirish sahifasida shu raqam allaqachon tasdiqlangan bo'lsa — kod qayta so'ralmaydi.
 * Kod berilmagan bo'lsa — SMS yuboriladi; berilgan bo'lsa — tekshiriladi.
 */
export async function confirmPhone(phone: string, rawCode: string | undefined): Promise<PhoneCheck> {
  if ((await getVerifiedPhone()) === phone) return { status: "verified" };

  const code = rawCode?.replace(/\D/g, "");
  if (!code) {
    const t = await getTranslations("auth");
    try {
      const sent = await requestOtp(phone, await clientIp(), (c) => t("sms", { code: c }));
      if (!sent.ok) {
        const retryInSeconds = Math.ceil(sent.retryInMs / 1000);
        // Kod hozirgina yuborilgan — foydalanuvchida u bor, kiritish qadamiga o'tamiz.
        if (sent.reason === "too_soon") return { status: "code", retryInSeconds };
        return { status: "error", error: SEND_ERRORS[sent.reason], retryInSeconds };
      }
    } catch (error) {
      console.error("SMS yuborilmadi:", error);
      return { status: "error", error: "sms" };
    }
    return { status: "code" };
  }

  const verified = await verifyOtp(phone, code);
  if (verified === "ok") return { status: "verified" };
  return { status: "error", error: verified === "locked" ? "locked" : verified === "wrong" ? "wrongCode" : "expired" };
}
