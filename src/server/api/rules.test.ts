import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiLocale, bearerToken, checkFileSignature, fileExpiry, fileSignature, FILE_URL_BUCKET_MS, passwordFingerprint, rateDecision, refreshTokenHash, seal, unseal } from "./rules";

const SECRET = "test-secret-test-secret-test-secret-1234";
const OTHER = "boshqa-sir-boshqa-sir-boshqa-sir-boshqa-1";

describe("muhrlangan token", () => {
  it("ochiladi va ma'lumot hamda muddat qaytadi", () => {
    const token = seal("step", { phone: "+998901234567", step: "login" }, 60_000, SECRET, 1_000);
    expect(unseal("step", token, SECRET)).toEqual({ phone: "+998901234567", step: "login", exp: 61_000 });
  });

  it("ichidagi ma'lumot ochiq ko'rinmaydi", () => {
    const token = seal("register", { phone: "+998901234567", hash: "scrypt:abc" }, 60_000, SECRET);
    expect(Buffer.from(token, "base64url").toString("latin1")).not.toContain("998901234567");
  });

  it("boshqa turdagi token o'rnida ochilmaydi (access ≠ step ≠ register)", () => {
    const access = seal("access", { sid: "s", uid: "u" }, 60_000, SECRET);
    expect(unseal("step", access, SECRET)).toBeNull();
    expect(unseal("register", access, SECRET)).toBeNull();
  });

  it("boshqa sir bilan yoki o'zgartirilgan token ochilmaydi", () => {
    const token = seal("access", { sid: "s", uid: "u" }, 60_000, SECRET);
    expect(unseal("access", token, OTHER)).toBeNull();
    const bytes = Buffer.from(token, "base64url");
    bytes[14] = bytes[14]! ^ 1;
    expect(unseal("access", bytes.toString("base64url"), SECRET)).toBeNull();
    expect(unseal("access", "qisqa", SECRET)).toBeNull();
    expect(unseal("access", `${token}!`, SECRET)).toBeNull();
    expect(unseal("access", `${token}x`, SECRET)).toBeNull();
  });

  it("har safar boshqacha (tasodifiy iv)", () => {
    expect(seal("access", { a: 1 }, 1, SECRET, 0)).not.toBe(seal("access", { a: 1 }, 1, SECRET, 0));
  });
});

describe("Accept-Language", () => {
  it("ilova tanlagan til, mos kelmasa — uz", () => {
    expect(apiLocale("ru")).toBe("ru");
    expect(apiLocale("en-US,en;q=0.9")).toBe("en");
    expect(apiLocale("de-DE, ru;q=0.8")).toBe("ru");
    expect(apiLocale("fr")).toBe("uz");
    expect(apiLocale(null)).toBe("uz");
  });
});

describe("bearer va xeshlar", () => {
  it("Authorization sarlavhasidan token", () => {
    expect(bearerToken("Bearer abc.DEF_-1")).toBe("abc.DEF_-1");
    expect(bearerToken("bearer   xyz")).toBe("xyz");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });

  it("refresh token xeshi sayt cookie xeshidan farq qiladi (bir-birining o'rnida ishlamaydi)", () => {
    const token = "tasodifiy-token";
    expect(refreshTokenHash(token)).not.toBe(createHash("sha256").update(token).digest("hex"));
    expect(refreshTokenHash(token)).toBe(refreshTokenHash(token));
  });

  it("parol izi xesh o'zgarsa o'zgaradi", () => {
    expect(passwordFingerprint(null)).toBe(passwordFingerprint(null));
    expect(passwordFingerprint("scrypt:a")).not.toBe(passwordFingerprint("scrypt:b"));
    expect(passwordFingerprint("scrypt:a")).not.toBe(passwordFingerprint(null));
  });
});

describe("so'rov chegarasi", () => {
  const now = new Date(1_000_000);
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("chegaragacha o'tadi, keyin eng eskisi oynadan chiqquncha rad", () => {
    expect(rateDecision([ago(10), ago(20)], now, 3, 1000)).toEqual({ ok: true });
    expect(rateDecision([ago(100), ago(10), ago(20)], now, 3, 1000)).toEqual({ ok: false, retryInMs: 900 });
  });

  it("oynadan tashqaridagi urinishlar hisoblanmaydi", () => {
    expect(rateDecision([ago(5000), ago(4000), ago(10)], now, 2, 1000)).toEqual({ ok: true });
  });
});

describe("imzoli fayl havolasi", () => {
  const H = FILE_URL_BUCKET_MS;
  const now = 10 * H + 25 * 60_000;

  it("muddat soat boshiga yaxlit: bir soat ichida bir xil, 1–2 soat amal qiladi", () => {
    expect(fileExpiry(now)).toBe(fileExpiry(10 * H));
    expect(fileExpiry(now) * 1000).toBe(12 * H);
    expect(fileExpiry(11 * H)).not.toBe(fileExpiry(now));
  });

  it("to'g'ri imzo o'tadi; boshqa fayl, tur, sir yoki muddat — yo'q", () => {
    const exp = fileExpiry(now);
    const sig = fileSignature("logo", "abc123def456", exp, SECRET);
    expect(checkFileSignature("logo", "abc123def456", exp, sig, SECRET, now)).toBe(true);
    expect(checkFileSignature("logo", "abc123def457", exp, sig, SECRET, now)).toBe(false);
    expect(checkFileSignature("avatar", "abc123def456", exp, sig, SECRET, now)).toBe(false);
    expect(checkFileSignature("logo", "abc123def456", exp, fileSignature("logo", "abc123def456", exp, OTHER), SECRET, now)).toBe(false);
    expect(checkFileSignature("logo", "abc123def456", exp + 3600, sig, SECRET, now)).toBe(false);
  });

  it("muddati o'tgan yoki juda uzoq muddatli havola rad etiladi", () => {
    const exp = fileExpiry(now);
    const sig = fileSignature("logo", "abc123def456", exp, SECRET);
    expect(checkFileSignature("logo", "abc123def456", exp, sig, SECRET, exp * 1000)).toBe(false);
    const far = exp + 24 * 3600;
    expect(checkFileSignature("logo", "abc123def456", far, fileSignature("logo", "abc123def456", far, SECRET), SECRET, now)).toBe(false);
  });
});
