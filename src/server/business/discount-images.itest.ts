import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { toTashkent } from "@/lib/time";
import { db } from "../db";
import { storage } from "../storage";
import { DISCOUNT_IMAGES_MAX, readDiscountImage, removeDiscountImage, uploadDiscountImage } from "./discount-images";

const PHONES = ["+998935559870", "+998935559871"];
const TINS = ["309109870", "309109871"];
const DAY_MS = 86_400_000;
let owner: string;
let other: string;
let businessId: string;
let discountId: string;
let jpeg: Uint8Array;

async function cleanup() {
  const images = await db.discountImage.findMany({ where: { discount: { business: { tin: { in: TINS } } } }, select: { fileKey: true } });
  await Promise.all(images.map((i) => storage().delete(i.fileKey).catch(() => undefined)));
  await db.business.deleteMany({ where: { tin: { in: TINS } } });
  await db.user.deleteMany({ where: { phone: { in: PHONES } } });
}

beforeAll(async () => {
  // EXIF bilan rasm: tozalashdan keyin qolmasligi kerak
  jpeg = new Uint8Array(
    await sharp({ create: { width: 64, height: 48, channels: 3, background: "#F4DCCB" } })
      .jpeg()
      .withExif({ IFD0: { Artist: "maxfiy-muallif" } })
      .toBuffer(),
  );
});

beforeEach(async () => {
  await cleanup();
  const today = toTashkent(new Date()).date;
  const [a, b] = await Promise.all(PHONES.map((phone) => db.user.create({ data: { phone, role: "BUSINESS_OWNER" } })));
  owner = a!.id;
  other = b!.id;
  const category = await db.category.findFirstOrThrow({ where: { slug: "taom" } });
  const business = await db.business.create({
    data: { ownerId: owner, name: "Itest Rasm", tin: TINS[0], kind: "CAFE", address: "Bunyodkor 1", workingHours: "09–22", status: "APPROVED", submittedAt: new Date() },
  });
  await db.business.create({ data: { ownerId: other, name: "Begona", tin: TINS[1], kind: "CAFE", address: "X", workingHours: "09–22", status: "APPROVED", submittedAt: new Date() } });
  businessId = business.id;
  const discount = await db.discount.create({
    data: {
      businessId,
      categoryId: category.id,
      title: "Itest rasmli",
      type: "PERCENT",
      originalPrice: 38000,
      percent: 30,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      fromMinute: 0,
      toMinute: 1439,
      dailyLimit: 10,
      startsOn: new Date(today.getTime() - DAY_MS),
      endsOn: new Date(today.getTime() + 10 * DAY_MS),
      status: "DRAFT",
    },
  });
  discountId = discount.id;
});
afterAll(cleanup);

describe("chegirma rasmlari", () => {
  it("rasm tozalanib saqlanadi (EXIF qolmaydi), 4 tadan ortig'i rad etiladi", async () => {
    const first = await uploadDiscountImage(owner, discountId, jpeg);
    expect(first.ok).toBe(true);
    const stored = await db.discountImage.findFirstOrThrow({ where: { discountId } });
    const bytes = await storage().get(stored.fileKey);
    expect(Buffer.from(bytes!).includes(Buffer.from("maxfiy-muallif"))).toBe(false);
    expect(stored.fileKey).toMatch(new RegExp(`^discounts/${discountId}/[0-9a-f-]+\\.jpg$`));

    for (let i = 1; i < DISCOUNT_IMAGES_MAX; i++) expect((await uploadDiscountImage(owner, discountId, jpeg)).ok).toBe(true);
    expect(await uploadDiscountImage(owner, discountId, jpeg)).toEqual({ ok: false, problem: "too_many" });
  });

  it("PDF va buzilgan fayl — bad_type; begona biznes egasi — not_allowed", async () => {
    expect(await uploadDiscountImage(owner, discountId, new TextEncoder().encode("%PDF-1.4\n%%EOF"))).toEqual({ ok: false, problem: "bad_type" });
    expect(await uploadDiscountImage(owner, discountId, new Uint8Array([0xff, 0xd8, 0xff, 0x00, 1, 2, 3]))).toEqual({ ok: false, problem: "bad_type" });
    expect(await uploadDiscountImage(other, discountId, jpeg)).toEqual({ ok: false, problem: "not_allowed" });
  });

  it("tasdiqlangan chegirmaga rasm qo'shilsa yoki o'chirilsa — qayta tekshiruvga", async () => {
    await db.discount.update({ where: { id: discountId }, data: { status: "ACTIVE" } });
    const uploaded = await uploadDiscountImage(owner, discountId, jpeg);
    expect((await db.discount.findUniqueOrThrow({ where: { id: discountId } })).status).toBe("PENDING_REVIEW");

    await db.discount.update({ where: { id: discountId }, data: { status: "ACTIVE" } });
    if (!uploaded.ok) throw new Error("upload");
    expect(await removeDiscountImage(other, uploaded.id)).toBe(false);
    expect(await removeDiscountImage(owner, uploaded.id)).toBe(true);
    expect((await db.discount.findUniqueOrThrow({ where: { id: discountId } })).status).toBe("PENDING_REVIEW");
    expect(await db.discountImage.count({ where: { discountId } })).toBe(0);
  });

  it("ko'rish: talabaga ko'rinadigan chegirmaniki — hammaga; aks holda faqat egasi va admin", async () => {
    const uploaded = await uploadDiscountImage(owner, discountId, jpeg);
    if (!uploaded.ok) throw new Error("upload");
    // DRAFT: begona ko'rmaydi, egasi va admin ko'radi
    expect(await readDiscountImage(uploaded.id, null)).toBeNull();
    expect(await readDiscountImage(uploaded.id, { id: other, role: "BUSINESS_OWNER" })).toBeNull();
    expect((await readDiscountImage(uploaded.id, { id: owner, role: "BUSINESS_OWNER" }))?.public).toBe(false);
    expect(await readDiscountImage(uploaded.id, { id: "admin", role: "ADMIN" })).not.toBeNull();

    await db.discount.update({ where: { id: discountId }, data: { status: "ACTIVE" } });
    const visible = await readDiscountImage(uploaded.id, null);
    expect(visible?.public).toBe(true);
    expect(visible?.mime).toBe("image/jpeg");

    // Biznes bloklansa — yana yopiq
    await db.business.update({ where: { id: businessId }, data: { status: "BLOCKED" } });
    expect(await readDiscountImage(uploaded.id, null)).toBeNull();
  });
});
