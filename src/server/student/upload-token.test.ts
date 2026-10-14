import { describe, expect, it } from "vitest";
import { createUploadToken, readUploadToken, UPLOAD_TOKEN_TTL_MS } from "./upload-token";

const SECRET = "s".repeat(40);
const now = new Date("2026-10-14T10:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);

describe("telefonga o'tish tokeni", () => {
  it("o'z egasini qaytaradi", () => {
    expect(readUploadToken(createUploadToken("user_1", SECRET, now), SECRET, now)).toBe("user_1");
  });

  it("15 daqiqadan keyin eskiradi", () => {
    const token = createUploadToken("user_1", SECRET, now);
    expect(readUploadToken(token, SECRET, later(UPLOAD_TOKEN_TTL_MS - 1))).toBe("user_1");
    expect(readUploadToken(token, SECRET, later(UPLOAD_TOKEN_TTL_MS))).toBeNull();
  });

  it("o'zgartirilgan token rad etiladi", () => {
    const token = createUploadToken("user_1", SECRET, now);
    const [, expires, mac] = token.split(".");
    expect(readUploadToken(`user_2.${expires}.${mac}`, SECRET, now), "boshqa foydalanuvchi").toBeNull();
    expect(readUploadToken(`user_1.${(parseInt(expires!, 36) + 3600).toString(36)}.${mac}`, SECRET, now), "uzaytirilgan muddat").toBeNull();
    expect(readUploadToken(token.slice(0, -2) + "xx", SECRET, now), "buzilgan imzo").toBeNull();
  });

  it("boshqa sir bilan imzolangan token rad etiladi", () => {
    expect(readUploadToken(createUploadToken("user_1", "boshqa-sir".repeat(4), now), SECRET, now)).toBeNull();
  });

  it("QR kodga sig'adigan darajada qisqa", () => {
    expect(createUploadToken("cmg0x1y2z0000abcd1234efgh", SECRET, now).length).toBeLessThanOrEqual(50);
  });

  it("yaroqsiz kirish", () => {
    for (const bad of ["", ".", "abc", "a.b", "..", "user_1.notanumber.sig"]) expect(readUploadToken(bad, SECRET, now), bad).toBeNull();
  });
});
