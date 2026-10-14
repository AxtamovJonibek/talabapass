import { describe, expect, it } from "vitest";
import { checkUpload, formatFileSize, isSafeKey, MAX_UPLOAD_BYTES, safeFileName, sniffType } from "./file-rules";

const bytes = (...head: number[]) => Uint8Array.from([...head, 0, 0, 0, 0, 0, 0, 0, 0]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = Uint8Array.from(Buffer.from("%PDF-1.7\n..."));

describe("sniffType", () => {
  it("JPG, PNG va PDF ni mazmunidan taniydi", () => {
    expect(sniffType(JPEG)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(sniffType(PNG)).toEqual({ mime: "image/png", ext: "png" });
    expect(sniffType(PDF)).toEqual({ mime: "application/pdf", ext: "pdf" });
  });

  it("boshqa mazmunni rad etadi — nomi yoki kengaytmasi qanday bo'lishidan qat'i nazar", () => {
    expect(sniffType(Uint8Array.from(Buffer.from("<html><script>alert(1)</script>")))).toBeNull();
    expect(sniffType(Uint8Array.from(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'>")))).toBeNull();
    expect(sniffType(Uint8Array.from(Buffer.from("GIF89a")))).toBeNull();
    expect(sniffType(Uint8Array.from(Buffer.from("MZ\x90\x00")))).toBeNull(); // exe
    expect(sniffType(Uint8Array.from(Buffer.from("PK\x03\x04")))).toBeNull(); // zip/docx
    expect(sniffType(new Uint8Array(0))).toBeNull();
  });
});

describe("checkUpload", () => {
  it("to'g'ri fayl", () => {
    expect(checkUpload(JPEG)).toEqual({ ok: true, type: { mime: "image/jpeg", ext: "jpg" } });
  });

  it("bo'sh, juda katta va noto'g'ri turdagi fayllar", () => {
    expect(checkUpload(new Uint8Array(0))).toEqual({ ok: false, problem: "empty" });
    expect(checkUpload(Uint8Array.from(Buffer.from("salom")))).toEqual({ ok: false, problem: "bad_type" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkUpload(big)).toEqual({ ok: false, problem: "too_large" });
    const edge = new Uint8Array(MAX_UPLOAD_BYTES);
    edge.set([0xff, 0xd8, 0xff]);
    expect(checkUpload(edge).ok).toBe(true);
  });
});

describe("safeFileName", () => {
  it("yo'l qismlarini olib tashlaydi", () => {
    expect(safeFileName("C:\\Users\\dilnoza\\guvohnoma_old.jpg", "x")).toBe("guvohnoma_old.jpg");
    expect(safeFileName("../../etc/passwd", "x")).toBe("passwd");
    expect(safeFileName("/var/tmp/scan.pdf", "x")).toBe("scan.pdf");
  });

  it("xavfli va bo'sh nomlar", () => {
    expect(safeFileName('a<b>:"c|d?.jpg', "x")).toBe("abcd.jpg");
    expect(safeFileName("", "guvohnoma.jpg")).toBe("guvohnoma.jpg");
    expect(safeFileName("..", "guvohnoma.jpg")).toBe("guvohnoma.jpg");
    expect(safeFileName("a".repeat(300) + ".jpg", "x")).toHaveLength(120);
  });
});

describe("isSafeKey", () => {
  it("o'zimiz yaratadigan kalitlar", () => {
    expect(isSafeKey("verifications/cm123abc/cm456def.jpg")).toBe(true);
    expect(isSafeKey("business/307482915/guvohnoma.pdf")).toBe(true);
  });

  it("katalogdan chiqishga urinishlar", () => {
    for (const key of ["../secret", "verifications/../../etc/passwd", "/etc/passwd", "a//b", "a/./b", "C:\\x", "a\\b", "", ".env", "a/.env"]) {
      expect(isSafeKey(key), key).toBe(false);
    }
  });
});

describe("formatFileSize", () => {
  it("dizayndagi ko'rinish", () => {
    expect(formatFileSize(1_887_437)).toBe("1.8 MB");
    expect(formatFileSize(943_718)).toBe("922 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
    expect(formatFileSize(10)).toBe("1 KB");
  });
});
