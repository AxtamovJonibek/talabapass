import "server-only";
import type { AuthProvider } from "@/generated/prisma/client";

/**
 * Yangi hisob qanday tasdiqlangan: telefon (SMS kod, E.164 satr) yoki Google/Apple (ilova, `AuthIdentity`).
 * Ro'yxat funksiyalari (`createStudent`, `createBusinessOwner`) ikkalasini ham qabul qiladi.
 */
export type SocialAccount = { provider: AuthProvider; subject: string; /** faqat tasdiqlangan */ email: string | null };
export type NewAccount = string | SocialAccount;

/** `User` yaratish ma'lumoti: raqam yoki email + identifikator. */
export function accountData(account: NewAccount) {
  if (typeof account === "string") return { phone: account };
  return {
    email: account.email,
    identities: { create: { provider: account.provider, subject: account.subject, email: account.email, lastUsedAt: new Date() } },
  };
}

/** Tasdiqlangan raqam (biznes `contactPhone` uchun); Google/Apple hisobida — yo'q. */
export const accountPhone = (account: NewAccount): string | null => (typeof account === "string" ? account : null);
