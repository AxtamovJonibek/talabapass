import "server-only";
import { devShortcutsAllowed } from "../env-check";
import type { EmailContent } from "./templates";

/**
 * Email yuborish adapteri (SMS adapteri kabi, `sms.ts`). `EMAIL_PROVIDER`:
 * - `dev` — xat server log'iga chiqadi (faqat ishlab chiqish va sinov serveri, `devShortcutsAllowed`);
 * - `resend` — Resend HTTP API (`RESEND_API_KEY`, `EMAIL_FROM`, masalan `talabaPass <noreply@talabapass.uz>`).
 * Bo'sh bo'lsa: ishlab chiqishda `dev`, production'da xato (env-check server start'da ham to'xtatadi).
 */
export type EmailMessage = EmailContent & { to: string };

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

const devSender: EmailSender = {
  async send({ to, subject, text }) {
    console.log(`\n[EMAIL dev] ${to} — ${subject}\n${text}\n`);
  },
};

function resendSender(apiKey: string, from: string): EmailSender {
  return {
    async send({ to, subject, text, html }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10_000),
      });
      // Javob matnida manzil yoki kod yo'q — log'ga faqat holat va xato turi
      if (!response.ok) throw new Error(`Resend: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`);
    },
  };
}

function resolveSender(): EmailSender {
  const devAllowed = devShortcutsAllowed();
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase() || (devAllowed ? "dev" : "");
  if (provider === "dev") {
    if (!devAllowed) throw new Error("EMAIL_PROVIDER=dev production'da ishlatilmaydi.");
    return devSender;
  }
  if (provider === "resend") {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    if (!key || !from) throw new Error("EMAIL_PROVIDER=resend: RESEND_API_KEY va EMAIL_FROM kerak.");
    return resendSender(key, from);
  }
  throw new Error(provider ? `Noma'lum EMAIL_PROVIDER: ${provider}` : "Email provayder ulanmagan.");
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  await resolveSender().send(message);
}
