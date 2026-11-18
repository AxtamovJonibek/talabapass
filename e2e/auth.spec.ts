import { expect, test } from "@playwright/test";
import { codeBox, clearOtp, enterCode, FIXED_CODE, requestCode, seedPhones, signIn, withDb, type SeedPhones } from "./helpers";

let phones: SeedPhones;

test.beforeAll(async () => {
  phones = await seedPhones();
});

const HOME = { student: "/uz/chegirmalar", owner: "/uz/biznes", cashier: "/uz/biznes/skaner", admin: "/uz/admin" } as const;

test.describe("kirish", () => {
  for (const role of ["student", "owner", "cashier", "admin"] as const) {
    test(`${role} kiradi va o'z bosh sahifasiga tushadi`, async ({ page }) => {
      await signIn(page, phones[role]);
      await expect(page).toHaveURL(HOME[role]);
      if (role === "admin") await expect(page.getByRole("heading", { name: "Platforma" })).toBeVisible();
      // Talaba bosh sahifasi — lenta (T4)
      else if (role === "student") await expect(page.locator("#t4-search")).toBeVisible();
      // Kassir bosh sahifasi — skaner (B3), o'z biznesi bilan
      else if (role === "cashier") await expect(page.getByTestId("cashier-business")).toBeVisible();
      // Biznes egasi bosh sahifasi — statistika (B6)
      else await expect(page.getByRole("heading", { name: "Statistika" }).locator("visible=true")).toBeVisible();
    });
  }

  test("admin: yon panelning barcha bandlari ochiladi — bo'sh sahifa yo'q", async ({ page }) => {
    test.slow(); // dev serverda har bir sahifa birinchi marta kompilyatsiya qilinadi
    await signIn(page, phones.admin);
    await expect(page).toHaveURL(HOME.admin);
    const nav = page.getByRole("navigation", { name: "Admin menyu" });
    // [band, manzil, sahifa sarlavhasi]
    const sections = [
      ["Umumiy", "/uz/admin", "Platforma"],
      ["Talabalar tekshiruvi", "/uz/admin/talabalar", "Talabalar tekshiruvi"],
      ["Bizneslar", "/uz/admin/bizneslar", "Bizneslar tekshiruvi"],
      ["Chegirmalar", "/uz/admin/chegirmalar", "Chegirmalar tekshiruvi"],
      ["Tranzaksiyalar", "/uz/admin/tranzaksiyalar", "Tranzaksiyalar"],
      ["Bildirishnomalar", "/uz/admin/bildirishnomalar", "Bildirishnoma yuborish"],
      ["Bloklanganlar", "/uz/admin/bloklanganlar", "Bloklanganlar"],
      ["Foydalanuvchilar", "/uz/admin/foydalanuvchilar", "Foydalanuvchilar"],
      ["Universitetlar", "/uz/admin/universitetlar", "Universitetlar"],
      ["Profil va adminlar", "/uz/admin/profil", "Profil va adminlar"],
    ] as const;
    for (const [label, href, heading] of sections) {
      await nav.getByRole("link", { name: new RegExp(label) }).click();
      await expect(page, label).toHaveURL(href);
      await expect(page.getByRole("heading", { level: 1, name: heading }), label).toBeVisible();
      // hech bir band o'chirilgan emas
      await expect(nav.locator("[aria-disabled=true]")).toHaveCount(0);
    }
  });

  test("admin panelidan chiqish", async ({ page }) => {
    await signIn(page, phones.admin);
    await expect(page).toHaveURL(HOME.admin);
    await page.getByRole("button", { name: "Hisobdan chiqish" }).click();
    await expect(page).toHaveURL("/uz");
    await page.goto("/uz/admin/talabalar");
    await expect(page).toHaveURL("/uz/kirish");
  });

  test("noto'g'ri kod rad etiladi, to'g'risi qabul qilinadi", async ({ page }) => {
    await requestCode(page, phones.student);
    await enterCode(page, "123456");
    await expect(page.getByText("Kod noto'g'ri")).toBeVisible();
    await expect(page).toHaveURL("/uz/kirish");
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
    await expect(page).toHaveURL("/uz/kirish");

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
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    await page.locator("#login-phone").fill("90 555 09 96");
    await page.getByRole("button", { name: "SMS kod olish" }).click();
    await expect(page.getByText("Juda ko'p so'rov yuborildi")).toBeVisible();
    const codes = await withDb((db) => db.query(`SELECT count(*)::int AS n FROM "OtpCode" WHERE phone = '+998905550996'`));
    expect(codes.rows[0].n).toBe(0);
  });

  test("faqat +998: boshqa davlat raqamiga kod yuborilmaydi", async ({ page }) => {
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
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
    await page.goto("/uz/kirish?rol=biznes", { waitUntil: "networkidle" });
    await expect(page.getByRole("tab", { name: "Biznes" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Biznes kabinetiga kirish" })).toBeVisible();
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
    await expect(page.getByRole("tab", { name: "Talaba" })).toHaveAttribute("aria-selected", "true");
  });

  test("noto'g'ri raqam uchun kod yuborilmaydi", async ({ page }) => {
    await page.goto("/uz/kirish", { waitUntil: "networkidle" });
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
      await requestCode(page, blocked);
      await enterCode(page, FIXED_CODE);
      await expect(page.getByText("Bu hisob bloklangan")).toBeVisible();
      await expect(page).toHaveURL("/uz/kirish");
    } finally {
      await clearOtp(blocked);
      await withDb((db) => db.query(`DELETE FROM "User" WHERE id = 'e2e_blocked'`));
    }
  });

  test("ro'yxatda yo'q raqam: kod tasdiqlangach ro'yxat formasiga o'tadi", async ({ page }) => {
    const fresh = "+998905550998";
    await signIn(page, fresh);
    await expect(page).toHaveURL("/uz/talaba/royxat");
    // Tasdiqlangan raqam formada tayyor turadi va o'zgartirib bo'lmaydi
    await expect(page.locator("#reg-phone")).toHaveValue("90 555 09 98");
    await expect(page.locator("#reg-phone")).toHaveAttribute("readonly", "");
    await clearOtp(fresh);
  });

  test("biznes tabidan ro'yxatda yo'q raqam biznes ro'yxatiga o'tadi", async ({ page }) => {
    const fresh = "+998905550997";
    await requestCode(page, fresh, "Biznes");
    await enterCode(page, FIXED_CODE);
    await expect(page).toHaveURL("/uz/biznes/royxat");
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
    // Chiqish talaba profilida
    await page.goto("/uz/profil");
    await page.getByRole("button", { name: "Hisobdan chiqish" }).click();
    await expect(page).toHaveURL("/uz");
    await page.goto("/uz/chegirmalar");
    await expect(page).toHaveURL("/uz/kirish");
  });
});

test.describe("rol himoyasi", () => {
  const PROTECTED = ["/uz/chegirmalar", "/uz/kuponlar", "/uz/tarix", "/uz/profil", "/uz/profil/tahrir", "/uz/profil/guvohnoma", "/uz/yordam", "/uz/biznes/profil/tahrir", "/uz/biznes", "/uz/biznes/skaner", "/uz/biznes/chegirmalar", "/uz/biznes/chegirma/yangi", "/uz/biznes/profil", "/uz/biznes/kassirlar", "/uz/admin", "/uz/admin/talabalar", "/uz/admin/bizneslar", "/uz/admin/chegirmalar", "/uz/admin/tranzaksiyalar", "/uz/admin/bildirishnomalar", "/uz/admin/bloklanganlar", "/uz/admin/foydalanuvchilar", "/uz/admin/universitetlar", "/uz/admin/profil", "/uz/bildirishnomalar", "/uz/biznes/bildirishnomalar", "/uz/talaba/guvohnoma", "/uz/talaba/tekshiruv", "/uz/buyurtmalar", "/uz/biznes/buyurtmalar", "/uz/biznes/sozlamalar"];

  test("kirmagan foydalanuvchi himoyalangan sahifalardan kirishga yo'naltiriladi", async ({ page }) => {
    test.setTimeout(180_000); // ko'p sahifa — dev serverda birinchi kompilyatsiya uzoq
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page, path).toHaveURL("/uz/kirish");
    }
  });

  // Har bir rol begona sahifani ochmoqchi bo'lganda qayerga tushishi
  const MATRIX = {
    student: { "/uz/admin/foydalanuvchilar": "/uz/chegirmalar", "/uz/admin/universitetlar": "/uz/chegirmalar", "/uz/admin/profil": "/uz/chegirmalar", "/uz/biznes/chegirma/yangi": "/uz/chegirmalar", "/uz/biznes/profil/tahrir": "/uz/chegirmalar", "/uz/biznes": "/uz/chegirmalar", "/uz/biznes/skaner": "/uz/chegirmalar", "/uz/admin": "/uz/chegirmalar", "/uz/admin/talabalar": "/uz/chegirmalar", "/uz/admin/bizneslar": "/uz/chegirmalar", "/uz/admin/tranzaksiyalar": "/uz/chegirmalar", "/uz/admin/bildirishnomalar": "/uz/chegirmalar", "/uz/admin/bloklanganlar": "/uz/chegirmalar", "/uz/biznes/bildirishnomalar": "/uz/chegirmalar", "/uz/biznes/buyurtmalar": "/uz/chegirmalar", "/uz/biznes/sozlamalar": "/uz/chegirmalar" },
    owner: { "/uz/admin/foydalanuvchilar": "/uz/biznes", "/uz/admin/universitetlar": "/uz/biznes", "/uz/admin/profil": "/uz/biznes", "/uz/yordam": "/uz/biznes", "/uz/chegirmalar": "/uz/biznes", "/uz/profil": "/uz/biznes", "/uz/profil/tahrir": "/uz/biznes", "/uz/profil/guvohnoma": "/uz/biznes", "/uz/bildirishnomalar": "/uz/biznes", "/uz/admin": "/uz/biznes", "/uz/admin/bildirishnomalar": "/uz/biznes", "/uz/admin/tranzaksiyalar": "/uz/biznes", "/uz/biznes/skaner": "/uz/biznes/skaner", "/uz/buyurtmalar": "/uz/biznes" },
    cashier: { "/uz/admin/foydalanuvchilar": "/uz/biznes/skaner", "/uz/admin/universitetlar": "/uz/biznes/skaner", "/uz/admin/profil": "/uz/biznes/skaner", "/uz/yordam": "/uz/biznes/skaner", "/uz/kuponlar": "/uz/biznes/skaner", "/uz/profil/tahrir": "/uz/biznes/skaner", "/uz/biznes/profil": "/uz/biznes/skaner", "/uz/biznes/profil/tahrir": "/uz/biznes/skaner", "/uz/biznes/kassirlar": "/uz/biznes/skaner", "/uz/biznes/chegirmalar": "/uz/biznes/skaner", "/uz/biznes/chegirma/yangi": "/uz/biznes/skaner", "/uz/chegirmalar": "/uz/biznes/skaner", "/uz/admin": "/uz/biznes/skaner", "/uz/biznes": "/uz/biznes/skaner", "/uz/admin/talabalar": "/uz/biznes/skaner", "/uz/admin/chegirmalar": "/uz/biznes/skaner", "/uz/admin/tranzaksiyalar": "/uz/biznes/skaner", "/uz/admin/bildirishnomalar": "/uz/biznes/skaner", "/uz/admin/bloklanganlar": "/uz/biznes/skaner", "/uz/bildirishnomalar": "/uz/biznes/skaner", "/uz/biznes/bildirishnomalar": "/uz/biznes/skaner", "/uz/biznes/buyurtmalar": "/uz/biznes/skaner", "/uz/biznes/sozlamalar": "/uz/biznes/skaner", "/uz/buyurtmalar": "/uz/biznes/skaner" },
    admin: { "/uz/yordam": "/uz/admin", "/uz/profil": "/uz/admin", "/uz/profil/guvohnoma": "/uz/admin", "/uz/biznes/profil/tahrir": "/uz/admin", "/uz/tarix": "/uz/admin", "/uz/chegirmalar": "/uz/admin", "/uz/bildirishnomalar": "/uz/admin", "/uz/biznes": "/uz/admin", "/uz/biznes/bildirishnomalar": "/uz/admin", "/uz/biznes/skaner": "/uz/admin", "/uz/buyurtmalar": "/uz/admin", "/uz/biznes/buyurtmalar": "/uz/admin" },
  } as const;

  for (const [role, routes] of Object.entries(MATRIX) as [keyof typeof MATRIX, Record<string, string>][]) {
    test(`${role} faqat o'z sahifalarini ko'radi`, async ({ page }) => {
      test.slow(); // dev serverda birinchi kompilyatsiya uzoq
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
    await page.goto("/uz/kirish");
    await expect(page).toHaveURL(HOME.admin);
  });

  test("bloklangan foydalanuvchining mavjud sessiyasi ishlamay qoladi", async ({ page }) => {
    await signIn(page, phones.cashier);
    await expect(page).toHaveURL(HOME.cashier);
    await withDb((db) => db.query(`UPDATE "User" SET status = 'BLOCKED' WHERE phone = $1`, [phones.cashier]));
    try {
      await page.goto("/uz/biznes/skaner");
      await expect(page).toHaveURL("/uz/kirish");
    } finally {
      await withDb((db) => db.query(`UPDATE "User" SET status = 'ACTIVE' WHERE phone = $1`, [phones.cashier]));
    }
  });
});
