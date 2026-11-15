import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Mobil API (`/api/v1`) qoidalari — sof funksiyalar (bazasiz), testlar bilan (`rules.test.ts`).
 *
 * Muhrlangan token: AES-256-GCM, kalit server siridan; token turi (`access`, `step`, `register`) AAD sifatida —
 * bir turdagi token boshqa tur o'rnida ochilmaydi. Ichidagi ma'lumot (telefon, parol xeshi) mijozga ko'rinmaydi.
 */

export type SealKind = "access" | "step" | "register";

const keyOf = (secret: string) => createHash("sha256").update(`tp-api-seal:${secret}`).digest();

export function seal(kind: SealKind, data: Record<string, unknown>, ttlMs: number, secret: string, now = Date.now()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv);
  cipher.setAAD(Buffer.from(kind));
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...data, exp: now + ttlMs })), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** Imzo to'g'ri bo'lsa — ma'lumot va muddat (`exp`, ms); buzilgan, boshqa turdagi yoki boshqa sir bilan — null. */
export function unseal(kind: SealKind, token: string, secret: string): (Record<string, unknown> & { exp: number }) | null {
  if (!/^[A-Za-z0-9_-]{40,2000}$/.test(token)) return null;
  const buf = Buffer.from(token, "base64url");
  // Faqat kanonik ko'rinish: dekoder ortiqcha oxirgi belgini jimgina tashlab yuboradi
  if (buf.length < 12 + 16 + 2 || buf.toString("base64url") !== token) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), buf.subarray(0, 12));
    decipher.setAAD(Buffer.from(kind));
    decipher.setAuthTag(buf.subarray(buf.length - 16));
    const json = Buffer.concat([decipher.update(buf.subarray(12, buf.length - 16)), decipher.final()]).toString("utf8");
    const data = JSON.parse(json) as Record<string, unknown>;
    return typeof data.exp === "number" ? (data as Record<string, unknown> & { exp: number }) : null;
  } catch {
    return null;
  }
}

/** `Authorization: Bearer <token>` → token. */
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return m ? m[1]! : null;
}

/**
 * Refresh token bazada faqat xesh. Prefiks sayt sessiyasidan (cookie tokenining sof SHA-256'i) farq qiladi:
 * refresh token cookie sifatida, cookie esa refresh token sifatida ishlamaydi.
 */
export const refreshTokenHash = (token: string) => createHash("sha256").update(`api-refresh:${token}`).digest("hex");

/** Parol o'zgarsa eski qadam tokenlari yaroqsiz bo'lishi uchun — xeshning qisqa izi. */
export const passwordFingerprint = (hash: string | null) => createHash("sha256").update(`pw:${hash ?? "-"}`).digest("base64url").slice(0, 16);

export type RateDecision = { ok: true } | { ok: false; retryInMs: number };

/** Oxirgi `windowMs` ichidagi urinishlar `max` ga yetgan bo'lsa — rad (eng eskisi oynadan chiqquncha). */
export function rateDecision(hits: Date[], now: Date, max: number, windowMs: number): RateDecision {
  const at = now.getTime();
  const recent = hits.map((d) => d.getTime()).filter((t) => t > at - windowMs).sort((a, b) => a - b);
  if (recent.length < max) return { ok: true };
  return { ok: false, retryInMs: recent[recent.length - max]! + windowMs - at };
}
