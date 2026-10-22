/** Mavjud bazadagi seed chegirmalariga rasm biriktirish (idempotent): `npm run seed:images`, sinov serveri — `npm run staging:images`. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { attachSeedImages } from "../prisma/seed-images";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
console.log(`Biriktirilgan rasmlar: ${await attachSeedImages(db)}`);
await db.$disconnect();
