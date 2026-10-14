/**
 * Ombordagi fayllar: mavjudlarini qayta tozalash (EXIF/GPS va metama'lumot) va seed yozuvlari uchun
 * yo'q fayllarni namunaviy hujjat bilan to'ldirish.
 *
 *   npm run files:sanitize                 — ikkalasi
 *   npm run files:sanitize -- --no-generate — faqat mavjud fayllarni tozalash
 */
import "dotenv/config";
import { db } from "@/server/db";
import { maintainStoredFiles } from "@/server/storage/maintenance";

const generateMissing = !process.argv.includes("--no-generate");
const report = await maintainStoredFiles({ generateMissing });
console.log(`Tozalangan mavjud fayllar: ${report.sanitized}`);
console.log(`Namuna bilan to'ldirilgan (seed): ${report.generated}`);
if (report.unreadable.length) {
  console.log(`O'qib bo'lmagan (qo'lda ko'rib chiqing): ${report.unreadable.join(", ")}`);
  process.exitCode = 1;
}
await db.$disconnect();
