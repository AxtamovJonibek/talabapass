/**
 * Seed chegirmalari uchun mahsulotiga mos rasmlar (Unsplash, `docs/rasmlar.md`).
 * Fayllar `prisma/seed-images/*.webp` (siqilgan), omborga `storage()` orqali yuklanadi.
 * Idempotent: rasmi bor chegirmaga tegmaydi; seed va `npm run seed:images` / `npm run staging:images` ishlatadi.
 */
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";
import { storage } from "../src/server/storage";

/** Chegirma nomi → rasm fayllari (Unsplash ID) */
export const SEED_IMAGES: Record<string, string[]> = {
  "Osh 0.5 porsiya + ko'k choy": ["pwFCqIdUe8w", "a85Px4ZCSK4", "zQFV2SW0FVI"],
  "Nonushta: somsa + choy": ["WJOHwwS1jYc", "Vzvkp94lk_4", "_tLxpvQtrDE"],
  "Ko'k choy choynakda": ["D90_p0ZinVA", "y0n0hsn1_tE"],
  "A4 chop etish, 1 varaq": ["Da9qsu-0a00", "Tzm3Oyu_6sk"],
  "Kino chiptasi, 2D seans": ["3OJHargMpX8", "tAaCtM453kM", "IM6t12LL7KM"],
  "Lavash + ayron": ["SNLfVYmL8os", "YDSWdXBaFdI", "xq04aTV-LVk"],
  "Oylik abonement, 12 mashg'ulot": ["uYnHRrm63uo", "20jX9b35r_M", "WvDYdXDzkhs"],
  "Bir martalik tashrif": ["CQfNt66ttZM", "sHfo3WOgGTU"],
  "Kapuchino 300 ml": ["zUNs99PGDg0", "IHR3-sOUcT0", "yVwtB6uOBRI"],
  "Soch olish + soqol": ["wJoB8D3hnzc", "BX8OTlmHOaI", "tgPrIYnW3g4"],
  "Barcha badiiy kitoblar": ["tv8PIPPY3rQ", "P8gLaJ-PZL0", "GbGit2Az57Y"],
};

export async function attachSeedImages(db: PrismaClient): Promise<number> {
  let added = 0;
  for (const [title, ids] of Object.entries(SEED_IMAGES)) {
    const discounts = await db.discount.findMany({ where: { title, images: { none: {} } }, select: { id: true } });
    for (const discount of discounts) {
      for (const [sort, id] of ids.entries()) {
        const bytes = await readFile(path.join(import.meta.dirname, "seed-images", `${id}.webp`));
        const fileKey = `discounts/${discount.id}/${randomUUID()}.webp`;
        await storage().put(fileKey, bytes);
        await db.discountImage.create({ data: { discountId: discount.id, fileKey, sort } });
        added++;
      }
    }
  }
  return added;
}
