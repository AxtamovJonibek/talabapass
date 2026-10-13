"use server";

import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { requestOtp, verifyOtp } from "../auth/otp";
import { createSession, destroySession, homePathFor, rememberVerifiedPhone } from "../auth/session";
import { db } from "../db";

export type AuthError = "phone" | "tooSoon" | "hourlyLimit" | "sms" | "wrongCode" | "expired" | "locked" | "blocked";
export type RequestCodeResult = { ok: true; phone: string } | { ok: false; error: AuthError; retryInSeconds?: number };
export type VerifyCodeResult = { ok: false; error: AuthError };

const intentSchema = z.enum(["student", "business"]);

/** 1-qadam: raqamga SMS kod yuborish. Raqam ro'yxatda bor-yo'qligi oshkor qilinmaydi. */
export async function requestCodeAction(rawPhone: string): Promise<RequestCodeResult> {
  const phone = normalizePhone(z.string().max(32).catch("").parse(rawPhone));
  if (!phone) return { ok: false, error: "phone" };

  const t = await getTranslations("auth");
  try {
    const sent = await requestOtp(phone, (code) => t("sms", { code }));
    if (!sent.ok) {
      return { ok: false, error: sent.reason === "too_soon" ? "tooSoon" : "hourlyLimit", retryInSeconds: Math.ceil(sent.retryInMs / 1000) };
    }
  } catch (error) {
    console.error("SMS yuborilmadi:", error);
    return { ok: false, error: "sms" };
  }
  return { ok: true, phone };
}

/**
 * 2-qadam: kodni tekshirish. Hisob bo'lsa — sessiya ochiladi va rol bosh sahifasiga o'tiladi.
 * Hisob bo'lmasa — raqam tasdiqlangan deb eslab qolinadi va tanlangan ro'yxat formasiga o'tiladi.
 */
export async function verifyCodeAction(rawPhone: string, rawCode: string, rawIntent: string): Promise<VerifyCodeResult> {
  const phone = normalizePhone(z.string().max(32).catch("").parse(rawPhone));
  const code = z.string().max(12).catch("").parse(rawCode).replace(/\D/g, "");
  const intent = intentSchema.catch("student").parse(rawIntent);
  if (!phone) return { ok: false, error: "phone" };

  const result = await verifyOtp(phone, code);
  if (result !== "ok") {
    return { ok: false, error: result === "locked" ? "locked" : result === "wrong" ? "wrongCode" : "expired" };
  }

  const locale = await getLocale();
  const user = await db.user.findUnique({ where: { phone }, select: { id: true, role: true, status: true } });
  if (!user) {
    await rememberVerifiedPhone(phone);
    return redirect({ href: intent === "business" ? "/biznes/royxat" : "/talaba/royxat", locale });
  }
  if (user.status !== "ACTIVE") return { ok: false, error: "blocked" };

  await createSession(user.id, (await headers()).get("user-agent"));
  return redirect({ href: homePathFor(user.role), locale });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect({ href: "/", locale: await getLocale() });
}
