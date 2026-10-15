import { describe, expect, it } from "vitest";
import { ADMIN_UNLOCK_TTL_MS, checkAdminUnlock, hashAdminPassword, isAdminPasswordHash, normalizeAdminHash, signAdminUnlock, verifyAdminPassword } from "./admin-password";

const SECRET = "s".repeat(43);
const SESSION = "a".repeat(64);

describe("admin paroli (xesh)", () => {
  const stored = hashAdminPassword("to'g'ri-parol-2026");

  it("xesh parolni o'z ichida saqlamaydi va har safar boshqa (tuz)", () => {
    expect(stored).not.toContain("parol");
    expect(isAdminPasswordHash(stored)).toBe(true);
    expect(hashAdminPassword("to'g'ri-parol-2026")).not.toBe(stored);
  });

  it("faqat to'g'ri parol qabul qilinadi", () => {
    expect(verifyAdminPassword("to'g'ri-parol-2026", stored)).toBe(true);
    for (const wrong of ["", "   ", "to'g'ri-parol-2027", "TO'G'RI-PAROL-2026"]) {
      expect(verifyAdminPassword(wrong, stored), wrong).toBe(false);
    }
  });

  it("xesh yo'q yoki buzilgan bo'lsa hech qanday parol o'tmaydi (yopiq holat)", () => {
    for (const bad of [undefined, "", "parol", stored.replace(/^scrypt/, "bcrypt"), stored.slice(0, -5), stored.replaceAll(":", "$")]) {
      expect(verifyAdminPassword("to'g'ri-parol-2026", bad), String(bad)).toBe(false);
    }
  });

  it("parol chetidagi bo'shliq hisobga olinmaydi (xesh skripti ham kesadi)", () => {
    expect(verifyAdminPassword(" to'g'ri-parol-2026\n", stored)).toBe(true);
  });

  // Staging'dagi "Parol noto'g'ri": Vercel/terminaldan nusxalangan qiymat (prefiks, qo'shtirnoq, satr bo'linishi)
  it("env qiymatidagi nusxalash qoldiqlari tozalanadi", () => {
    const wrapped = `${stored.slice(0, 40)}\r\n  ${stored.slice(40)}`;
    for (const raw of [`ADMIN_PASSWORD_HASH=${stored}`, `"${stored}"`, `'${stored}'`, ` ${stored}\n`, wrapped, `ADMIN_PASSWORD_HASH="${stored}"`, `"ADMIN_PASSWORD_HASH=${stored}"`]) {
      expect(normalizeAdminHash(raw), raw).toBe(stored);
      expect(verifyAdminPassword("to'g'ri-parol-2026", raw), raw).toBe(true);
    }
  });

  it(".env.development dagi lokal xesh e2e paroli bilan mos", () => {
    expect(verifyAdminPassword("dev-admin-parol", "scrypt:16384:8:1:ZGV2LWFkbWluLXNhbHQtMQ:UaXHTbK_sJOPbPpLSwKM2dsa7eoGrid7HrgGPCiyYJ8")).toBe(true);
  });
});

describe("admin ochilgan cookie'si", () => {
  const now = 1_800_000_000_000;
  const value = signAdminUnlock(SECRET, SESSION, now);

  it("shu sessiya uchun muddati ichida yaroqli", () => {
    expect(checkAdminUnlock(SECRET, SESSION, value, now)).toBe(true);
    expect(checkAdminUnlock(SECRET, SESSION, value, now + ADMIN_UNLOCK_TTL_MS - 1)).toBe(true);
  });

  it("muddati o'tsa yaroqsiz", () => {
    expect(checkAdminUnlock(SECRET, SESSION, value, now + ADMIN_UNLOCK_TTL_MS)).toBe(false);
  });

  it("boshqa sessiyaga (qayta kirish, boshqa qurilma) yoki boshqa sirga o'tmaydi", () => {
    expect(checkAdminUnlock(SECRET, "b".repeat(64), value, now)).toBe(false);
    expect(checkAdminUnlock("x".repeat(43), SESSION, value, now)).toBe(false);
  });

  it("qalbaki yoki o'zgartirilgan qiymat rad etiladi", () => {
    const [expires, mac] = value.split(".");
    for (const forged of [undefined, "", "1", `${Number(expires) + 1}.${mac}`, `${expires}.${mac}x`, `${expires}.`, `abc.${mac}`]) {
      expect(checkAdminUnlock(SECRET, SESSION, forged, now), String(forged)).toBe(false);
    }
  });
});
