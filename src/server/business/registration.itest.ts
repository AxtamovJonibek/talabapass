import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { cleanBusinessInfo, createBusinessOwner, removeBusinessDoc, submitBusiness, updateBusinessInfo, uploadBusinessDoc, type CleanInfo } from "./registration";

const PHONE = "+998935559870";
const TIN = "309100001";
let JPEG: Uint8Array;
let PDF: Uint8Array;
let dir: string;
let owner: string;

const parsed = cleanBusinessInfo({
  name: "Itest Kafe",
  kind: "CAFE",
  address: "Bunyodkor ko'chasi 1, Chilonzor",
  workingHours: "09:00 – 22:00",
  description: "",
  tin: "309 100 001",
  contactName: "Itest  Egasi",
});
if (!parsed.ok) throw new Error("sinov ma'lumoti noto'g'ri");
const INFO: CleanInfo = parsed.info;

async function cleanup() {
  await db.business.deleteMany({ where: { OR: [{ tin: TIN }, { owner: { phone: PHONE } }] } });
  await db.auditLog.deleteMany({ where: { actor: { phone: PHONE } } }).catch(() => undefined);
  await db.user.deleteMany({ where: { phone: PHONE } });
}

const business = () => db.business.findFirstOrThrow({ where: { ownerId: owner }, include: { docs: true } });

beforeAll(async () => {
  JPEG = new Uint8Array(
    await sharp({ create: { width: 200, height: 120, channels: 3, background: "#cfa" } })
      .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 18/1 0/1" } })
      .jpeg()
      .toBuffer(),
  );
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 100]);
  PDF = await pdf.save();
  dir = await mkdtemp(join(tmpdir(), "talabapass-itest-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_LOCAL_DIR = dir;
});

beforeEach(async () => {
  await cleanup();
  const created = await createBusinessOwner(PHONE, INFO);
  if (!created.ok) throw new Error(created.error);
  owner = created.userId;
});

afterAll(async () => {
  await cleanup();
  await rm(dir, { recursive: true, force: true });
});

describe("biznes arizasi", () => {
  it("hisob: egasi, a'zolik, tuman manzildan; navbatga hali chiqmaydi", async () => {
    const b = await db.business.findFirstOrThrow({ where: { ownerId: owner }, include: { members: true, district: true, owner: true } });
    expect(b).toMatchObject({ status: "PENDING", submittedAt: null, tin: TIN, contactName: "Itest Egasi", contactPhone: PHONE });
    expect(b.members).toMatchObject([{ userId: owner, role: "OWNER", active: true }]);
    expect(b.district?.name).toBe("Chilonzor");
    expect(b.owner).toMatchObject({ role: "BUSINESS_OWNER", firstName: "Itest", lastName: "Egasi" });
  });

  it("band STIR — ikkinchi hisob ochilmaydi", async () => {
    expect(await createBusinessOwner("+998935559871", INFO)).toEqual({ ok: false, error: "tinTaken" });
    expect(await db.user.count({ where: { phone: "+998935559871" } })).toBe(0);
  });

  it("fayllar: guvohnoma almashtiriladi, foto PDF bo'lmaydi va 3 tadan oshmaydi, EXIF tozalanadi", async () => {
    expect(await uploadBusinessDoc(owner, "registration", PDF, "a.pdf")).toMatchObject({ ok: true });
    expect(await uploadBusinessDoc(owner, "registration", JPEG, "b.jpg")).toMatchObject({ ok: true });
    expect((await business()).docs.filter((d) => d.kind === "REGISTRATION").map((d) => d.fileName)).toEqual(["b.jpg"]);

    expect(await uploadBusinessDoc(owner, "photo", PDF, "zal.pdf")).toEqual({ ok: false, problem: "bad_type" });
    for (const name of ["1.jpg", "2.jpg", "3.jpg"]) expect(await uploadBusinessDoc(owner, "photo", JPEG, name)).toMatchObject({ ok: true });
    expect(await uploadBusinessDoc(owner, "photo", JPEG, "4.jpg")).toEqual({ ok: false, problem: "too_many" });
    expect(await uploadBusinessDoc(owner, "photo", new TextEncoder().encode("<html>"), "x.jpg")).toEqual({ ok: false, problem: "bad_type" });

    const photo = (await business()).docs.find((d) => d.kind === "PHOTO")!;
    const stored = await readFile(join(dir, photo.fileKey));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();

    expect(await removeBusinessDoc(owner, photo.id)).toBe(true);
    expect((await business()).docs.filter((d) => d.kind === "PHOTO")).toHaveLength(2);
  });

  it("logotip — faqat rasm, biznesga yoziladi", async () => {
    expect(await uploadBusinessDoc(owner, "logo", PDF, "logo.pdf")).toEqual({ ok: false, problem: "bad_type" });
    expect(await uploadBusinessDoc(owner, "logo", JPEG, "logo.jpg")).toMatchObject({ ok: true });
    expect((await business()).logoKey).toMatch(/^business\/.+\/logo-.+\.jpg$/);
  });

  it("yuborish: rozilik, guvohnoma va foto shart; keyin o'zgartirib bo'lmaydi", async () => {
    expect(await submitBusiness(owner, false)).toEqual({ ok: false, problem: "consent" });
    expect(await submitBusiness(owner, true)).toEqual({ ok: false, problem: "noRegistration" });
    await uploadBusinessDoc(owner, "registration", PDF, "g.pdf");
    expect(await submitBusiness(owner, true)).toEqual({ ok: false, problem: "noPhotos" });
    await uploadBusinessDoc(owner, "photo", JPEG, "zal.jpg");

    expect(await submitBusiness(owner, true)).toEqual({ ok: true });
    const b = await business();
    expect(b.status).toBe("PENDING");
    expect(b.submittedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "business.submit", entityId: b.id } })).toBe(1);

    // Tekshiruvdagi ariza o'zgarmaydi
    expect(await updateBusinessInfo(owner, { ...INFO, name: "Boshqa" })).toEqual({ ok: false, error: "notEditable" });
    expect(await uploadBusinessDoc(owner, "photo", JPEG, "x.jpg")).toEqual({ ok: false, problem: "not_allowed" });
    expect(await submitBusiness(owner, true)).toEqual({ ok: false, problem: "notEditable" });
  });

  it("rad etilgan ariza tuzatilib qayta yuboriladi", async () => {
    await uploadBusinessDoc(owner, "registration", PDF, "g.pdf");
    await uploadBusinessDoc(owner, "photo", JPEG, "zal.jpg");
    await submitBusiness(owner, true);
    await db.business.updateMany({ where: { ownerId: owner }, data: { status: "REJECTED", rejectReason: "Hujjat o'qilmaydi" } });

    expect(await updateBusinessInfo(owner, { ...INFO, name: "Itest Kafe 2" })).toEqual({ ok: true });
    expect(await uploadBusinessDoc(owner, "registration", JPEG, "yangi.jpg")).toMatchObject({ ok: true });
    expect(await submitBusiness(owner, true)).toEqual({ ok: true });
    expect(await business()).toMatchObject({ status: "PENDING", rejectReason: null, name: "Itest Kafe 2" });
  });
});
