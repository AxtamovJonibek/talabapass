import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatMinute } from "@/lib/time";
import { logBusinessChange } from "../business/change";

/**
 * Admin biznes nomidan qilgan amallar (chegirma, kassir, sotuv) — egasi ilovada ko'radigan "O'zgarishlar" jurnaliga
 * (`BusinessChange`, kim · nima · oldin → keyin). Maydon kaliti `discount_<maydon>` / `sale_*` / `cashier_*` — matni
 * `adminBusiness.changes.fields` da. Chegirma qiymati nomi bilan: «Lavash»: 20.
 */
type Tx = Pick<Prisma.TransactionClient, "businessChange">;
const ADMIN = (id: string) => ({ id, role: "ADMIN" as const });

const valueText = (field: string, value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (field === "fromMinute" || field === "toMinute") return formatMinute(Number(value) % 1440);
  if (Array.isArray(value)) return value.join(",");
  return String(value);
};

const withTitle = (title: string, text: string | null) => `«${title}»: ${text ?? "—"}`;

/** Chegirma maydonlari o'zgarishi: har maydon alohida qator */
export async function logDiscountChanges(tx: Tx, adminId: string, businessId: string, title: string, changed: Record<string, [unknown, unknown]>) {
  for (const [field, [before, after]] of Object.entries(changed)) {
    await logBusinessChange(tx, { businessId, actor: ADMIN(adminId), field: `discount_${field}`, oldValue: withTitle(title, valueText(field, before)), newValue: withTitle(title, valueText(field, after)) });
  }
}

/** Bitta hodisa (yaratildi, o'chirildi, to'xtatildi, sotuv bekor …): `detail` — qisqa izoh (nom, sabab) */
export async function logAdminEvent(tx: Tx, adminId: string, businessId: string, field: string, oldValue: string | null, newValue: string | null) {
  await logBusinessChange(tx, { businessId, actor: ADMIN(adminId), field, oldValue, newValue });
}
