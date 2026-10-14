"use server";

import { getCurrentUser } from "../auth/session";
import { latestVerification } from "../student/verification";

export type CardState = { status: "none" } | { status: "pending"; fileName: string };

/**
 * Veb sahifa (WT1) telefondan yuborilgan rasm kelganini bilish uchun vaqti-vaqti bilan so'raydi.
 * Faqat o'zining holatini qaytaradi.
 */
export async function myCardStateAction(): Promise<CardState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "STUDENT") return { status: "none" };
  const latest = await latestVerification(user.id);
  return latest?.status === "PENDING" ? { status: "pending", fileName: latest.fileName } : { status: "none" };
}
