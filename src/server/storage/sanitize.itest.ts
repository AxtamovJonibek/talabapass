import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sanitizeDocument, UnreadableFileError } from "./sanitize";

/** GPS, qurilma va muallif ma'lumotlari yozilgan haqiqiy rasm (telefon kamerasidagidek). */
async function photoWithGps(format: "jpeg" | "png", width = 400, height = 200, orientation?: number): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .withExif({
      IFD0: { Make: "SecretPhoneMaker", Model: "Model-X-Private", Artist: "Dilnoza Karimova" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 18/1 3600/100", GPSLongitudeRef: "E", GPSLongitude: "69/1 14/1 2400/100" },
    })
    .withMetadata(orientation ? { orientation } : {});
  return new Uint8Array(await (format === "jpeg" ? image.jpeg() : image.png()).toBuffer());
}

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

/** PDF satrlari oddiy matn yoki UTF-16BE hex (<FEFF…>) ko'rinishida yozilishi mumkin — ikkalasi ham qidiriladi. */
function pdfContains(bytes: Uint8Array, value: string): boolean {
  const raw = text(bytes);
  const hex = Buffer.from(value, "utf16le").swap16().toString("hex");
  return raw.includes(value) || raw.toLowerCase().includes(hex);
}

describe("rasmlar: qayta kodlash va metama'lumotni olib tashlash", () => {
  it("manba rasmda haqiqatan GPS va qurilma ma'lumoti bor (testning o'zi to'g'riligi)", async () => {
    const source = await photoWithGps("jpeg");
    const meta = await sharp(source).metadata();
    expect(meta.exif).toBeDefined();
    expect(text(source)).toContain("SecretPhoneMaker");
  });

  it("JPEG: EXIF, GPS, qurilma va muallif to'liq yo'qoladi", async () => {
    const clean = await sanitizeDocument(await photoWithGps("jpeg"), { mime: "image/jpeg", ext: "jpg" });
    expect(clean.mime).toBe("image/jpeg");
    const meta = await sharp(clean.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(meta.iptc).toBeUndefined();
    const raw = text(clean.bytes);
    for (const leak of ["Exif", "SecretPhoneMaker", "Model-X-Private", "Dilnoza", "GPS"]) expect(raw, leak).not.toContain(leak);
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(200);
  });

  it("PNG: EXIF bo'lagi (eXIf) ham olib tashlanadi, format saqlanadi", async () => {
    const source = await photoWithGps("png");
    expect(text(source)).toContain("SecretPhoneMaker");
    const clean = await sanitizeDocument(source, { mime: "image/png", ext: "png" });
    expect(clean.mime).toBe("image/png");
    expect((await sharp(clean.bytes).metadata()).exif).toBeUndefined();
    for (const leak of ["eXIf", "SecretPhoneMaker", "Dilnoza"]) expect(text(clean.bytes), leak).not.toContain(leak);
  });

  it("telefon aylantirgan rasm (orientation=6) to'g'ri holatga keltiriladi — yo'nalish belgisi qolmaydi", async () => {
    const clean = await sanitizeDocument(await photoWithGps("jpeg", 400, 200, 6), { mime: "image/jpeg", ext: "jpg" });
    const meta = await sharp(clean.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([200, 400]);
    expect(meta.orientation).toBeUndefined();
  });

  it("juda katta rasm 2560px gacha kichraytiriladi", async () => {
    const big = new Uint8Array(await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#fff" } }).jpeg().toBuffer());
    const meta = await sharp((await sanitizeDocument(big, { mime: "image/jpeg", ext: "jpg" })).bytes).metadata();
    expect([meta.width, meta.height]).toEqual([2560, 1920]);
  });

  it("siqilganda kichik, ochilganda ulkan rasm (50 Mpx dan katta) rad etiladi", async () => {
    const bomb = new Uint8Array(await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#000" } }).jpeg({ quality: 10 }).toBuffer());
    expect(bomb.byteLength).toBeLessThan(10 * 1024 * 1024);
    await expect(sanitizeDocument(bomb, { mime: "image/jpeg", ext: "jpg" })).rejects.toBeInstanceOf(UnreadableFileError);
  });

  it("boshi JPEG, ichi buzilgan fayl rad etiladi", async () => {
    const broken = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]);
    await expect(sanitizeDocument(broken, { mime: "image/jpeg", ext: "jpg" })).rejects.toBeInstanceOf(UnreadableFileError);
  });

  it("HEIC sarlavhali, lekin o'qib bo'lmaydigan fayl rad etiladi", async () => {
    const fake = Uint8Array.from([0, 0, 0, 0x18, ...Buffer.from("ftypheic"), 0, 0, 0, 0, ...Buffer.from("not really heic")]);
    await expect(sanitizeDocument(fake, { mime: "image/heic", ext: "heic" })).rejects.toBeInstanceOf(UnreadableFileError);
  });
});

describe("PDF: hujjat ma'lumotlari", () => {
  async function pdfWithMetadata(): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 100]).drawText("TALABA GUVOHNOMASI", { x: 10, y: 50, size: 12 });
    pdf.setTitle("Shaxsiy hujjat");
    pdf.setAuthor("Dilnoza Karimova");
    pdf.setCreator("SecretScannerApp");
    pdf.setProducer("SecretProducer 1.0");
    pdf.setKeywords(["pasport", "guvohnoma"]);
    return pdf.save({ useObjectStreams: false });
  }

  it("muallif, nom, dastur va kalit so'zlar olib tashlanadi, sahifalar saqlanadi", async () => {
    const source = await pdfWithMetadata();
    expect(pdfContains(source, "SecretScannerApp")).toBe(true);
    const clean = await sanitizeDocument(source, { mime: "application/pdf", ext: "pdf" });
    expect(clean.mime).toBe("application/pdf");

    const doc = await PDFDocument.load(clean.bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getCreator()).toBeUndefined();
    for (const leak of ["Dilnoza", "SecretScannerApp", "SecretProducer", "pasport"]) expect(pdfContains(clean.bytes, leak), leak).toBe(false);
  });

  it("buzilgan PDF rad etiladi", async () => {
    await expect(sanitizeDocument(Uint8Array.from(Buffer.from("%PDF-1.7\nbuzuq")), { mime: "application/pdf", ext: "pdf" })).rejects.toBeInstanceOf(UnreadableFileError);
  });
});
