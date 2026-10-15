export type SupportContacts = { telegram: string | null; phone: string | null };

/**
 * Qo'llab-quvvatlash aloqasi — muhit o'zgaruvchilaridan (qiymat egasidan kutilmoqda, kodga yozilmaydi).
 * `SUPPORT_TELEGRAM` — foydalanuvchi nomi (@ yoki t.me/ bilan ham bo'ladi), `SUPPORT_PHONE` — +998XXXXXXXXX.
 * Yaroqsiz yoki yo'q qiymat — shu qator ko'rsatilmaydi.
 */
export function supportContacts(env: NodeJS.ProcessEnv = process.env): SupportContacts {
  const handle = (env.SUPPORT_TELEGRAM ?? "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
  const phone = (env.SUPPORT_PHONE ?? "").replace(/[\s()-]/g, "");
  return {
    telegram: /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle) ? handle : null,
    phone: /^\+998\d{9}$/.test(phone) ? phone : null,
  };
}
