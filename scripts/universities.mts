/**
 * OTM ro'yxatini bazaga sinxronlaydi (idempotent): `npm run universities:sync`.
 * Deploy'da (vercel-build) migratsiyadan keyin avtomatik ishlaydi. Manba va tartib: src/server/universities/data.ts.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncUniversities } from "../src/server/universities/sync";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
try {
  const result = await syncUniversities(db);
  console.log(`Universitetlar: ${result.created} ta qo'shildi, ${result.updated} ta to'ldirildi, jami ${result.total} ta.`);
} finally {
  await db.$disconnect();
}
