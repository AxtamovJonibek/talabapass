import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL o'rnatilmagan");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Dev rejimida hot-reload har safar yangi ulanish ochmasligi uchun klient global'da saqlanadi.
// Sxema o'zgarib klient qayta generatsiya qilinsa (yangi model), eski nusxa yaroqsiz — imzo bilan aniqlanadi.
const signature = Object.keys(Prisma.ModelName).sort().join(",");
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSignature?: string };

export const db =
  globalForPrisma.prisma && globalForPrisma.prismaSignature === signature ? globalForPrisma.prisma : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaSignature = signature;
}
