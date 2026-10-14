/**
 * Dizayn bilan solishtirish uchun lokal bazada namunaviy foydalanuvchilar va tayyor sessiyalar yaratadi
 * (dizayndagi matnlarga mos: "Dilnoza Karimova", "TATU · 2-kurs", "guvohnoma_old.jpg · 1.8 MB", "bugun, 14:02").
 *
 *   node scripts/compare-fixtures.mjs
 *   node scripts/compare.mjs T3 /talaba/tekshiruv 390 --height=844 --cookie=tp_session=cmp-pending
 *
 * Faqat lokal ishlab chiqish uchun: production'da ishlamaydi. Qayta ishga tushirsa xavfsiz (ustidan yozadi).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import pg from "pg";

if (process.env.NODE_ENV === "production") throw new Error("Bu skript faqat lokal ishlab chiqish uchun.");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const hash = (token) => createHash("sha256").update(token).digest("hex");

const { rows: unis } = await db.query(`SELECT id FROM "University" WHERE "shortName" = 'TATU'`);
if (!unis[0]) throw new Error("Seed topilmadi — avval `npm run db:seed`.");
const tatu = unis[0].id;

// Bugun 14:02 (Toshkent, UTC+5)
const now = new Date(Date.now() + 5 * 3_600_000);
const sentAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14 - 5, 2));

const FIXTURES = [
  { id: "cmp_draft", phone: "+998000000301", token: "cmp-draft", status: "DRAFT" },
  { id: "cmp_pending", phone: "+998000000302", token: "cmp-pending", status: "PENDING", file: true },
  { id: "cmp_rejected", phone: "+998000000303", token: "cmp-rejected", status: "REJECTED", file: true, reject: "Rasm aniq emas" },
];

for (const f of FIXTURES) {
  await db.query(`DELETE FROM "User" WHERE id = $1 OR phone = $2`, [f.id, f.phone]);
  await db.query(`INSERT INTO "User" (id, phone, role, "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'STUDENT', 'Dilnoza', 'Karimova', now())`, [f.id, f.phone]);
  await db.query(
    `INSERT INTO "StudentProfile" ("userId", "universityId", course, "publicId", status, "updatedAt") VALUES ($1, $2, 'C2', $3, $4::"StudentStatus", now())`,
    [f.id, tatu, `TP-CMP-${f.id.slice(4, 8).toUpperCase()}`, f.status],
  );
  if (f.file) {
    await db.query(
      `INSERT INTO "Verification" (id, "studentId", "fileKey", "fileName", "fileSize", mime, status, "rejectReason", "createdAt")
       VALUES ($1, $2, $3, 'guvohnoma_old.jpg', 1887437, 'image/jpeg', $4::"VerificationStatus", $5, $6)`,
      [`${f.id}_v`, f.id, `seed/compare/${f.id}.jpg`, f.reject ? "REJECTED" : "PENDING", f.reject ?? null, sentAt],
    );
  }
  await db.query(`INSERT INTO "Session" (id, "userId", "tokenHash", "expiresAt") VALUES ($1, $2, $3, now() + interval '30 days')`, [
    `${f.id}_s`,
    f.id,
    hash(f.token),
  ]);
  console.log(`${f.status.padEnd(9)} --cookie=tp_session=${f.token}`);
}
await db.end();
