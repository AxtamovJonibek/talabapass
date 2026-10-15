import type { PrismaClient } from "../../generated/prisma/client";
import { normalizeName, shortNameFor } from "../../lib/universities";
import { UNIVERSITY_LIST, UNIVERSITY_SOURCE } from "./data";

/** Eski seed nomlari → rasmiy ro'yxatdagi nom (talabalar bog'langan yozuv saqlanadi, nomi yangilanadi). */
const ALIASES: Record<string, string> = {
  "Westminster xalqaro universiteti": "Toshkent Xalqaro Vestminster Universiteti",
  "Inha universiteti Toshkentda": "Toshkent shahridagi Inha universiteti",
  "Turin politexnika universiteti Toshkentda": "Turin politexnika universiteti Toshkent",
  "Toshkent davlat pedagogika universiteti": "O'zbekiston milliy pedagogika universiteti",
  "Toshkent tibbiyot akademiyasi": "Toshkent davlat tibbiyot universiteti",
};

/** "Ro'yxatda yo'q" tanlagan talabalar biriktiriladigan yozuv (ro'yxatda ko'rinmaydi). */
export const OTHER_UNIVERSITY_NAME = "Boshqa (ro'yxatda yo'q)";

type Db = Pick<PrismaClient, "university">;

/**
 * Rasmiy ro'yxatni bazaga qo'shadi. Idempotent: har deploy'da xavfsiz.
 * - mavjud (nomi mos yoki eski nom bilan) yozuv: faqat hali sinxronlanmagan (`source` yo'q) bo'lsa viloyat/tur/manba to'ldiriladi;
 *   admin tahrirlagan yozuvlarga tegilmaydi;
 * - yo'q yozuv: qo'shiladi;
 * - "Ro'yxatda yo'q" yozuvi: bo'lmasa yaratiladi.
 */
export async function syncUniversities(db: Db): Promise<{ created: number; updated: number; total: number }> {
  const existing = await db.university.findMany({ select: { id: true, name: true, source: true } });
  const byName = new Map(existing.map((u) => [normalizeName(u.name), u]));
  let created = 0;
  let updated = 0;

  for (const [region, kind, name, short] of UNIVERSITY_LIST) {
    const key = normalizeName(name);
    const oldName = Object.entries(ALIASES).find(([, target]) => normalizeName(target) === key)?.[0];
    const found = byName.get(key) ?? (oldName ? byName.get(normalizeName(oldName)) : undefined);
    if (!found) {
      const row = await db.university.create({ data: { name, shortName: short ?? shortNameFor(name), region, kind, source: UNIVERSITY_SOURCE }, select: { id: true, name: true, source: true } });
      byName.set(key, row);
      created++;
    } else if (found.source === null) {
      await db.university.update({ where: { id: found.id }, data: { name, region, kind, source: UNIVERSITY_SOURCE } });
      updated++;
    }
  }

  if (!(await db.university.findFirst({ where: { kind: "OTHER" }, select: { id: true } }))) {
    await db.university.create({ data: { name: OTHER_UNIVERSITY_NAME, shortName: "Boshqa", region: "—", kind: "OTHER", active: false, source: "tizim" } });
  }
  return { created, updated, total: await db.university.count() };
}
