import { describe, expect, it } from "vitest";
import { fromBase64Url, normalizeCouponCode, parseQr, qrToken, secondsLeftInWindow, toBase64Url, totpCode, verifyCode, verifyQr, windowAt } from "./totp";

const SECRET = new Uint8Array(Array.from({ length: 20 }, (_, i) => i * 13 + 7));
const OTHER = new Uint8Array(20).fill(9);
const CODE = "TP-7K3Q-92XD";
const NOW = Date.UTC(2026, 9, 13, 9, 31, 20); // 14:31:20 Toshkent

describe("RFC 6238 (SHA-256) — 6 raqamli kod standart bo'yicha", () => {
  // RFC 6238 ilova B: 32 baytli ASCII kalit, 30 s qadam → hisoblagich; 8 raqamning oxirgi 6 tasi
  const rfcKey = new TextEncoder().encode("12345678901234567890123456789012");
  it.each([
    [59, "119246"],
    [1111111109, "084774"],
    [1234567890, "819424"],
  ])("T=%i → %s", async (t, expected) => {
    expect(await totpCode(rfcKey, Math.floor(t / 30))).toBe(expected);
  });
});

describe("QR tokeni", () => {
  it("format: kod.oyna.128 bit; parse teskari amal", async () => {
    const token = await qrToken(CODE, SECRET, windowAt(NOW));
    expect(token).toMatch(/^TP-7K3Q-92XD\.\d+\.[A-Za-z0-9_-]{22}$/);
    expect(parseQr(token)).toEqual({ code: CODE, window: windowAt(NOW), tag: token.split(".")[2] });
  });

  it("klient va server bir xil token hisoblaydi (bitta kod, deterministik)", async () => {
    const w = windowAt(NOW);
    expect(await qrToken(CODE, SECRET, w)).toBe(await qrToken(CODE, Uint8Array.from(SECRET), w));
    expect(await totpCode(SECRET, w)).toBe(await totpCode(fromBase64Url(toBase64Url(SECRET)), w));
  });

  it("joriy oyna va ±1 qabul qilinadi", async () => {
    for (const shift of [-1, 0, 1]) {
      const parsed = parseQr(await qrToken(CODE, SECRET, windowAt(NOW) + shift))!;
      expect(await verifyQr(parsed, SECRET, NOW), String(shift)).toBe("ok");
    }
  });

  it("eskirgan oyna (2 daqiqa oldingi skrinshot) — stale", async () => {
    const parsed = parseQr(await qrToken(CODE, SECRET, windowAt(NOW) - 2))!;
    expect(await verifyQr(parsed, SECRET, NOW)).toBe("stale");
    const future = parseQr(await qrToken(CODE, SECRET, windowAt(NOW) + 2))!;
    expect(await verifyQr(future, SECRET, NOW)).toBe("stale");
  });

  it("noto'g'ri secret yoki o'zgartirilgan imzo/kod — invalid", async () => {
    const forged = parseQr(await qrToken(CODE, OTHER, windowAt(NOW)))!;
    expect(await verifyQr(forged, SECRET, NOW)).toBe("invalid");
    const token = await qrToken(CODE, SECRET, windowAt(NOW));
    // Boshqa kupon kodiga ko'chirilgan imzo
    expect(await verifyQr(parseQr(token.replace(CODE, "TP-7K3Q-92XE"))!, SECRET, NOW)).toBe("invalid");
  });

  it("format noto'g'ri — parse null", () => {
    for (const bad of ["", "TP-7K3Q-92XD", "TP-7K3Q-92XD.1.short", "https://example.com", "TP-0000-0000.1.AAAAAAAAAAAAAAAAAAAAAA"]) {
      expect(parseQr(bad), bad).toBeNull();
    }
  });
});

describe("6 raqamli kod", () => {
  it("joriy va ±1 oyna kodi o'tadi, 2 oyna oldingisi yo'q", async () => {
    const w = windowAt(NOW);
    for (const shift of [-1, 0, 1]) expect(await verifyCode(await totpCode(SECRET, w + shift), SECRET, NOW)).toBe(true);
    const old = await totpCode(SECRET, w - 2);
    const neighbours = await Promise.all([-1, 0, 1].map((s) => totpCode(SECRET, w + s)));
    if (!neighbours.includes(old)) expect(await verifyCode(old, SECRET, NOW)).toBe(false);
  });

  it("6 ta raqamdan boshqa narsa rad etiladi; boshqa secret — rad", async () => {
    const code = await totpCode(SECRET, windowAt(NOW));
    for (const bad of ["", code.slice(0, 5), `${code}0`, `${code.slice(0, 3)} ${code.slice(3)}`, "abcdef"]) {
      expect(await verifyCode(bad, SECRET, NOW), bad).toBe(false);
    }
    expect(await verifyCode(code, OTHER, NOW)).toBe(false);
  });
});

describe("yordamchilar", () => {
  it("kupon kodi qo'lda kiritilganda bir xil ko'rinishga", () => {
    expect(normalizeCouponCode("tp 7k3q 92xd")).toBe(CODE);
    expect(normalizeCouponCode("7K3Q92XD")).toBe(CODE);
    expect(normalizeCouponCode(" TP-7K3Q-92XD ")).toBe(CODE);
  });

  it("oyna tugashiga qolgan soniya", () => {
    expect(secondsLeftInWindow(NOW)).toBe(40);
  });

  it("base64url ikki tomonga", () => {
    expect(fromBase64Url(toBase64Url(SECRET))).toEqual(SECRET);
  });
});
