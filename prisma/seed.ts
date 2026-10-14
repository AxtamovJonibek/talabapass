/**
 * Seed: dizayndagi (design/screens) namunaviy ma'lumotlar + 30 kunlik sotuvlar tarixi.
 * Sanalar ishga tushirilgan kunga nisbatan hisoblanadi, shuning uchun ilova doim "jonli" ko'rinadi.
 * Baza bo'sh bo'lmasa hech narsa qilmaydi (mavjud ma'lumotni o'chirmaydi).
 *
 * Tekshiruv navbatidagi guvohnoma va biznes hujjatlari uchun namunaviy fayllar yaratiladi ("NAMUNA" yozuvi bilan),
 * ular ham haqiqiy yuklashlardek tozalash pipeline'idan o'tadi (src/server/storage/maintenance.ts).
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { priceAfterPercent } from "../src/lib/format";
import { fromTashkent, toTashkent } from "../src/lib/time";
import { maintainStoredFiles } from "../src/server/storage/maintenance";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// ───────── yordamchilar ─────────

/** Takrorlanuvchi tasodifiy sonlar (mulberry32) — seed har safar bir xil natija beradi. */
function createRng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createRng(20261013);
const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

const DAY_MS = 86_400_000;
const now = new Date();
const today = toTashkent(now);
const dayOffset = (days: number) => new Date(today.date.getTime() + days * DAY_MS);

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const usedCodes = new Set<string>();
function couponCode(): string {
  for (;;) {
    const part = () => Array.from({ length: 4 }, () => pick([...CODE_ALPHABET])).join("");
    const code = `TP-${part()}-${part()}`;
    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
}

let phoneSeq = 0;
const OPERATOR_CODES = ["90", "91", "93", "94", "97", "99", "33", "88"] as const;
/** Namunaviy raqamlar: +998 XX 555 NN NN ko'rinishida, takrorlanmaydi. */
function nextPhone(): string {
  phoneSeq += 1;
  const code = OPERATOR_CODES[phoneSeq % OPERATOR_CODES.length]!;
  return `+998${code}555${String(phoneSeq).padStart(4, "0")}`;
}

// ───────── ma'lumotnomalar ─────────

const UNIVERSITIES = [
  ["Toshkent axborot texnologiyalari universiteti", "TATU"],
  ["O'zbekiston Milliy universiteti", "O'zMU"],
  ["Toshkent davlat iqtisodiyot universiteti", "TDIU"],
  ["Toshkent davlat yuridik universiteti", "TDYU"],
  ["Westminster xalqaro universiteti", "Westminster"],
  ["Inha universiteti Toshkentda", "Inha"],
  ["Toshkent davlat texnika universiteti", "TDTU"],
  ["Toshkent tibbiyot akademiyasi", "TTA"],
  ["Jahon iqtisodiyoti va diplomatiya universiteti", "JIDU"],
  ["Toshkent davlat pedagogika universiteti", "TDPU"],
  ["O'zbekiston davlat jahon tillari universiteti", "O'zDJTU"],
  ["Toshkent arxitektura-qurilish universiteti", "TAQU"],
  ["Toshkent davlat sharqshunoslik universiteti", "TDShU"],
  ["Turin politexnika universiteti Toshkentda", "Turin"],
  ["Toshkent moliya instituti", "TMI"],
] as const;

/** Talabalar taqsimoti — dizayndagi (A1) nisbatlarga yaqin. */
const UNIVERSITY_WEIGHTS: Record<string, number> = {
  TATU: 24, "O'zMU": 20, TDIU: 17, TDYU: 10, Westminster: 8, Inha: 6,
};

const DISTRICTS = [
  ["Chilonzor", 41.2756, 69.2034],
  ["Yunusobod", 41.3647, 69.2863],
  ["Mirzo Ulug'bek", 41.3385, 69.3346],
  ["Olmazor", 41.354, 69.213],
  ["Mirobod", 41.2869, 69.285],
  ["Shayxontohur", 41.327, 69.229],
  ["Yakkasaroy", 41.285, 69.25],
  ["Sergeli", 41.227, 69.223],
  ["Uchtepa", 41.299, 69.177],
  ["Yashnobod", 41.296, 69.335],
  ["Bektemir", 41.209, 69.334],
  ["Yangihayot", 41.195, 69.21],
] as const;

const CATEGORIES = [
  ["taom", "Taomlar", "#F4DCCB", "#8A3410", "bowl"],
  ["kofe", "Kofe", "#E8DDCC", "#5B3A12", "cup"],
  ["kitob", "Kitob", "#F1D9D9", "#7E1F1F", "book"],
  ["xizmat", "Xizmatlar", "#DDE1F7", "#1E2A9E", "print"],
  ["sport", "Sport", "#D7EEDF", "#145A33", "gym"],
  ["gozal", "Go'zallik", "#E2E2DE", "#2E2E2B", "cut"],
  ["kino", "Kino", "#E9DDF0", "#5B2479", "film"],
] as const;

const FIRST_NAMES_M = ["Sardor", "Bekzod", "Javohir", "Otabek", "Ulug'bek", "Behruz", "Asadbek", "Temur", "Jasur", "Diyor", "Akmal", "Bobur", "Rustam", "Alisher", "Shohruh", "Azizbek", "Farrux", "Islom", "Doston", "Sanjar", "Eldor", "Nodir", "Abdulloh", "Muhammadali", "Samandar"] as const;
const FIRST_NAMES_F = ["Madina", "Shahzoda", "Nilufar", "Kamola", "Mohinur", "Gulnoza", "Feruza", "Malika", "Sevara", "Lola", "Dilfuza", "Muxlisa", "Zarina", "Nigora", "Sabina", "Iroda", "Durdona", "Munisa", "Shahnoza", "Dildora", "Ozoda", "Nargiza", "Maftuna", "Charos", "Robiya"] as const;
const LAST_NAMES = ["Aliyev", "Karimov", "Yusupov", "Rahimov", "Nurmatov", "Sobirov", "Ergashev", "Rashidov", "Qodirov", "Tursunov", "Hamidov", "Rahmonov", "Ismoilov", "Abdullayev", "Toshmatov", "Zokirov", "Usmonov", "Saidov", "Mirzayev", "Xolmatov", "Nazarov", "Salimov", "Jo'rayev", "Olimov", "Sharipov"] as const;
const FACULTIES: Record<string, readonly string[]> = {
  TATU: ["Dasturiy injiniring", "Kiberxavfsizlik", "Kompyuter injiniringi", "Telekommunikatsiya"],
  "O'zMU": ["Filologiya", "Matematika", "Fizika", "Biologiya", "Tarix"],
  TDIU: ["Bank ishi", "Buxgalteriya hisobi", "Menejment", "Marketing"],
  TDYU: ["Xalqaro huquq", "Jinoiy odil sudlov", "Xususiy huquq"],
  Westminster: ["Business Administration", "Economics", "Computing"],
  Inha: ["Kompyuter injiniringi", "Logistika"],
};
const COURSES = ["C1", "C2", "C3", "C4", "MASTER"] as const;

type Person = { id: string; uni: string };

function randomPerson(): { firstName: string; lastName: string } {
  const female = rng() < 0.5;
  const base = pick(LAST_NAMES);
  return {
    firstName: female ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M),
    lastName: female ? `${base}a` : base,
  };
}

// ───────── biznes va chegirmalar (dizayndan) ─────────

type DiscountSeed = {
  key: string;
  category: string;
  title: string;
  description?: string;
  type: "PERCENT" | "FIXED_PRICE" | "BOGO";
  originalPrice?: number;
  percent?: number;
  newPrice?: number;
  note?: string;
  icon?: string;
  tileColor?: string;
  inkColor?: string;
  weekdays: number[];
  from: number;
  to: number;
  dailyLimit: number;
  perStudentLimit?: "DAILY" | "WEEKLY" | "UNLIMITED";
  status?: "ACTIVE" | "PENDING_REVIEW" | "ENDED";
  terms?: string;
  /** Ish kunidagi o'rtacha sotuv (tarix generatsiyasi uchun) */
  avgSales: number;
};

type BusinessSeed = {
  name: string;
  legalName: string;
  tin: string;
  kind: "CAFE" | "SHOP" | "SERVICE" | "SPORT" | "BEAUTY" | "EDUCATION" | "ENTERTAINMENT";
  typeLabel: string;
  district: string;
  address: string;
  landmark?: string;
  /** Tuman markazidan siljish (gradus) */
  shift: [number, number];
  workingHours: string;
  description: string;
  owner: [string, string];
  contactPhone: string;
  cashiers: [string, string][];
  status?: "APPROVED" | "WARNED";
  discounts: DiscountSeed[];
};

const ALL_WEEK = [1, 2, 3, 4, 5, 6, 7];
const WORKDAYS = [1, 2, 3, 4, 5];
const h = (hours: number) => hours * 60;

const BUSINESSES: BusinessSeed[] = [
  {
    name: "Bodom Choyxonasi", legalName: "\"BODOM OSH\" MChJ", tin: "307482915", kind: "CAFE", typeLabel: "Choyxona",
    district: "Chilonzor", address: "Bunyodkor ko'chasi 14, Chilonzor-9", shift: [0.004, 0.003],
    workingHours: "09:00–23:00", description: "Toshkent oshi, somsa va choy. 60 o'rinli zal.",
    owner: ["Shavkat", "Yo'ldoshev"], contactPhone: "+998712764012",
    cashiers: [["Jasur", "Toshmatov"], ["Malika", "Rahimova"]],
    discounts: [
      { key: "osh", category: "taom", title: "Osh 0.5 porsiya + ko'k choy", description: "Toshkent oshi, salat va choynakda ko'k choy. Tushlik payti — talabalar uchun maxsus narx.", type: "PERCENT", originalPrice: 38000, percent: 30, weekdays: WORKDAYS, from: h(12), to: h(15), dailyLimit: 60, terms: "Faqat joyida. Boshqa aksiyalar bilan birlashtirilmaydi.", avgSales: 30 },
      { key: "nonushta", category: "taom", title: "Nonushta: somsa + choy", type: "PERCENT", originalPrice: 22000, percent: 20, weekdays: ALL_WEEK, from: h(8), to: h(11), dailyLimit: 40, avgSales: 14 },
      { key: "choy", category: "taom", title: "Ko'k choy choynakda", type: "BOGO", originalPrice: 12000, note: "Ikkinchi choynak bepul", weekdays: [6, 7], from: h(16), to: h(20), dailyLimit: 30, avgSales: 12 },
      { key: "tushlik", category: "taom", title: "Tushlik to'plami", type: "PERCENT", originalPrice: 45000, percent: 22, weekdays: WORKDAYS, from: h(12), to: h(16), dailyLimit: 40, status: "ENDED", avgSales: 0 },
    ],
  },
  {
    name: "Nusxa Markazi", legalName: "YaTT Boboyev A.", tin: "305118204", kind: "SERVICE", typeLabel: "Nusxa markazi",
    district: "Yunusobod", address: "Amir Temur shoh ko'chasi 108", landmark: "TATU yonida", shift: [-0.028, -0.003],
    workingHours: "08:00–19:00", description: "Chop etish, nusxa, skaner va muqovalash.",
    owner: ["Akmal", "Boboyev"], contactPhone: "+998712350817", cashiers: [["Akmal", "Boboyev"]],
    discounts: [
      { key: "a4", category: "xizmat", title: "A4 chop etish, 1 varaq", type: "PERCENT", originalPrice: 500, percent: 40, weekdays: ALL_WEEK, from: h(8), to: h(19), dailyLimit: 2000, perStudentLimit: "UNLIMITED", avgSales: 32 },
    ],
  },
  {
    name: "Kadr Kinoteatri", legalName: "\"KADR MEDIA\" MChJ", tin: "308904561", kind: "ENTERTAINMENT", typeLabel: "Kinoteatr",
    district: "Olmazor", address: "Farobiy ko'chasi 3", shift: [0.002, 0.006],
    workingHours: "10:00–00:00", description: "4 zal, 2D va 3D seanslar.",
    owner: ["Sevara", "Qosimova"], contactPhone: "+998712447030", cashiers: [["Sevara", "Qosimova"]],
    discounts: [
      { key: "kino", category: "kino", title: "Kino chiptasi, 2D seans", type: "FIXED_PRICE", originalPrice: 45000, newPrice: 25000, weekdays: [2], from: h(10), to: h(23), dailyLimit: 150, perStudentLimit: "WEEKLY", avgSales: 140 },
    ],
  },
  {
    name: "Lavash Point", legalName: "YaTT Eshonqulov B.", tin: "306557390", kind: "CAFE", typeLabel: "Fast-fud",
    district: "Chilonzor", address: "Qatortol ko'chasi 27", shift: [0.008, -0.004],
    workingHours: "10:00–23:00", description: "Lavash, burger va ichimliklar.", status: "WARNED",
    owner: ["Bobur", "Eshonqulov"], contactPhone: "+998903110456", cashiers: [["Bobur", "Eshonqulov"]],
    discounts: [
      { key: "lavash", category: "taom", title: "Lavash + ayron", type: "BOGO", originalPrice: 32000, note: "Ikkinchi lavash bepul", icon: "wrap", tileColor: "#F3E6C4", inkColor: "#7A5508", weekdays: ALL_WEEK, from: h(11), to: h(17), dailyLimit: 50, avgSales: 28 },
    ],
  },
  {
    name: "Forma Fitnes", legalName: "\"FORMA SPORT\" MChJ", tin: "309220148", kind: "SPORT", typeLabel: "Fitnes klub",
    district: "Yunusobod", address: "Yunusobod-11, Ahmad Donish ko'chasi 20", shift: [0.006, 0.004],
    workingHours: "07:00–23:00", description: "Trenajyor zali va guruh mashg'ulotlari.",
    owner: ["Lola", "Mahmudova"], contactPhone: "+998712009914", cashiers: [["Lola", "Mahmudova"]],
    discounts: [
      { key: "abonement", category: "sport", title: "Oylik abonement, 12 mashg'ulot", type: "FIXED_PRICE", originalPrice: 450000, newPrice: 290000, weekdays: ALL_WEEK, from: h(9), to: h(16), dailyLimit: 40, perStudentLimit: "WEEKLY", avgSales: 3 },
      { key: "tashrif", category: "sport", title: "Bir martalik tashrif", type: "PERCENT", originalPrice: 50000, percent: 40, weekdays: WORKDAYS, from: h(9), to: h(15), dailyLimit: 30, status: "PENDING_REVIEW", avgSales: 0 },
    ],
  },
  {
    name: "Qahva Bekati", legalName: "\"QAHVA BEKATI\" MChJ", tin: "310075623", kind: "CAFE", typeLabel: "Qahvaxona",
    district: "Mirzo Ulug'bek", address: "Mustaqillik shoh ko'chasi 59", shift: [-0.006, -0.012],
    workingHours: "07:30–22:00", description: "Yangi qovurilgan qahva va shirinliklar.",
    owner: ["Diyor", "Komilov"], contactPhone: "+998935021177", cashiers: [["Diyor", "Komilov"]],
    discounts: [
      { key: "kapuchino", category: "kofe", title: "Kapuchino 300 ml", type: "PERCENT", originalPrice: 28000, percent: 25, weekdays: ALL_WEEK, from: h(8), to: h(11), dailyLimit: 80, avgSales: 36 },
    ],
  },
  {
    name: "Usta Barber", legalName: "YaTT Nazarov S.", tin: "304661872", kind: "BEAUTY", typeLabel: "Sartaroshxona",
    district: "Mirobod", address: "Shahrisabz ko'chasi 12", shift: [0.003, -0.002],
    workingHours: "10:00–21:00", description: "Erkaklar sartaroshxonasi.",
    owner: ["Sanjar", "Nazarov"], contactPhone: "+998977034520", cashiers: [["Sanjar", "Nazarov"]],
    discounts: [
      { key: "soch", category: "gozal", title: "Soch olish + soqol", type: "FIXED_PRICE", originalPrice: 90000, newPrice: 60000, weekdays: ALL_WEEK, from: h(10), to: h(14), dailyLimit: 20, perStudentLimit: "WEEKLY", avgSales: 6 },
    ],
  },
  {
    name: "Sahifa Kitob Do'koni", legalName: "\"SAHIFA KITOB\" MChJ", tin: "309114572", kind: "SHOP", typeLabel: "Kitob do'koni",
    district: "Yunusobod", address: "Yunusobod-4, Amir Temur 108", shift: [-0.02, 0.002],
    workingHours: "10:00–21:00", description: "Badiiy va o'quv adabiyotlari.",
    owner: ["Rustam", "Zokirov"], contactPhone: "+998712331840", cashiers: [["Rustam", "Zokirov"]],
    discounts: [
      { key: "kitob", category: "kitob", title: "Barcha badiiy kitoblar", type: "PERCENT", percent: 15, note: "Chek summasidan −15%", weekdays: ALL_WEEK, from: h(10), to: h(20), dailyLimit: 200, perStudentLimit: "UNLIMITED", avgSales: 9 },
    ],
  },
];

/** A2 navbatidagi biznes arizalari */
const PENDING_BUSINESSES = [
  { name: "Smart Print", legalName: "YaTT Qodirova M.", tin: "302870551", kind: "SERVICE", typeLabel: "Nusxa markazi", district: "Olmazor", address: "Talabalar shaharchasi, Universitet ko'chasi 7", workingHours: "08:00–20:00", owner: ["Muxlisa", "Qodirova"], contactPhone: "+998910047219", docs: ["Guvohnoma_skan.jpg"], hoursAgo: 3 },
  { name: "Lazzat Burger", legalName: "\"LAZZAT FOOD\" MChJ", tin: "311562008", kind: "CAFE", typeLabel: "Fast-fud", district: "Chilonzor", address: "Chilonzor-19, Lutfiy ko'chasi 44", workingHours: "11:00–00:00", owner: ["Alisher", "Usmonov"], contactPhone: "+998909110377", docs: ["Guvohnoma.pdf", "Sanitariya xulosasi.pdf"], hoursAgo: 5 },
  { name: "Yoga Space", legalName: "YaTT Saidova D.", tin: "310447289", kind: "SPORT", typeLabel: "Yoga studiyasi", district: "Mirobod", address: "Shahrisabz ko'chasi 5", workingHours: "07:00–22:00", owner: ["Dilfuza", "Saidova"], contactPhone: "+998334001290", docs: ["Guvohnoma.pdf"], hoursAgo: 26 },
] as const;

/** A2 navbatidagi talaba arizalari */
const PENDING_STUDENTS = [
  { firstName: "Madina", lastName: "Yusupova", uni: "O'zMU", faculty: "Filologiya", course: "C2", file: "guvohnoma_old.jpg", size: 2_100_000, mime: "image/jpeg", minutesAgo: 12 },
  { firstName: "Asadbek", lastName: "Hamidov", uni: "TDIU", faculty: "Bank ishi", course: "C4", file: "IMG_4471.jpg", size: 3_400_000, mime: "image/jpeg", minutesAgo: 26 },
  { firstName: "Gulnoza", lastName: "Rahmonova", uni: "TDYU", faculty: "Xalqaro huquq", course: "C1", file: "scan.pdf", size: 900_000, mime: "application/pdf", minutesAgo: 41 },
  { firstName: "Temur", lastName: "Ismoilov", uni: "Inha", faculty: "Kompyuter injiniringi", course: "C3", file: "id_card.png", size: 1_200_000, mime: "image/png", minutesAgo: 58 },
  { firstName: "Feruza", lastName: "Abdullayeva", uni: "TATU", faculty: "Kiberxavfsizlik", course: "C2", file: "guvohnoma.jpg", size: 1_700_000, mime: "image/jpeg", minutesAgo: 64 },
] as const;

// ───────── asosiy oqim ─────────

async function main() {
  if ((await db.university.count()) > 0) {
    console.log("Baza bo'sh emas — seed o'tkazib yuborildi (mavjud ma'lumotlar o'zgartirilmadi).");
    return;
  }

  // Ma'lumotnomalar
  await db.university.createMany({ data: UNIVERSITIES.map(([name, shortName]) => ({ name, shortName })) });
  await db.district.createMany({ data: DISTRICTS.map(([name, lat, lng]) => ({ name, lat, lng })) });
  await db.category.createMany({
    data: CATEGORIES.map(([slug, name, tileColor, inkColor, icon], sort) => ({ slug, name, tileColor, inkColor, icon, sort })),
  });
  const uniByShort = new Map((await db.university.findMany()).map((u) => [u.shortName, u]));
  const districtByName = new Map((await db.district.findMany()).map((d) => [d.name, d]));
  const categoryBySlug = new Map((await db.category.findMany()).map((c) => [c.slug, c]));

  // Admin
  const admin = await db.user.create({
    data: { phone: "+998900000001", role: "ADMIN", firstName: "Aziza", lastName: "Mirzayeva" },
  });

  // Talabalar: Dilnoza (dizayndagi asosiy talaba) + tasdiqlanganlar
  const students: Person[] = [];
  const cardExpiry = new Date(Date.UTC(today.date.getUTCFullYear() + 1, 5, 30));
  const dilnoza = await db.user.create({
    data: {
      phone: "+998904123785", role: "STUDENT", firstName: "Dilnoza", lastName: "Karimova",
      student: {
        create: {
          universityId: uniByShort.get("TATU")!.id, faculty: "Dasturiy injiniring", course: "C2",
          publicId: "TP-2610-0418", status: "APPROVED", cardNumber: "TATU-24-10418", cardExpiresAt: cardExpiry,
        },
      },
    },
  });

  const weighted = UNIVERSITIES.flatMap(([, short]) => Array<string>(UNIVERSITY_WEIGHTS[short] ?? 2).fill(short));
  for (let i = 0; i < 160; i++) {
    const uni = pick(weighted);
    const person = randomPerson();
    const user = await db.user.create({
      data: {
        phone: nextPhone(), role: "STUDENT", ...person,
        createdAt: new Date(now.getTime() - int(20, 200) * DAY_MS),
        student: {
          create: {
            universityId: uniByShort.get(uni)!.id,
            faculty: pick(FACULTIES[uni] ?? ["Umumiy"]),
            course: pick(COURSES),
            publicId: `TP-${String(int(2400, 2610))}-${String(1000 + i)}`,
            status: "APPROVED",
            cardNumber: `${uni.replace(/[^A-Za-z]/g, "").toUpperCase()}-${int(22, 26)}-${String(10000 + i)}`,
            cardExpiresAt: cardExpiry,
          },
        },
      },
    });
    students.push({ id: user.id, uni });
  }

  // Tekshiruv navbatidagi talabalar
  for (const [i, s] of PENDING_STUDENTS.entries()) {
    const createdAt = new Date(now.getTime() - s.minutesAgo * 60_000);
    await db.user.create({
      data: {
        phone: nextPhone(), role: "STUDENT", firstName: s.firstName, lastName: s.lastName, createdAt,
        student: {
          create: {
            universityId: uniByShort.get(s.uni)!.id, faculty: s.faculty, course: s.course,
            publicId: `TP-2610-9${String(i).padStart(3, "0")}`, status: "PENDING",
            verifications: {
              create: { fileKey: `seed/verifications/${i + 1}/${s.file}`, fileName: s.file, fileSize: s.size, mime: s.mime, createdAt },
            },
          },
        },
      },
    });
  }

  // Bizneslar, kassirlar, chegirmalar
  type DiscountRow = Prisma.DiscountGetPayload<object> & { seed: DiscountSeed };
  const live: { businessId: string; cashierIds: string[]; discounts: DiscountRow[] }[] = [];
  const startsOn = dayOffset(-30);
  const endsOn = dayOffset(45);

  for (const b of BUSINESSES) {
    const district = districtByName.get(b.district)!;
    const owner = await db.user.create({
      data: { phone: nextPhone(), role: "BUSINESS_OWNER", firstName: b.owner[0], lastName: b.owner[1] },
    });
    const business = await db.business.create({
      data: {
        ownerId: owner.id, name: b.name, legalName: b.legalName, tin: b.tin, kind: b.kind, typeLabel: b.typeLabel,
        districtId: district.id, address: b.address, landmark: b.landmark,
        lat: district.lat + b.shift[0], lng: district.lng + b.shift[1],
        workingHours: b.workingHours, description: b.description,
        contactName: b.owner.join(" "), contactPhone: b.contactPhone,
        status: b.status ?? "APPROVED", reviewedById: admin.id, reviewedAt: dayOffset(-40),
        createdAt: dayOffset(-45),
        members: { create: { userId: owner.id, role: "OWNER" } },
        docs: { create: { kind: "REGISTRATION", fileKey: `seed/business/${b.tin}/guvohnoma.pdf`, fileName: "guvohnoma.pdf" } },
      },
    });

    const cashierIds: string[] = [];
    for (const [firstName, lastName] of b.cashiers) {
      // Egasi o'zi kassada tursa — alohida kassir foydalanuvchisi ochilmaydi.
      if (firstName === b.owner[0] && lastName === b.owner[1]) {
        cashierIds.push(owner.id);
        continue;
      }
      const cashier = await db.user.create({ data: { phone: nextPhone(), role: "CASHIER", firstName, lastName } });
      await db.businessMember.create({ data: { businessId: business.id, userId: cashier.id, role: "CASHIER" } });
      cashierIds.push(cashier.id);
    }

    const discounts: DiscountRow[] = [];
    for (const d of b.discounts) {
      const category = categoryBySlug.get(d.category)!;
      const status = d.status ?? "ACTIVE";
      const row = await db.discount.create({
        data: {
          businessId: business.id, categoryId: category.id, title: d.title, description: d.description,
          type: d.type, originalPrice: d.originalPrice, percent: d.percent, newPrice: d.newPrice, note: d.note,
          icon: d.icon, tileColor: d.tileColor, inkColor: d.inkColor,
          weekdays: d.weekdays, fromMinute: d.from, toMinute: d.to,
          dailyLimit: d.dailyLimit, perStudentLimit: d.perStudentLimit ?? "DAILY",
          startsOn: status === "ENDED" ? dayOffset(-75) : startsOn,
          endsOn: status === "ENDED" ? dayOffset(-13) : endsOn,
          terms: d.terms, status,
          reviewedById: status === "PENDING_REVIEW" ? null : admin.id,
          reviewedAt: status === "PENDING_REVIEW" ? null : dayOffset(-31),
        },
      });
      discounts.push({ ...row, seed: d });
    }
    live.push({ businessId: business.id, cashierIds, discounts });
  }

  for (const p of PENDING_BUSINESSES) {
    const owner = await db.user.create({
      data: { phone: nextPhone(), role: "BUSINESS_OWNER", firstName: p.owner[0], lastName: p.owner[1] },
    });
    const district = districtByName.get(p.district)!;
    await db.business.create({
      data: {
        ownerId: owner.id, name: p.name, legalName: p.legalName, tin: p.tin, kind: p.kind, typeLabel: p.typeLabel,
        districtId: district.id, address: p.address, lat: district.lat, lng: district.lng,
        workingHours: p.workingHours, contactName: p.owner.join(" "), contactPhone: p.contactPhone,
        status: "PENDING", createdAt: new Date(now.getTime() - p.hoursAgo * 3_600_000),
        members: { create: { userId: owner.id, role: "OWNER" } },
        docs: { create: p.docs.map((fileName) => ({ kind: "REGISTRATION" as const, fileKey: `seed/business/${p.tin}/${fileName}`, fileName })) },
      },
    });
  }

  // 30 kunlik sotuvlar tarixi
  const coupons: Prisma.CouponCreateManyInput[] = [];
  const redemptions: Prisma.RedemptionCreateManyInput[] = [];
  const days: Prisma.DiscountDayCreateManyInput[] = [];
  const views: Prisma.DiscountViewCreateManyInput[] = [];
  const attempts: Prisma.ScanAttemptCreateManyInput[] = [];
  const PAYMENTS = ["CASH", "CASH", "CARD", "CARD", "CARD", "QR"] as const;

  function amounts(d: DiscountSeed): { originalPrice: number; paidAmount: number } {
    if (d.key === "a4") {
      const sheets = int(10, 80);
      return { originalPrice: sheets * 500, paidAmount: sheets * 300 };
    }
    if (d.type === "BOGO") return { originalPrice: d.originalPrice! * 2, paidAmount: d.originalPrice! };
    if (d.type === "FIXED_PRICE") return { originalPrice: d.originalPrice!, paidAmount: d.newPrice! };
    // Narxsiz foizli chegirma (kitob): chek summasi har xil
    const original = d.originalPrice ?? int(40, 140) * 1000;
    return { originalPrice: original, paidAmount: priceAfterPercent(original, d.percent!) };
  }

  for (const biz of live) {
    let receiptNo = 0;
    const sales: { at: Date; discount: DiscountRow; date: Date }[] = [];

    for (const discount of biz.discounts) {
      const d = discount.seed;
      if (d.avgSales === 0) continue;
      for (let offset = -29; offset <= 0; offset++) {
        const date = dayOffset(offset);
        const weekday = toTashkent(fromTashkent(date, 720)).weekday;
        if (!d.weekdays.includes(weekday)) continue;

        // Dam olish kunlari sustroq, oxirgi haftalarda o'sish bor
        const trend = 0.8 + 0.35 * ((offset + 29) / 29);
        const weekend = weekday >= 6 && d.weekdays.length === 7 ? 0.6 : 1;
        let count = Math.min(d.dailyLimit, Math.round(d.avgSales * trend * weekend * (0.85 + rng() * 0.3)));
        let lastMinute = d.to - 1;
        if (offset === 0) {
          // Bugun: faqat hozirgacha bo'lgan sotuvlar
          if (today.minute <= d.from) continue;
          lastMinute = Math.min(lastMinute, today.minute - 1);
          count = Math.round((count * (lastMinute - d.from + 1)) / (d.to - d.from));
        }
        if (count <= 0) continue;

        for (let i = 0; i < count; i++) {
          sales.push({ at: new Date(fromTashkent(date, int(d.from, lastMinute)).getTime() + int(0, 59) * 1000), discount, date });
        }
        const lapsed = int(0, Math.max(1, Math.round(count * 0.3)));
        days.push({ discountId: discount.id, date, claimed: count, redeemed: count });
        views.push({ discountId: discount.id, date, count: (count + lapsed) * int(7, 10) });

        // Muddati o'tgan (kassaga kelmagan) kuponlar — voronka uchun; qoldiq allaqachon qaytarilgan.
        for (let i = 0; i < lapsed; i++) {
          const createdAt = fromTashkent(date, int(d.from, lastMinute));
          if (createdAt.getTime() + 10 * 60_000 >= now.getTime()) continue;
          coupons.push({
            code: couponCode(), discountId: discount.id, studentId: pick(students).id, date, status: "EXPIRED",
            secret: randomBytes(20), createdAt, expiresAt: new Date(createdAt.getTime() + 10 * 60_000),
            closedAt: new Date(createdAt.getTime() + 10 * 60_000),
          });
        }
      }
    }

    sales.sort((a, b) => a.at.getTime() - b.at.getTime());
    for (const sale of sales) {
      receiptNo += 1;
      const id = `seed_${biz.businessId.slice(-6)}_${receiptNo}`;
      const studentId = pick(students).id;
      const cashierId = pick(biz.cashierIds);
      const { originalPrice, paidAmount } = amounts(sale.discount.seed);
      const claimedAt = new Date(sale.at.getTime() - int(1, 8) * 60_000);
      coupons.push({
        id, code: couponCode(), discountId: sale.discount.id, studentId, date: sale.date, status: "REDEEMED",
        secret: randomBytes(20), createdAt: claimedAt, expiresAt: new Date(claimedAt.getTime() + 10 * 60_000), closedAt: sale.at,
      });
      redemptions.push({
        couponId: id, receiptNo, businessId: biz.businessId, discountId: sale.discount.id, studentId, cashierId,
        originalPrice, discountAmount: originalPrice - paidAmount, paidAmount, paymentType: pick(PAYMENTS), createdAt: sale.at,
      });
      if (rng() < 0.012) {
        attempts.push({
          businessId: biz.businessId, cashierId, result: pick(["EXPIRED", "EXPIRED", "OUT_OF_HOURS", "REPLAYED", "LIMIT"] as const),
          createdAt: new Date(sale.at.getTime() + int(20, 400) * 1000),
        });
      }
    }
    await db.business.update({ where: { id: biz.businessId }, data: { receiptSeq: receiptNo } });
  }

  // Dilnozaning tarixi (T7): 5 ta xarid, turli joylarda
  const byKey = new Map(live.flatMap((b) => b.discounts.map((d) => [d.seed.key, { biz: b, discount: d }] as const)));
  // Kino chegirmasi faqat seshanba kuni ishlaydi — oxirgi o'tgan seshanbani topamiz.
  const lastTuesday = -(((today.weekday - 2 + 7) % 7) || 7);
  const history: [key: string, daysAgo: number, minute: number, originalPrice: number, paidAmount: number][] = [
    ["osh", -1, 14 * 60 + 31, 38000, 26600],
    ["abonement", -5, 13 * 60 + 40, 450000, 290000],
    ["a4", -4, 11 * 60 + 12, 20000, 12000],
    ["kino", lastTuesday, 19 * 60 + 5, 45000, 25000],
    ["kapuchino", -10, 8 * 60 + 47, 28000, 21000],
  ];
  for (const [key, daysAgo, minute, originalPrice, paidAmount] of history) {
    const { biz, discount } = byKey.get(key)!;
    const date = dayOffset(daysAgo);
    const at = fromTashkent(date, minute);
    const business = await db.business.update({ where: { id: biz.businessId }, data: { receiptSeq: { increment: 1 } } });
    const id = `seed_dilnoza_${key}`;
    coupons.push({
      id, code: couponCode(), discountId: discount.id, studentId: dilnoza.id, date, status: "REDEEMED",
      secret: randomBytes(20), createdAt: new Date(at.getTime() - 4 * 60_000), expiresAt: new Date(at.getTime() + 6 * 60_000), closedAt: at,
    });
    redemptions.push({
      couponId: id, receiptNo: business.receiptSeq, businessId: biz.businessId, discountId: discount.id,
      studentId: dilnoza.id, cashierId: biz.cashierIds[0]!, originalPrice, discountAmount: originalPrice - paidAmount,
      paidAmount, paymentType: "CARD", createdAt: at,
    });
    const day = days.find((x) => x.discountId === discount.id && (x.date as Date).getTime() === date.getTime());
    if (day) {
      day.claimed = (day.claimed ?? 0) + 1;
      day.redeemed = (day.redeemed ?? 0) + 1;
    } else {
      days.push({ discountId: discount.id, date, claimed: 1, redeemed: 1 });
    }
  }

  const chunk = <T>(items: T[], size = 1000) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
  for (const part of chunk(coupons)) await db.coupon.createMany({ data: part });
  for (const part of chunk(redemptions)) await db.redemption.createMany({ data: part });
  await db.discountDay.createMany({ data: days });
  await db.discountView.createMany({ data: views });
  if (attempts.length) await db.scanAttempt.createMany({ data: attempts });

  // Yuborilgan bildirishnomalar (A3)
  await db.notification.createMany({
    data: [
      { title: "Seshanba — kino kuni", body: "Bugun Kadr Kinoteatrida talabalar uchun chipta 25 000 so'm. Faqat seshanba!", audience: "ALL_STUDENTS", scheduledAt: dayOffset(-1), sentAt: dayOffset(-1), status: "SENT", delivered: 158, opened: 49, createdById: admin.id },
      { title: "Imtihon haftasi: kofe arzon", body: "Qahva Bekatida kapuchino 21 000 so'm — har kuni 08:00–11:00.", audience: "UNIVERSITY", audienceIds: [uniByShort.get("TATU")!.id, uniByShort.get("O'zMU")!.id], scheduledAt: dayOffset(-3), sentAt: dayOffset(-3), status: "SENT", delivered: 71, opened: 30, createdById: admin.id },
      { title: "Yangi hamkor: Forma Fitnes", body: "Oylik abonement talabalar uchun 290 000 so'm.", audience: "DISTRICT", audienceIds: [districtByName.get("Yunusobod")!.id], scheduledAt: dayOffset(-5), sentAt: dayOffset(-5), status: "SENT", delivered: 38, opened: 10, createdById: admin.id },
    ],
  });

  const files = await maintainStoredFiles({ generateMissing: true });

  console.log(
    [
      "Seed tayyor:",
      `  namunaviy fayllar: ${files.generated}`,
      `  universitetlar: ${UNIVERSITIES.length}, tumanlar: ${DISTRICTS.length}, kategoriyalar: ${CATEGORIES.length}`,
      `  talabalar: ${students.length + 1} tasdiqlangan, ${PENDING_STUDENTS.length} navbatda`,
      `  bizneslar: ${BUSINESSES.length} faol, ${PENDING_BUSINESSES.length} navbatda`,
      `  sotuvlar: ${redemptions.length}, kuponlar: ${coupons.length}, rad etilgan skanlar: ${attempts.length}`,
      "  kirish uchun raqamlar: admin +998900000001 · talaba (Dilnoza) +998904123785",
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
