import "server-only";
import { appleWebClientId } from "@/lib/app-version";
import { APPLE_CALLBACK_URL } from "../api/apple-web";

/**
 * Brauzerdagi Google/Apple tugmalari uchun ochiq client ID'lar (maxfiy emas). Sozlanmagan bo'lsa `null` — tugma bosilganda
 * foydalanuvchiga boshqa usul taklif qilinadi.
 */
export function webSocialConfig() {
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID_WEB?.trim() || null,
    appleClientId: appleWebClientId(process.env),
    appleRedirect: APPLE_CALLBACK_URL,
  };
}
