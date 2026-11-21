"use client";

/*
 * Brauzerda Google / Apple ID token olish (sayt kirishi). Tokenni server `socialSignInWith` bilan ilovadagidek tekshiradi:
 * `aud` — `GOOGLE_CLIENT_ID_WEB` / Apple Services ID (`APPLE_CLIENT_ID` ichida). Skriptlar faqat tugma bosilganda yuklanadi.
 */

type GoogleId = {
  initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: "popup" }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};
type AppleAuth = {
  init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
  signIn: () => Promise<{ authorization?: { id_token?: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
    AppleID?: { auth: AppleAuth };
  }
}

const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let promise = loaded.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loaded.delete(src);
        reject(new Error("script"));
      };
      document.head.appendChild(script);
    });
    loaded.set(src, promise);
  }
  return promise;
}

/**
 * Google'ning o'z tugmasini (`renderButton`) ko'rinmas qilib bizning tugma ustiga qo'yadi: bosish unga tushadi va ID token
 * `onToken` ga keladi (One Tap'ga qaraganda ishonchli — brauzer uni bostirib qo'yishi mumkin).
 */
export async function mountGoogleButton(parent: HTMLElement, clientId: string, width: number, onToken: (idToken: string) => void): Promise<void> {
  await loadScript("https://accounts.google.com/gsi/client");
  const id = window.google?.accounts.id;
  if (!id) throw new Error("google");
  id.initialize({
    client_id: clientId,
    ux_mode: "popup",
    callback: (response) => {
      if (response.credential) onToken(response.credential);
    },
  });
  parent.replaceChildren();
  id.renderButton(parent, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "left", width: Math.min(400, Math.max(200, Math.round(width))) });
}

export type AppleResult = { idToken: string; firstName?: string; lastName?: string };

/** Apple oynasi (popup). Foydalanuvchi yopsa — `null`. */
export async function appleSignIn(clientId: string, redirectURI: string): Promise<AppleResult | null> {
  await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
  const auth = window.AppleID?.auth;
  if (!auth) throw new Error("apple");
  auth.init({ clientId, scope: "name email", redirectURI, usePopup: true });
  try {
    const result = await auth.signIn();
    const idToken = result.authorization?.id_token;
    if (!idToken) throw new Error("apple");
    return { idToken, firstName: result.user?.name?.firstName, lastName: result.user?.name?.lastName };
  } catch (error) {
    if (typeof error === "object" && error !== null && "error" in error && (error as { error: string }).error === "popup_closed_by_user") return null;
    throw error;
  }
}
