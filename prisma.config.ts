import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Neon: migratsiyalar pooler'siz (to'g'ridan-to'g'ri) ulanish orqali; ilova esa DATABASE_URL (pooled) bilan ishlaydi.
    url: process.env["DATABASE_URL_UNPOOLED"] || process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
