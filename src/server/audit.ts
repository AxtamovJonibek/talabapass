import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

type AuditEntry = { actorId: string; action: string; entity: string; entityId: string; meta?: Prisma.InputJsonValue };

/** Audit yozuvi. Tranzaksiya ichida chaqirilsa — o'sha tranzaksiya klientini bering (amal bilan birga yoziladi). */
export async function audit(entry: AuditEntry, client: Pick<typeof db, "auditLog"> = db): Promise<void> {
  await client.auditLog.create({ data: entry });
}
