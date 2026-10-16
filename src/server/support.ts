import { CONTACTS } from "@/lib/contacts";

export type SupportContacts = { telegram: string; phone: string | null; email: string; channel: string; instagram: string; instagramHandle: string };

/**
 * Qo'llab-quvvatlash aloqasi. Telegram — admin (`CONTACTS`); `SUPPORT_TELEGRAM` (foydalanuvchi nomi, @ yoki t.me/ bilan ham bo'ladi)
 * berilsa va yaroqli bo'lsa o'shani ishlatadi. `SUPPORT_PHONE` (+998XXXXXXXXX) — telefon egasidan kutilmoqda: yo'q bo'lsa qator chiqmaydi.
 */
export function supportContacts(env: NodeJS.ProcessEnv = process.env): SupportContacts {
  const handle = (env.SUPPORT_TELEGRAM ?? "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
  const phone = (env.SUPPORT_PHONE ?? "").replace(/[\s()-]/g, "");
  return {
    telegram: /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle) ? handle : CONTACTS.adminTelegram,
    phone: /^\+998\d{9}$/.test(phone) ? phone : null,
    email: CONTACTS.email,
    channel: CONTACTS.telegramChannel,
    instagram: CONTACTS.instagram,
    instagramHandle: CONTACTS.instagramHandle,
  };
}
