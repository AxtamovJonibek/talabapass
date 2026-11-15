import { copy } from "@/copy";
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
}

/** Server bilan aloqa yo'q (internet, DNS, timeout) */
export const isNetworkError = (e: unknown) => e instanceof ApiError && e.code === "network";

/** Foydalanuvchiga ko'rsatiladigan matn: server xabari yoki umumiy. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return copy.unknownError;
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
  } catch {
    // Tarmoq xatosi — sessiya tugamagan, keyinroq qayta uriniladi
    throw new ApiError("network", copy.networkError, 0);
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
    // JSON emas (masalan, proksi sahifasi)
  }
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

  let res: Response;
  try {
    res = await send(used);
  } catch {
    throw new ApiError("network", copy.networkError, 0);
  }
  if (res.ok) return (await res.json()) as T;

  let error = await toError(res);
  if (auth && used && SESSION_CODES.has(error.code)) {
    const latest = (await current())?.accessToken ?? null;
    // Boshqa so'rov allaqachon yangilagan bo'lsa — qayta refresh qilinmaydi, yangi token bilan takrorlanadi
    const ok = latest && latest !== used ? true : await refreshOnce();
    if (!ok) throw new ApiError("unauthorized", copy.sessionEnded, 401);
    try {
      res = await send((await current())?.accessToken ?? null);
    } catch {
      throw new ApiError("network", copy.networkError, 0);
    }
    if (res.ok) return (await res.json()) as T;
    error = await toError(res);
    if (SESSION_CODES.has(error.code)) await signedOutByServer();
  }
  throw error;
}
