/**
 * Muhit o'zgaruvchilarini tekshirish — sof funksiya (server-only emas: instrumentation, proxy va testlardan chaqiriladi).
 * Production'da ishlab chiqish uchun mo'ljallangan "qulayliklar" yoqilgan bo'lsa server ishga tushmaydi.
 *
 * Istisno — sinov serveri (`APP_ENV=staging`): production build, SMS provayder ulanguncha OTP_FIXED_CODE va
 * SMS_PROVIDER=dev ruxsat etiladi (admin baribir parol bilan yopiq — admin-password.ts).
 * Fayllar ombori qoidasi `APP_ENV` dan qat'i nazar bir xil (storageProblems).
 * `APP_ENV` yo'q yoki boshqa qiymat — oddiy production qoidalari.
 */
import { appConfigProblems } from "../lib/app-version";

type Env = Record<string, string | undefined>;

/** Web Push (VAPID): uchalasi birga yoki hech biri — yarim sozlangan push jimgina ishlamay qoladi. */
const VAPID_VARS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

const S3_VARS = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

export function isStaging(env: Env = process.env): boolean {
  return (env.APP_ENV ?? "").trim().toLowerCase() === "staging";
}

/** OTP_FIXED_CODE va SMS dev rejimi ishlaydimi: ishlab chiqish/test yoki sinov serveri. */
export function devShortcutsAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV !== "production" || isStaging(env);
}

const REVIEW_PHONE_RE = /^\+998\d{9}$/;
const REVIEW_CODE_RE = /^\d{6}$/;

/**
 * Do'kon tekshiruvchisi (Apple/Google review) uchun kirish: `REVIEW_PHONE` (+998XXXXXXXXX) va `REVIEW_CODE` (6 raqam)
 * ikkalasi o'rnatilgan bo'lsa — FAQAT shu raqamga SMS o'rniga shu kod (production'da ham, OTP_FIXED_CODE o'chiq bo'lsa
 * ham). Chegaralar (60 s, kuniga 5 ta, 5 xato → qulf) o'zgarmaydi. Boshqa raqam yoki env yo'q — null. Tekshiruvdan keyin
 * env'ni o'chiring.
 */
export function reviewLoginCode(phone: string, env: Env = process.env): string | null {
  const reviewPhone = env.REVIEW_PHONE?.trim();
  const code = env.REVIEW_CODE?.trim();
  if (!reviewPhone || !code || !REVIEW_PHONE_RE.test(reviewPhone) || !REVIEW_CODE_RE.test(code)) return null;
  return phone === reviewPhone ? code : null;
}

function reviewProblems(env: Env): string[] {
  const phone = env.REVIEW_PHONE?.trim();
  const code = env.REVIEW_CODE?.trim();
  if (!phone && !code) return [];
  if (!phone || !code) return ["REVIEW_PHONE va REVIEW_CODE birga o'rnatilsin (yoki ikkalasi ham bo'sh)."];
  const problems: string[] = [];
  if (!REVIEW_PHONE_RE.test(phone)) problems.push("REVIEW_PHONE +998XXXXXXXXX ko'rinishida bo'lsin.");
  if (!REVIEW_CODE_RE.test(code)) problems.push("REVIEW_CODE 6 ta raqam bo'lsin.");
  return problems;
}

/**
 * Fayllar ombori (storage/index.ts bilan bir xil standart — `local`). Lokal diskda papka absolyut yo'l bo'lsin:
 * nisbiy yo'l jarayonning ishchi papkasiga bog'liq va deploy'da kod papkasi bilan birga yo'qolishi mumkin.
 */
function storageProblems(env: Env): string[] {
  const driver = (env.STORAGE_DRIVER ?? "local").trim().toLowerCase() || "local";
  if (driver === "local") {
    return env.STORAGE_LOCAL_DIR?.trim().startsWith("/")
      ? []
      : ["STORAGE_DRIVER=local: STORAGE_LOCAL_DIR absolyut yo'l bo'lishi kerak (masalan /var/lib/talabapass/files)."];
  }
  if (driver === "s3") {
    const missing = S3_VARS.filter((name) => !env[name]?.trim());
    return missing.length ? [`STORAGE_DRIVER=s3: ${missing.join(", ")} o'rnatilmagan.`] : [];
  }
  return [`Noma'lum STORAGE_DRIVER: ${driver} (local yoki s3).`];
}

/** Email ("Parolni unutdim" kodi): `dev` faqat sinov serverida, `resend` — kalit va jo'natuvchi bilan. */
function emailProblems(env: Env): string[] {
  const provider = (env.EMAIL_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "resend") {
    const missing = ["RESEND_API_KEY", "EMAIL_FROM"].filter((name) => !env[name]?.trim());
    return missing.length ? [`EMAIL_PROVIDER=resend: ${missing.join(", ")} o'rnatilmagan.`] : [];
  }
  if (provider === "dev") {
    return isStaging(env) ? [] : ["EMAIL_PROVIDER=dev: xatlar server log'iga chiqadi. Resend'ni ulang (RESEND_API_KEY, EMAIL_FROM)."];
  }
  if (provider) return [`Noma'lum EMAIL_PROVIDER: ${provider} (dev yoki resend).`];
  return isStaging(env) ? [] : ["EMAIL_PROVIDER o'rnatilmagan: emailga parol tiklash kodi yuborilmaydi."];
}

export function productionEnvProblems(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems = storageProblems(env);
  if (!isStaging(env)) {
    if (env.OTP_FIXED_CODE) {
      problems.push("OTP_FIXED_CODE o'rnatilgan: production'da hamma shu kod bilan istalgan hisobga kira oladi. O'chiring.");
    }
    if ((env.SMS_PROVIDER ?? "").trim().toLowerCase() === "dev") {
      problems.push("SMS_PROVIDER=dev: kodlar SMS o'rniga server log'iga chiqadi. Haqiqiy provayderni ulang.");
    }
    if (!env.SMS_PROVIDER?.trim()) {
      problems.push("SMS_PROVIDER o'rnatilmagan: hech kim tizimga kira olmaydi.");
    }
  }
  const vapidMissing = VAPID_VARS.filter((name) => !env[name]?.trim());
  if (vapidMissing.length > 0 && vapidMissing.length < VAPID_VARS.length) {
    problems.push(`Web Push: ${vapidMissing.join(", ")} o'rnatilmagan (${VAPID_VARS.join(", ")} birga kerak; kalitlar — npm run push:keys).`);
  }
  if (env.VAPID_SUBJECT?.trim() && !/^(mailto:|https:\/\/)/.test(env.VAPID_SUBJECT.trim())) {
    problems.push("VAPID_SUBJECT mailto:… yoki https://… ko'rinishida bo'lishi kerak.");
  }
  problems.push(...emailProblems(env), ...appConfigProblems(env), ...reviewProblems(env));
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
    problems.push("AUTH_SECRET o'rnatilmagan yoki 32 belgidan qisqa.");
  }
  if (!env.DATABASE_URL) {
    problems.push("DATABASE_URL o'rnatilmagan.");
  }
  return problems;
}

/**
 * Deploy (build) vaqtidagi qo'shimcha tekshiruv: admin paroli xeshi. Server start'da emas — xesh yo'qligi saytning
 * qolganini to'xtatmasligi kerak, lekin deploy'da aniq ko'rinsin (aks holda admin "Parol noto'g'ri" ni ko'radi).
 */
export function buildEnvProblems(env: Env, isHash: (value: string | undefined) => boolean): string[] {
  const problems = productionEnvProblems(env);
  if (env.NODE_ENV === "production" && !isHash(env.ADMIN_PASSWORD_HASH)) {
    problems.push("ADMIN_PASSWORD_HASH o'rnatilmagan yoki formati buzilgan (scrypt:N:r:p:salt:hash) — `npm run admin:hash`.");
  }
  return problems;
}

/** Muammo bo'lsa xato tashlaydi — server start'da chaqiriladi (src/instrumentation.ts). */
export function assertProductionEnv(env: Env = process.env): void {
  const problems = productionEnvProblems(env);
  if (problems.length === 0) return;
  throw new Error(`talabaPass ishga tushmaydi — muhit sozlamalari xavfsiz emas:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
}
