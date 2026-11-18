/**
 * Email matnlari (3 tilda) — sof funksiyalar (server-only emas: testlardan ham). Oddiy HTML: jadvalsiz, inline uslub,
 * brend ranglari (`globals.css` tokenlari bilan bir xil qiymatlar — pochta dasturlari CSS o'zgaruvchilarini o'qimaydi).
 */

export const EMAIL_LOCALES = ["uz", "ru", "en"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

export const emailLocale = (value: string | null | undefined): EmailLocale =>
  EMAIL_LOCALES.find((l) => l === value?.trim().toLowerCase()) ?? "uz";

export type EmailContent = { subject: string; text: string; html: string };

// globals.css: ink, paper, white, muted, line, blue
const C = { ink: "#141414", paper: "#F3F2EE", white: "#FFFFFF", muted: "#5F5D57", line: "#D6D3CA", blue: "#2433D6" } as const;

const RESET = {
  uz: {
    subject: "talabaPass: parolni tiklash kodi",
    title: "Parolni tiklash",
    lead: "Hisobingiz parolini tiklash uchun quyidagi kodni kiriting:",
    valid: (m: number) => `Kod ${m} daqiqa amal qiladi.`,
    ignore: "Agar siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring — parolingiz o'zgarmaydi.",
    never: "Kodni hech kimga bermang. talabaPass xodimlari uni hech qachon so'ramaydi.",
  },
  ru: {
    subject: "talabaPass: код для восстановления пароля",
    title: "Восстановление пароля",
    lead: "Чтобы восстановить пароль, введите этот код:",
    valid: (m: number) => `Код действует ${m} минут.`,
    ignore: "Если вы не запрашивали восстановление, просто проигнорируйте это письмо — пароль не изменится.",
    never: "Никому не сообщайте код. Сотрудники talabaPass никогда его не спрашивают.",
  },
  en: {
    subject: "talabaPass: password reset code",
    title: "Reset your password",
    lead: "Enter this code to reset your password:",
    valid: (m: number) => `The code is valid for ${m} minutes.`,
    ignore: "If you didn't request this, you can ignore this email — your password won't change.",
    never: "Never share this code. talabaPass staff will never ask for it.",
  },
} as const;

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Parolni unutdim" — 6 raqamli kod. */
export function resetCodeEmail(locale: EmailLocale, code: string, minutes: number): EmailContent {
  const t = RESET[locale];
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const text = [t.title, "", t.lead, "", spaced, "", t.valid(minutes), t.ignore, t.never, "", "talabaPass · talabapass.uz"].join("\n");
  const html = `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(t.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:${C.paper};font-family:Archivo,Arial,Helvetica,sans-serif;color:${C.ink}">
<div style="max-width:480px;margin:0 auto;background:${C.white};border:1.5px solid ${C.line};border-radius:18px;padding:28px 24px">
<div style="font-size:20px;font-weight:900;letter-spacing:-0.02em">talaba<span style="color:${C.blue}">Pass</span></div>
<h1 style="margin:24px 0 8px;font-size:26px;line-height:1.1;font-weight:900;letter-spacing:-0.03em">${escape(t.title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:${C.muted}">${escape(t.lead)}</p>
<div style="margin:0 0 18px;padding:16px;border-radius:14px;background:${C.paper};text-align:center;font-size:34px;font-weight:900;letter-spacing:0.12em;font-variant-numeric:tabular-nums">${escape(spaced)}</div>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5"><b>${escape(t.valid(minutes))}</b></p>
<p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${C.muted}">${escape(t.ignore)}</p>
<p style="margin:0;font-size:14px;line-height:1.5;color:${C.muted}">${escape(t.never)}</p>
</div>
<p style="max-width:480px;margin:14px auto 0;font-size:12px;color:${C.muted};text-align:center">talabaPass · talabapass.uz</p>
</body></html>`;
  return { subject: t.subject, text, html };
}
