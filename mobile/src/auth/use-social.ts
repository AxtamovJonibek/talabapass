import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, getRandomBytes } from "expo-crypto";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Platform } from "react-native";
import { API_URL, ApiError, errorText } from "@/api/client";
import { authApi, type Intent, type SocialProvider } from "@/api/endpoints";
import { copy } from "@/copy";
import { cachedAppConfig, loadAppConfig } from "@/lib/app-version";
import { emptyDraft, resetTo, routeFor, useApp } from "@/state";

/**
 * Google / Apple bilan kirish (docs/api-v1.md "Auth"): provayder oynasi → token → `POST /auth/google|apple`.
 * Hisob bor — ichkariga; yangi — parol o'rnatish (majburiy), keyin SMSsiz ro'yxat (talaba 1/3 yoki biznes), ism oldindan to'ldiriladi.
 *
 * - Google SDK native modul: Expo Go'da yo'q (dev/preview build kerak) — shuning uchun faqat bosilganda yuklanadi.
 *   Har bir xato log'ga haqiqiy kodi bilan (`[google] … code=10` — DEVELOPER_ERROR: ilova imzosi SHA-1 Google Cloud'dagi
 *   Android OAuth client'da yo'q), dev rejimida ekranda ham.
 * - Apple: iOS — native (`expo-apple-authentication`); Android — web oqimi (Services ID, `form_post` →
 *   `/api/v1/auth/apple/callback` → `talabapass://auth/apple?ticket=…`, `expo-web-browser`). Ticket faqat shu ilovada
 *   yaratilgan `verifier` bilan ochiladi (server `apple-web.ts`). Sozlanmagan bo'lsa — tushunarli xabar.
 */

type GoogleIds = { webClientId?: string; iosClientId?: string };
const googleIds = (Constants.expoConfig?.extra?.google ?? {}) as GoogleIds;

type Reason = "needsBuild" | "playServices" | "googleFailed" | "network" | "appleFailed";
class SocialError extends Error {
  constructor(
    readonly reason: Reason,
    /** Provayderning haqiqiy xato kodi (log va dev ekrani uchun) */
    readonly code?: string,
  ) {
    super(code ? `${reason} (${code})` : reason);
  }
}

/** Google: `idToken`; Apple iOS: `idToken` (+ ism); Apple Android: `ticket` + `verifier` (web oqimi) */
export type ProviderToken = { idToken?: string; ticket?: string; verifier?: string; firstName?: string; lastName?: string };

const codeOf = (e: unknown) => String((e as { code?: unknown } | null)?.code ?? "unknown");

async function googleToken(): Promise<ProviderToken | null> {
  let sdk: typeof import("@react-native-google-signin/google-signin");
  try {
    sdk = await import("@react-native-google-signin/google-signin");
  } catch (e) {
    console.warn("[google] native modul yo'q (Expo Go?):", e);
    throw new SocialError("needsBuild", "NO_NATIVE_MODULE");
  }
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = sdk;
  // webClientId — token `aud` i (server GOOGLE_CLIENT_ID_* bilan tekshiradi; Web turidagi client bo'lishi shart);
  // iOS — o'z client ID'si bilan oyna ochadi. Android client ID ilovaga berilmaydi — Google uni paket nomi va SHA-1 dan topadi.
  if (!googleIds.webClientId) console.warn("[google] app.json extra.google.webClientId yo'q");
  GoogleSignin.configure({ webClientId: googleIds.webClientId, iosClientId: googleIds.iosClientId });
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    // Google sessiyasi qurilmada qolmaydi: keyingi safar (yoki boshqa hisob bilan) yana hisob tanlash oynasi chiqadi
    void GoogleSignin.signOut().catch(() => undefined);
    if (!res.data.idToken) {
      console.warn("[google] idToken yo'q — webClientId Web turidagi client ekanini tekshiring:", googleIds.webClientId);
      throw new SocialError("googleFailed", "NO_ID_TOKEN");
    }
    return { idToken: res.data.idToken, firstName: res.data.user.givenName ?? undefined, lastName: res.data.user.familyName ?? undefined };
  } catch (e) {
    if (e instanceof SocialError) throw e;
    const code = codeOf(e);
    console.warn(`[google] kirish xatosi: code=${code} message=${(e as Error)?.message ?? ""}`, e);
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new SocialError("playServices", code);
      // 7 — NETWORK_ERROR (Google Play xizmatlari)
      if (code === "7" || /network/i.test(String(e.message))) throw new SocialError("network", code);
    }
    // 10 — DEVELOPER_ERROR: SHA-1 / paket nomi Google Cloud'dagi Android client bilan mos emas
    throw new SocialError("googleFailed", code);
  }
}

async function appleNative(): Promise<ProviderToken | null> {
  if (!(await AppleAuthentication.isAvailableAsync().catch(() => false))) throw new SocialError("appleFailed", "NOT_AVAILABLE");
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new SocialError("appleFailed", "NO_ID_TOKEN");
    // Ismni Apple faqat birinchi ruxsatda beradi (tokenda yo'q) — server ro'yxat formasini shu bilan to'ldiradi
    return {
      idToken: credential.identityToken,
      firstName: credential.fullName?.givenName ?? undefined,
      lastName: credential.fullName?.familyName ?? undefined,
    };
  } catch (e) {
    if (e instanceof SocialError) throw e;
    const code = codeOf(e);
    if (code === "ERR_REQUEST_CANCELED") return null;
    console.warn(`[apple] kirish xatosi: code=${code}`, e);
    throw new SocialError("appleFailed", code);
  }
}

const base64url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const RETURN_URL = "talabapass://auth/apple";

/** Android (va web): Apple'ning web oynasi brauzerda, natija deep link bilan qaytadi */
async function appleWeb(): Promise<ProviderToken | null> {
  const verifier = Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, "0")).join("");
  const state = base64url(await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, { encoding: CryptoEncoding.BASE64 }));
  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(`${API_URL}/api/v1/auth/apple/start?state=${state}`, RETURN_URL);
  } catch (e) {
    console.warn("[apple] brauzer ochilmadi:", e);
    throw new SocialError("appleFailed", "BROWSER");
  }
  if (result.type !== "success") return null;
  const params = new URL(result.url).searchParams;
  const error = params.get("error");
  if (error === "cancelled") return null;
  const ticket = params.get("ticket");
  if (error || !ticket) {
    console.warn(`[apple] web oqimi xatosi: ${error ?? "ticket yo'q"}`);
    throw new SocialError("appleFailed", error ?? "NO_TICKET");
  }
  return { ticket, verifier };
}

async function appleToken(): Promise<ProviderToken | null> {
  const auth = (await loadAppConfig()) ?? (await cachedAppConfig());
  if (Platform.OS === "ios") {
    if (auth?.auth && !auth.auth.apple) throw new SocialError("appleFailed", "UNCONFIGURED");
    return appleNative();
  }
  // Android: serverda Services ID yo'q (`APPLE_CLIENT_ID` da faqat bundle ID) — oynani ochmasdan xabar
  if (!auth?.auth?.appleWeb) throw new SocialError("appleFailed", "UNCONFIGURED");
  return appleWeb();
}

/** Provayder oynasidan yangi token (bekor qilinsa — null). Hisobni o'chirishni tasdiqlashda ham. */
export const providerToken = (provider: SocialProvider) => (provider === "GOOGLE" ? googleToken() : appleToken());

/** Server javobidagi Google/Apple xatolari foydalanuvchiga provayder bo'yicha (texnik matnsiz) */
const SERVER_SOCIAL = new Set(["social_invalid", "social_unavailable", "social_unreachable"]);

/**
 * Xato matni: tushunarli jumla; dev rejimida (Metro/dev build) oxirida haqiqiy kodi — "Xato kodi: 10".
 * Har bir xato `console.warn` bilan log'ga ham yoziladi (`adb logcat`, Expo terminali).
 */
export function socialErrorText(e: unknown, provider: SocialProvider = "GOOGLE"): string {
  let text: string;
  let code: string | undefined;
  if (e instanceof SocialError) {
    text = copy.auth[e.reason];
    code = e.code;
  } else if (e instanceof ApiError && SERVER_SOCIAL.has(e.code)) {
    console.warn(`[${provider.toLowerCase()}] server rad etdi: ${e.code} (${e.status}) ${e.message}`);
    text = provider === "APPLE" ? copy.auth.appleFailed : copy.auth.googleFailed;
    code = e.code;
  } else {
    if (e instanceof ApiError) console.warn(`[${provider.toLowerCase()}] server xatosi: ${e.code} (${e.status})`);
    text = errorText(e);
    code = e instanceof ApiError ? e.code : undefined;
  }
  return __DEV__ && code ? `${text}\n${copy.auth.errorCode(code)}` : text;
}

export function useSocialSignIn(intent: Intent) {
  const { signIn, setFlow } = useApp();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (provider: SocialProvider) => {
    if (busy) return;
    setError(null);
    setBusy(provider);
    try {
      const token = await providerToken(provider);
      if (!token) return;
      const result = await authApi.social(provider, { ...token, intent });
      if (result.next === "signedIn") {
        resetTo(routeFor(await signIn(result)));
        return;
      }
      // Yangi foydalanuvchi: avval parol (majburiy), keyin ro'yxat formasi (ism oldindan to'ldiriladi)
      const firstName = result.profile.firstName ?? "";
      const lastName = result.profile.lastName ?? "";
      setFlow({
        intent: result.role,
        phone: "",
        verify: { next: "setPassword", ticket: result.ticket, role: result.role, isNew: true },
        reset: null,
        registrationTicket: null,
        social: { firstName, lastName, email: result.profile.email },
        business: { ...emptyDraft(), contactName: `${firstName} ${lastName}`.trim() },
      });
      router.push("/auth/password?mode=new");
    } catch (e) {
      setError(socialErrorText(e, provider));
    } finally {
      setBusy(null);
    }
  };

  return { run, busy, error };
}
