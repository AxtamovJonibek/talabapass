import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { storage } from "../storage";
import { DAILY_UPLOAD_LIMIT, submitStudentCard, SUPERSEDED_REASON } from "./verification";

const USER = "itest_card_student";
// Haqiqiy fayllar (tozalash ularni qayta kodlaydi); JPEG'da telefon kamerasidagidek GPS bor.
let JPEG: Uint8Array;
let PDF: Uint8Array;
let dir: string;

async function filesOnDisk(): Promise<string[]> {
  try {
    return await readdir(join(dir, "verifications", USER));
  } catch {
    return [];
  }
}

async function setStatus(status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "BLOCKED", cardExpiresAt: Date | null = null) {
  await db.studentProfile.update({ where: { userId: USER }, data: { status, cardExpiresAt } });
}

beforeAll(async () => {
  JPEG = new Uint8Array(
    await sharp({ create: { width: 320, height: 200, channels: 3, background: "#cfa" } })
      .withExif({ IFD0: { Make: "SecretPhoneMaker" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 18/1 0/1" } })
      .jpeg()
      .toBuffer(),
  );
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 100]);
  PDF = await pdf.save();
  // Testlar o'z vaqtinchalik omboriga yozadi — loyihadagi .data ga tegmaydi.
  dir = await mkdtemp(join(tmpdir(), "talabapass-itest-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_LOCAL_DIR = dir;
});

beforeEach(async () => {
  await db.user.deleteMany({ where: { id: USER } });
  await rm(join(dir, "verifications"), { recursive: true, force: true });
  const university = await db.university.findFirstOrThrow();
  await db.user.create({
    data: {
      id: USER, phone: "+998000000401", role: "STUDENT", firstName: "Test", lastName: "Talaba",
      student: { create: { universityId: university.id, course: "C1", publicId: "TP-ITEST-0001" } },
    },
  });
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: USER } });
  await rm(dir, { recursive: true, force: true });
  await db.$disconnect();
});

describe("guvohnoma yuklash", () => {
  it("fayl private omborga yoziladi va talaba tekshiruv navbatiga tushadi", async () => {
    const result = await submitStudentCard(USER, JPEG, "guvohnoma_old.jpg");
    expect(result.ok).toBe(true);

    const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } });
    expect(profile.status).toBe("PENDING");

    const [verification] = await db.verification.findMany({ where: { studentId: USER } });
    expect(verification).toMatchObject({ status: "PENDING", fileName: "guvohnoma_old.jpg", mime: "image/jpeg" });
    expect(verification!.fileKey).toMatch(new RegExp(`^verifications/${USER}/[0-9a-f-]{36}\\.jpg$`));

    // Omborda — tozalangan nusxa: EXIF/GPS yo'q, o'lcham bazadagiga teng
    const stored = (await storage().get(verification!.fileKey))!;
    expect(stored.byteLength).toBe(verification!.fileSize);
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect(Buffer.from(stored).toString("latin1")).not.toContain("SecretPhoneMaker");
  });

  it("saqlash kaliti foydalanuvchi bergan nomga bog'liq emas", async () => {
    await submitStudentCard(USER, PDF, "../../../etc/passwd");
    const verification = await db.verification.findFirstOrThrow({ where: { studentId: USER } });
    expect(verification.fileKey).not.toContain("passwd");
    expect(verification.fileKey).not.toContain("..");
    expect(verification.fileKey.endsWith(".pdf")).toBe(true);
    expect(verification.fileName).toBe("passwd"); // faqat ko'rsatish uchun, yo'lsiz
    expect(await filesOnDisk()).toHaveLength(1);
  });

  it("mazmuni rasm/PDF bo'lmagan fayl rad etiladi va hech narsa saqlanmaydi", async () => {
    const html = Uint8Array.from(Buffer.from("<html><script>alert(1)</script></html>"));
    expect(await submitStudentCard(USER, html, "guvohnoma.jpg")).toEqual({ ok: false, problem: "bad_type" });
    expect(await db.verification.count({ where: { studentId: USER } })).toBe(0);
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } })).status).toBe("DRAFT");
    expect(await filesOnDisk()).toHaveLength(0);
  });

  it("bo'sh va 10 MB dan katta fayl rad etiladi", async () => {
    expect(await submitStudentCard(USER, new Uint8Array(0), "a.jpg")).toEqual({ ok: false, problem: "empty" });
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(await submitStudentCard(USER, big, "a.jpg")).toEqual({ ok: false, problem: "too_large" });
    expect(await filesOnDisk()).toHaveLength(0);
  });

  it("qayta yuklash: oldingi kutayotgan yuklash yopiladi va fayli o'chiriladi", async () => {
    await submitStudentCard(USER, JPEG, "birinchi.jpg");
    const first = await db.verification.findFirstOrThrow({ where: { studentId: USER } });
    await submitStudentCard(USER, PDF, "ikkinchi.pdf");

    const all = await db.verification.findMany({ where: { studentId: USER }, orderBy: { createdAt: "asc" } });
    expect(all.map((v) => [v.fileName, v.status])).toEqual([["birinchi.jpg", "REJECTED"], ["ikkinchi.pdf", "PENDING"]]);
    expect(all[0]!.rejectReason).toBe(SUPERSEDED_REASON);
    expect(await storage().get(first.fileKey)).toBeNull();
    expect(await filesOnDisk()).toHaveLength(1);
  });

  it("tasdiqlangan talaba qayta yuklay olmaydi", async () => {
    await setStatus("APPROVED", new Date("2099-06-30"));
    expect(await submitStudentCard(USER, JPEG, "a.jpg")).toEqual({ ok: false, problem: "not_allowed" });
  });

  it("guvohnoma muddati o'tgan (hali APPROVED deb yozilgan) talaba yangisini yuklay oladi", async () => {
    await setStatus("APPROVED", new Date("2020-06-30"));
    expect((await submitStudentCard(USER, JPEG, "yangi.jpg")).ok).toBe(true);
    expect((await db.studentProfile.findUniqueOrThrow({ where: { userId: USER } })).status).toBe("PENDING");
  });

  it("bloklangan talaba yuklay olmaydi", async () => {
    await setStatus("BLOCKED");
    expect(await submitStudentCard(USER, JPEG, "a.jpg")).toEqual({ ok: false, problem: "not_allowed" });
  });

  it(`kuniga ${DAILY_UPLOAD_LIMIT} tadan ko'p yuklab bo'lmaydi`, async () => {
    for (let i = 0; i < DAILY_UPLOAD_LIMIT; i++) expect((await submitStudentCard(USER, JPEG, `${i}.jpg`)).ok).toBe(true);
    expect(await submitStudentCard(USER, JPEG, "ortiqcha.jpg")).toEqual({ ok: false, problem: "daily_limit" });
    expect(await filesOnDisk()).toHaveLength(1);
  });
});

describe("private ombor", () => {
  it("katalogdan tashqariga chiqadigan kalitlar rad etiladi", async () => {
    for (const key of ["../outside.txt", "verifications/../../outside.txt", "/etc/passwd", "a\\b"]) {
      await expect(storage().put(key, JPEG), key).rejects.toThrow();
      await expect(storage().get(key), key).rejects.toThrow();
    }
  });

  it("mavjud fayl ustidan yozilmaydi", async () => {
    await storage().put("verifications/x/one.jpg", JPEG);
    await expect(storage().put("verifications/x/one.jpg", PDF)).rejects.toThrow();
    expect(await storage().get("verifications/x/one.jpg")).toEqual(JPEG);
  });

  it("yo'q fayl uchun null", async () => {
    expect(await storage().get("verifications/x/yoq.jpg")).toBeNull();
  });
});
