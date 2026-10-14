import "server-only";
import { isProduction } from "./env";

/**
 * SMS yuborish adapteri. Hozircha faqat dev rejim: kod server log'iga chiqadi.
 * Provayder (Eskiz.uz, Play Mobile…) tanlanganda shu interfeysni amalga oshiruvchi yangi sender qo'shiladi
 * va SMS_PROVIDER orqali yoqiladi.
 */
export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}

const devSender: SmsSender = {
  async send(phone, text) {
    console.log(`\n[SMS dev] ${phone}: ${text}\n`);
  },
};

function resolveSender(): SmsSender {
  const provider = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase() || (isProduction ? "" : "dev");
  if (provider === "dev") {
    // Server start'dagi tekshiruvdan (env-check.ts) keyingi ikkinchi qulf.
    if (isProduction) throw new Error("SMS_PROVIDER=dev production'da ishlatilmaydi.");
    return devSender;
  }
  throw new Error(provider ? `Noma'lum SMS_PROVIDER: ${provider}` : "SMS provayder ulanmagan.");
}

export async function sendSms(phone: string, text: string): Promise<void> {
  await resolveSender().send(phone, text);
}
