import { expect, test } from "@playwright/test";
import { codeBox, clearOtp, enterCode, FIXED_CODE, requestCode, seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

let phones: SeedPhones;

test.beforeAll(async () => {
  phones = await seedPhones();
});

const HOME = { student: "/chegirmalar", owner: "/biznes", cashier: "/biznes/skaner", admin: "/admin/talabalar" } as const;
const AREA = { student: "Talaba ilovasi", owner: "Biznes kabineti", cashier: "Kassir skaneri", admin: "Admin panel" } as const;

test.describe("kirish", () => {
  for (const role of ["student", "owner", "cashier", "admin"] as const) {
    test(`${role} kiradi va o'z bosh sahifasiga tushadi`, async ({ page }) => {
      await signIn(page, phones[role]);
      await expect(page).toHaveURL(HOME[role]);
      if (role === "admin") await expect(page.getByRole("heading", { name: "Talabalar tekshiruvi" })).toBeVisible();
      else await expect(page.getByTestId("area")).toHaveText(AREA[role]);
    });
  }

  test("admin: /admin tekshiruvga yo'naltiradi, tayyor bo'lmagan bo'limlar xira va bosilmaydi", async ({ page }) => {
    await signIn(page, phones.admin);
    await expect(page).toHaveURL(HOME.admin);
    await page.goto("/admin");
    await expect(page).toHaveURL("/admin/talabalar");
    const nav = page.getByRole("navigation", { name: "Admin menyu" });
    for (const name of ["Umumiy", "Tranzaksiyalar", "Bildirishnomalar"]) {
      await expect(nav.getByText(name)).toHaveAttribute("aria-disabled", "true");
      await expect(nav.getByRole("link", { name })).toHaveCount(0);
    }
    await nav.getByRole("link", { name: /Bizneslar/ }).click();
    await expect(page).toHaveURL("/admin/bizneslar");
    await expect(nav.getByRole("link", { name: /Talabalar tekshiruvi/ })).toBeVisible();
  });

  test("admin panelidan chiqish", async ({ page }) => {
    await signIn(page, phones.admin);
    await expect(page).toHaveURL(HOME.admin);
    await page.getByRole("button", { name: "Hisobdan chiqish" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/admin/talabalar");
    await expect(page).toHaveURL("/kirish");
  });

  test("noto'g'ri kod rad etiladi, to'g'risi qabul qilinadi", async ({ page }) => {
    await requestCode(page, phones.student);
    await enterCode(page, "123456");
    await expect(page.getByText("Kod noto'g'ri")).toBeVisible();
    await expect(page).toHaveURL("/kirish");
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL(HOME.student);
  });

  test("5 ta xato urinish: kod bekor bo'ladi, raqam bloklanadi, to'g'ri kod va yangi kod so'rash ishlamaydi", async ({ page }) => {
    await requestCode(page, phones.student);
    for (let i = 0; i < 4; i++) {
      await enterCode(page, "111111");
      await expect(page.getByText("Kod noto'g'ri")).toBeVisible();
      await expect(codeBox(page)).toBeEnabled();
    }
    await enterCode(page, "111111");
    await expect(page.getByText("Juda ko'p xato urinish")).toBeVisible();
    await expect(codeBox(page)).toBeEnabled();

    await enterCode(page, FIXED_CODE);
    await expect(page.getByText("Juda ko'p xato urinish")).toBeVisible();
    await expect(page).toHaveURL("/kirish");

    // yangi kod so'rash ham blok tugaguncha rad etiladi
    await page.getByRole("button", { name: "Raqamni o'zgartirish" }).click();
    await page.getByRole("button", { name: "SMS kod olish" }).click();
    await expect(page.getByText("Juda ko'p xato urinish")).toBeVisible();
    const codes = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone = $1`, [phones.student]));
    expect(codes.rows[0].n).toBe(1);
  });

  test("kod bir martalik: ishlatilgan kod bilan qayta kirib bo'lmaydi", async ({ page, context }) => {
    await signIn(page, phones.student);
    await expect(page).toHaveURL(HOME.student);
    await context.clearCookies();
    // Yangi kod so'ramasdan eski kodni yuboramiz: serverda u allaqachon yopilgan.
    const consumed = await withDb((db) => db.query(`SELECT "consumedAt" FROM "OtpCode" WHERE phone = $1`, [phones.student]));
    expect(consumed.rows.every((row) => row.consumedAt !== null)).toBe(true);
  });

  test("60 soniya ichida ikkinchi kod yuborilmaydi", async ({ page }) => {
    await requestCode(page, phones.student);
    await page.getByRole("button", { name: "Raqamni o'zgartirish" }).click();
    await page.getByRole("button", { name: "SMS kod olish" }).click();
    await expect(page.getByText("Kod hozirgina yuborildi")).toBeVisible();
    const count = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone = $1`, [phones.student]));
    expect(count.rows[0].n).toBe(1);
  });

  test("bitta IP'dan soatiga 10 ta so'rovdan keyin kod yuborilmaydi", async ({ page }) => {
    await requestCode(page, phones.student);
    // Shu brauzer IP'si nomidan yana 9 ta so'rov yozib qo'yamiz (jami 10)
    await withDb((db) => db.query(`INSERT INTO "RateLimitHit" (id, key) SELECT 'e2e_hit_' || n, (SELECT key FROM "RateLimitHit" LIMIT 1) FROM generate_series(1, 9) n`));
    await page.goto("/kirish", { waitUntil: "networkidle" });
    await page.locator("#login-phone").fill("90 555 09 96");
    await page.getByRole("button", { name: "SMS kod olish" }).click();
    await expect(page.getByText("Juda ko'p so'rov yuborildi")).toBeVisible();
    const codes = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone = '+998905550996'`));
    expect(codes.rows[0].n).toBe(0);
  });

  test("faqat +998: boshqa davlat raqamiga kod yuborilmaydi", async ({ page }) => {
    await page.goto("/kirish", { waitUntil: "networkidle" });
    await page.locator("#login-phone").fill("+7 904 123 78 56");
    await page.getByRole("button", { name: "SMS kod olish" }).click();
    await expect(page.getByText("Telefon raqamni to'liq kiriting")).toBeVisible();
    const codes = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone LIKE '+7%' OR phone LIKE '%9041237856'`));
    expect(codes.rows[0].n).toBe(0);
  });

  test("sessiya cookie: httpOnly va SameSite=Lax, JS orqali o'qib bo'lmaydi", async ({ page, context }) => {
    await signIn(page, phones.student);
    await expect(page).toHaveURL(HOME.student);
    const cookie = (await context.cookies()).find((c) => c.name === "tp_session");
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Lax");
    expect(cookie!.path).toBe("/");
    // Secure `next dev` (http) da ataylab o'chiq; production qiymati cookie-options.test.ts da tekshiriladi.
    expect(await page.evaluate(() => document.cookie)).not.toContain("tp_session");
  });

  test("/kirish?rol=biznes Biznes tabini ochadi", async ({ page }) => {
    await page.goto("/kirish?rol=biznes", { waitUntil: "networkidle" });
    await expect(page.getByRole("tab", { name: "Biznes" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Biznes kabinetiga kirish" })).toBeVisible();
    await page.goto("/kirish", { waitUntil: "networkidle" });
    await expect(page.getByRole("tab", { name: "Talaba" })).toHaveAttribute("aria-selected", "true");
  });

  test("noto'g'ri raqam uchun kod yuborilmaydi", async ({ page }) => {
    await page.goto("/kirish", { waitUntil: "networkidle" });
    await page.locator("#login-phone").fill("90 412");
    await page.getByRole("button", { name: "SMS kod olish" }).click();
    await expect(page.getByText("Telefon raqamni to'liq kiriting")).toBeVisible();
  });

  test("bloklangan foydalanuvchi kira olmaydi", async ({ page }) => {
    const blocked = "+998905550999";
    await withDb((db) =>
      db.query(
        `INSERT INTO "User" (id, phone, role, status, "updatedAt") VALUES ('e2e_blocked', $1, 'STUDENT', 'BLOCKED', now())
         ON CONFLICT (phone) DO UPDATE SET status = 'BLOCKED'`,
        [blocked],
      ),
    );
    try {
      await signIn(page, blocked);
      await expect(page.getByText("Bu hisob bloklangan")).toBeVisible();
      await expect(page).toHaveURL("/kirish");
    } finally {
      await clearOtp(blocked);
      await withDb((db) => db.query(`DELETE FROM "User" WHERE id = 'e2e_blocked'`));
    }
  });

  test("ro'yxatda yo'q raqam: kod tasdiqlangach ro'yxat formasiga o'tadi", async ({ page }) => {
    const fresh = "+998905550998";
    await signIn(page, fresh);
    await expect(page).toHaveURL("/talaba/royxat");
    // Tasdiqlangan raqam formada tayyor turadi va o'zgartirib bo'lmaydi
    await expect(page.locator("#reg-phone")).toHaveValue("90 555 09 98");
    await expect(page.locator("#reg-phone")).toHaveAttribute("readonly", "");
    await clearOtp(fresh);
  });

  test("biznes tabidan ro'yxatda yo'q raqam biznes ro'yxatiga o'tadi", async ({ page }) => {
    const fresh = "+998905550997";
    await requestCode(page, fresh, "Biznes");
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL("/biznes/royxat");
    // Tasdiqlangan raqam ariza formasiga o'zgartirib bo'lmaydigan qilib qo'yiladi (2-qadam)
    await page.locator("#b1-name").fill("Test");
    await page.getByRole("button", { name: "Kafe / restoran" }).locator("visible=true").click();
    await page.locator("#b1-address").fill("Test ko'chasi 1");
    await page.locator("#b1-hours").fill("09:00 – 18:00");
    await page.locator("#b1-tin").fill("309000997");
    await page.getByRole("button", { name: "Keyingi: hujjatlar" }).click();
    await expect(page.locator("#b1-phone")).toHaveValue("90 555 09 97");
    await expect(page.locator("#b1-phone")).toHaveAttribute("readonly", "");
    await clearOtp(fresh);
  });

  test("chiqish sessiyani yopadi", async ({ page }) => {
    await signIn(page, phones.student);
    await expect(page).toHaveURL(HOME.student);
    await page.getByRole("button", { name: "Hisobdan chiqish" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/chegirmalar");
    await expect(page).toHaveURL("/kirish");
  });
});

test.describe("rol himoyasi", () => {
  const PROTECTED = ["/chegirmalar", "/biznes", "/biznes/skaner", "/biznes/chegirmalar", "/biznes/chegirma/yangi", "/admin", "/admin/talabalar", "/admin/bizneslar", "/admin/chegirmalar", "/talaba/guvohnoma", "/talaba/tekshiruv"];

  test("kirmagan foydalanuvchi himoyalangan sahifalardan kirishga yo'naltiriladi", async ({ page }) => {
    test.slow(); // 8 ta sahifa — dev serverda birinchi kompilyatsiya uzoq
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page, path).toHaveURL("/kirish");
    }
  });

  // Har bir rol begona sahifani ochmoqchi bo'lganda qayerga tushishi
  const MATRIX = {
    student: { "/biznes/chegirma/yangi": "/chegirmalar", "/biznes": "/chegirmalar", "/biznes/skaner": "/chegirmalar", "/admin": "/chegirmalar", "/admin/talabalar": "/chegirmalar", "/admin/bizneslar": "/chegirmalar" },
    owner: { "/chegirmalar": "/biznes", "/admin": "/biznes", "/biznes/skaner": "/biznes/skaner" },
    cashier: { "/biznes/chegirmalar": "/biznes/skaner", "/biznes/chegirma/yangi": "/biznes/skaner", "/chegirmalar": "/biznes/skaner", "/admin": "/biznes/skaner", "/biznes": "/biznes/skaner", "/admin/talabalar": "/biznes/skaner", "/admin/chegirmalar": "/biznes/skaner" },
    admin: { "/chegirmalar": "/admin/talabalar", "/biznes": "/admin/talabalar", "/biznes/skaner": "/admin/talabalar", "/admin": "/admin/talabalar" },
  } as const;

  for (const [role, routes] of Object.entries(MATRIX) as [keyof typeof MATRIX, Record<string, string>][]) {
    test(`${role} faqat o'z sahifalarini ko'radi`, async ({ page }) => {
      await signIn(page, phones[role]);
      await expect(page).toHaveURL(HOME[role]);
      for (const [path, landsOn] of Object.entries(routes)) {
        await page.goto(path);
        await expect(page, `${role} → ${path}`).toHaveURL(landsOn);
      }
    });
  }

  test("kirgan foydalanuvchi kirish sahifasidan o'z bosh sahifasiga o'tkaziladi", async ({ page }) => {
    await signIn(page, phones.admin);
    await expect(page).toHaveURL(HOME.admin);
    await page.goto("/kirish");
    await expect(page).toHaveURL(HOME.admin);
  });

  test("bloklangan foydalanuvchining mavjud sessiyasi ishlamay qoladi", async ({ page }) => {
    await signIn(page, phones.cashier);
    await expect(page).toHaveURL(HOME.cashier);
    await withDb((db) => db.query(`UPDATE "User" SET status = 'BLOCKED' WHERE phone = $1`, [phones.cashier]));
    try {
      await page.goto("/biznes/skaner");
      await expect(page).toHaveURL("/kirish");
    } finally {
      await withDb((db) => db.query(`UPDATE "User" SET status = 'ACTIVE' WHERE phone = $1`, [phones.cashier]));
    }
  });
});
