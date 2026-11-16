import { copy } from "@/copy";
import { offlineNow } from "@/lib/network";
import { FileTooLargeError } from "@/lib/pick";
import { clearTokens, loadTokens, saveTokens, type StoredTokens } from "@/storage";

/**
 * `/api/v1` klienti (docs/api-v1.md). Access token xotirada va SecureStore'da; muddati tugasa yoki 401 kelsa —
 * refresh. **Bir vaqtda faqat bitta refresh so'rovi**: qolgan so'rovlar o'sha va'dani kutadi (refresh token aylanadi —
 * eski token ikkinchi marta yuborilsa server sessiyani yopadi). Refresh rad etilsa — tokenlar o'chadi va
 * `onSignedOut` tinglovchilari chaqiriladi (ilova kirish ekraniga qaytadi).
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://talabapass.uz").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
  get fields(): string[] {
    return Array.isArray(this.details.fields) ? (this.details.fields as string[]) : [];
  }
  /**
   * network — so'rov serverga yetmadi yoki javob kelmadi (internet, DNS, uzilish);
   * too_large — 413 (server yoki nginx); session — sessiya tugadi (refresh ham o'tmadi);
   * other — qolgani (server xabari bilan yoki klientdagi xato, `client_error`).
   */
  get kind(): ErrorKind {
    if (this.code === "network") return "network";
    if (this.status === 413 || this.code === "file_too_large" || this.code === "payload_too_large") return "too_large";
    if (SESSION_CODES.has(this.code)) return "session";
    return "other";
  }
}

export type ErrorKind = "network" | "too_large" | "session" | "other";

/** Server bilan aloqa yo'q (internet, DNS, timeout) */
export const isNetworkError = (e: unknown) => e instanceof ApiError && e.kind === "network";

/** Foydalanuvchiga ko'rsatiladigan matn: xato turi bo'yicha, aks holda server xabari. */
export function errorText(e: unknown): string {
  if (e instanceof FileTooLargeError) return copy.fileTooLarge;
  if (!(e instanceof ApiError)) {
    console.warn("[api] kutilmagan xato:", e);
    return copy.unknownError;
  }
  switch (e.kind) {
    case "network":
      // "Internet yo'q" yoki yozuvchi amalda — "internetsiz bajarib bo'lmaydi"
      return e.message || copy.networkError;
    case "too_large":
      return copy.fileTooLarge;
    case "session":
      return copy.sessionEnded;
    default:
      return e.message;
  }
}

/**
 * `fetch` tashlagan istisno. Haqiqiy tarmoq xatosi: RN — `TypeError: Network request failed`, expo/fetch —
 * `FetchError: fetch failed: …`. Qolgani (masalan, tanani tayyorlashda xato) — tarmoq EMAS, `client_error`:
 * avval hammasi "Internet yo'q" deb ko'rinardi va asl sabab yo'qolardi.
 */
function thrownByFetch(e: unknown, method: string, path: string): ApiError {
  const message = e instanceof Error ? e.message : String(e);
  const network = /^fetch failed|network request failed|timed? ?out|aborted|unable to resolve|failed to connect/i.test(message);
  console.warn(`[api] ${method} ${path} → ${network ? "tarmoq" : "klient"} xatosi: ${e instanceof Error ? e.name : typeof e}: ${message}`);
  // Yozuvchi amal (saqlash, tasdiqlash…) — "bajarilmadi" deb aniq aytiladi: foydalanuvchi natijani taxmin qilmasin
  if (network) return new ApiError("network", method === "GET" ? copy.networkError : copy.offlineWrite, 0);
  return new ApiError("client_error", copy.unknownError, 0, { cause: message });
}

let tokens: StoredTokens | null = null;
let loaded = false;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

/** Faqat shu kodlar sessiya bilan bog'liq (wrong_password kabi 401'lar emas) */
const SESSION_CODES = new Set(["unauthorized", "token_expired"]);

/** Refresh muddatidan oldin (soat farqi va tarmoq kechikishi uchun zaxira) */
const EXPIRY_SKEW_MS = 30_000;

async function current(): Promise<StoredTokens | null> {
  if (!loaded) {
    tokens = await loadTokens();
    loaded = true;
  }
  return tokens;
}

export async function hasSession(): Promise<boolean> {
  return (await current()) !== null;
}

export async function setTokens(next: StoredTokens): Promise<void> {
  tokens = next;
  loaded = true;
  await saveTokens(next);
}

export async function dropTokens(): Promise<void> {
  tokens = null;
  loaded = true;
  await clearTokens();
}

export function onSignedOut(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function signedOutByServer() {
  await dropTokens();
  listeners.forEach((fn) => fn());
}

const expired = (t: StoredTokens) => !t.accessToken || !(Date.parse(t.accessTokenExpiresAt) - EXPIRY_SKEW_MS > Date.now());

/** Yagona refresh: parallel chaqiruvlar bitta va'dani bo'lishadi. `false` — sessiya tugadi (qaytadan kirish). */
function refreshOnce(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function doRefresh(): Promise<boolean> {
  const t = await current();
  if (!t) return false;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken: t.refreshToken }),
    });
  } catch (e) {
    // Tarmoq xatosi — sessiya tugamagan, keyinroq qayta uriniladi
    throw thrownByFetch(e, "POST", "/auth/refresh");
  }
  if (res.ok) {
    const body = (await res.json()) as { tokens: StoredTokens };
    await setTokens({ accessToken: body.tokens.accessToken, accessTokenExpiresAt: body.tokens.accessTokenExpiresAt, refreshToken: body.tokens.refreshToken });
    return true;
  }
  if (res.status === 401 || res.status === 403) {
    await signedOutByServer();
    return false;
  }
  throw await toError(res);
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string } & Record<string, unknown> };
    if (body.error?.code) {
      const { code, message, ...details } = body.error;
      return new ApiError(code, message ?? copy.unknownError, res.status, details);
    }
  } catch {
    // JSON emas (masalan, nginx sahifasi)
  }
  if (res.status === 413) return new ApiError("payload_too_large", copy.fileTooLarge, 413);
  return new ApiError(res.status >= 500 ? "server_error" : "http_error", copy.unknownError, res.status);
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** multipart (fayl yuklash) — content-type'ni fetch o'zi qo'yadi */
  form?: FormData;
  /** false — tokensiz (kirish, ro'yxat) */
  auth?: boolean;
};

export async function api<T>(path: string, { method = "GET", body, form, auth = true }: Options = {}): Promise<T> {
  let used: string | null = null;
  if (auth) {
    const t = await current();
    if (t && expired(t)) await refreshOnce();
    used = (await current())?.accessToken ?? null;
  }

  const send = (token: string | null) => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    if (!form && body !== undefined) headers["content-type"] = "application/json";
    return fetch(`${API_URL}/api/v1${path}`, { method, headers, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  };

  const attempt = async (token: string | null) => {
    let res: Response;
    try {
      res = await send(token);
    } catch (e) {
      throw thrownByFetch(e, method, path);
    }
    if (form) console.log(`[api] ${method} ${path} → ${res.status}`);
    return res;
  };

  // Oflaynligi aniq bo'lsa yozuvchi so'rov yuborilmaydi (javob kelmay, foydalanuvchi natijani bilmay qolmasin)
  if (method !== "GET" && offlineNow()) throw new ApiError("network", copy.offlineWrite, 0);

  let res = await attempt(used);
  if (res.ok) return (await res.json()) as T;

  let error = await toError(res);
  if (auth && used && SESSION_CODES.has(error.code)) {
    const latest = (await current())?.accessToken ?? null;
    // Boshqa so'rov allaqachon yangilagan bo'lsa — qayta refresh qilinmaydi, yangi token bilan takrorlanadi
    const ok = latest && latest !== used ? true : await refreshOnce();
    if (!ok) {
      console.warn(`[api] ${method} ${path} → sessiya tugadi (refresh rad etildi)`);
      throw new ApiError("unauthorized", copy.sessionEnded, 401);
    }
    res = await attempt((await current())?.accessToken ?? null);
    if (res.ok) return (await res.json()) as T;
    error = await toError(res);
    if (SESSION_CODES.has(error.code)) await signedOutByServer();
  }
  console.warn(`[api] ${method} ${path} → ${error.status} ${error.code} (${error.kind})`);
  throw error;
}
