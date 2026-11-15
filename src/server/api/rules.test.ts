import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bearerToken, passwordFingerprint, rateDecision, refreshTokenHash, seal, unseal } from "./rules";

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
