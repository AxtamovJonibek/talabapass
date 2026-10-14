"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  approveBusiness,
  approveStudent,
  blockBusinessFromReview,
  blockStudent,
  rejectBusiness,
  rejectStudent,
  type ApproveStudentError,
} from "../admin/review";
import { BUSINESS_REJECT_REASONS, STUDENT_REJECT_REASONS } from "../admin/review-rules";
import { requireRole } from "../auth/session";

export type ReviewResult = { ok: true } | { ok: false; error: ApproveStudentError | "not_pending" | "invalid" };

const id = z.string().min(1).max(40);

/** A2 — talaba arizasini tasdiqlash (admin guvohnoma № va amal muddatini rasmdan kiritadi). */
export async function approveStudentAction(raw: unknown): Promise<ReviewResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ verificationId: id, cardNumber: z.string().max(40), cardExpiresAt: z.string().max(10) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  return approveStudent(input.data, admin.id);
}

export async function rejectStudentAction(raw: unknown): Promise<ReviewResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ verificationId: id, reason: z.enum(STUDENT_REJECT_REASONS) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const t = await getTranslations("admin.review.reasons.student");
  // Talabaga ko'rinadigan matn saqlanadi (T3 / WT1 da sabab sifatida chiqadi).
  return rejectStudent({ verificationId: input.data.verificationId, reasonKey: input.data.reason, reasonText: t(input.data.reason) }, admin.id);
}

export async function blockStudentAction(raw: unknown): Promise<ReviewResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ verificationId: id, reason: z.enum(STUDENT_REJECT_REASONS) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const t = await getTranslations("admin.review.reasons.student");
  return blockStudent({ verificationId: input.data.verificationId, reasonKey: input.data.reason, reasonText: t(input.data.reason) }, admin.id);
}

export async function approveBusinessAction(raw: unknown): Promise<ReviewResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  return approveBusiness(input.data.businessId, admin.id);
}

export async function rejectBusinessAction(raw: unknown): Promise<ReviewResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, reason: z.enum(BUSINESS_REJECT_REASONS) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const t = await getTranslations("admin.review.reasons.business");
  return rejectBusiness({ businessId: input.data.businessId, reasonKey: input.data.reason, reasonText: t(input.data.reason) }, admin.id);
}

export async function blockBusinessAction(raw: unknown): Promise<ReviewResult> {
  const admin = await requireRole("ADMIN");
  const input = z.object({ businessId: id, reason: z.enum(BUSINESS_REJECT_REASONS) }).safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  return blockBusinessFromReview({ businessId: input.data.businessId, reasonKey: input.data.reason }, admin.id);
}
