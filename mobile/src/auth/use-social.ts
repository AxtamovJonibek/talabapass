import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { errorText } from "@/api/client";
import { authApi, type Intent, type SocialProvider } from "@/api/endpoints";
import { copy } from "@/copy";
import { emptyDraft, resetTo, routeFor, useApp } from "@/state";

/**
 * Google / Apple bilan kirish (docs/api-v1.md "Auth"): provayder oynasi → ID token → `POST /auth/google|apple`.
 * Hisob bor — ichkariga; yangi — SMS va parolsiz ro'yxatga (talaba 1/3 yoki biznes), ism oldindan to'ldiriladi.
 * Google SDK native modul: Expo Go'da yo'q (dev/preview build kerak) — shuning uchun faqat bosilganda yuklanadi.
 */

type GoogleIds = { webClientId?: string; iosClientId?: string };
const googleIds = (Constants.expoConfig?.extra?.google ?? {}) as GoogleIds;

type Reason = "needsBuild" | "playServices" | "failed";
class SocialError extends Error {
  constructor(readonly reason: Reason) {
    super(reason);
  }
}

export type ProviderToken = { idToken: string; firstName?: string; lastName?: string };

async function googleToken(): Promise<ProviderToken | null> {
  let sdk: typeof import("@react-native-google-signin/google-signin");
  try {
    sdk = await import("@react-native-google-signin/google-signin");
  } catch (e) {
    console.warn("[google] native modul yo'q (Expo Go?):", e);
    throw new SocialError("needsBuild");
  }
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = sdk;
  // webClientId — token `aud` i (server GOOGLE_CLIENT_ID_* bilan tekshiradi); iOS — o'z client ID'si bilan oyna ochadi
  GoogleSignin.configure({ webClientId: googleIds.webClientId, iosClientId: googleIds.iosClientId });
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return null;
    // Google sessiyasi qurilmada qolmaydi: keyingi safar (yoki boshqa hisob bilan) yana hisob tanlash oynasi chiqadi
    void GoogleSignin.signOut().catch(() => undefined);
    if (!res.data.idToken) throw new SocialError("failed");
    return { idToken: res.data.idToken, firstName: res.data.user.givenName ?? undefined, lastName: res.data.user.familyName ?? undefined };
  } catch (e) {
    if (e instanceof SocialError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new SocialError("playServices");
    }
    console.warn("[google] kirish xatosi:", e);
    throw new SocialError("failed");
  }
}

async function appleToken(): Promise<ProviderToken | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) throw new SocialError("failed");
    // Ismni Apple faqat birinchi ruxsatda beradi (tokenda yo'q) — server ro'yxat formasini shu bilan to'ldiradi
    return {
      idToken: credential.identityToken,
      firstName: credential.fullName?.givenName ?? undefined,
      lastName: credential.fullName?.familyName ?? undefined,
    };
  } catch (e) {
    if (e instanceof SocialError) throw e;
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    console.warn("[apple] kirish xatosi:", e);
    throw new SocialError("failed");
  }
}

/** Provayder oynasidan yangi ID token (bekor qilinsa — null). Hisobni o'chirishni tasdiqlashda ham. */
export const providerToken = (provider: SocialProvider) => (provider === "GOOGLE" ? googleToken() : appleToken());

/** Xato matni: provayder xatosi (Expo Go, Play xizmatlari) yoki server xabari */
export const socialErrorText = (e: unknown) => (e instanceof SocialError ? copy.auth[e.reason] : errorText(e));

/** Apple tugmasi faqat iOS'da va qurilma qo'llasa */
export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
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
      const firstName = result.profile.firstName ?? "";
      const lastName = result.profile.lastName ?? "";
      setFlow({
        intent: result.role,
        phone: "",
        verify: null,
        registrationTicket: result.registrationTicket,
        social: { firstName, lastName, email: result.profile.email },
        business: { ...emptyDraft(), contactName: `${firstName} ${lastName}`.trim() },
      });
      router.push(result.role === "business" ? "/business/info" : "/student/register");
    } catch (e) {
      setError(socialErrorText(e));
    } finally {
      setBusy(null);
    }
  };

  return { run, busy, error };
}
