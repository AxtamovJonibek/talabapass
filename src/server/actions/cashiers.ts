"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { normalizePhone } from "@/lib/format";
import { confirmPhone } from "../auth/phone-check";
import { createSession, forgetVerifiedPhone, requireRole } from "../auth/session";
import { acceptInvite, createInvite, removeCashier, revokeInvite, type AcceptError } from "../business/cashiers";
import type { AuthError } from "./auth";

export type InviteActionResult = { ok: true; path: string; expiresAt: string } | { ok: false; error: "notApproved" | "tooMany" };

/** B5 "+ Taklif qilish": bir martalik, 48 soatlik havola (token faqat shu javobda ko'rinadi). */
export async function createInviteAction(): Promise<InviteActionResult> {
  const user = await requireRole("BUSINESS_OWNER");
  const result = await createInvite(user.id);
  if (!result.ok) return result;
  return { ok: true, path: `/kassir/${result.token}`, expiresAt: result.expiresAt.toISOString() };
}

export async function revokeInviteAction(inviteId: string): Promise<{ ok: boolean }> {
  const user = await requireRole("BUSINESS_OWNER");
  return { ok: await revokeInvite(user.id, z.string().max(40).parse(inviteId)) };
}

/** Kassirni o'chirish — a'zolik yopiladi, kassirning sessiyalari darhol bekor qilinadi. */
export async function removeCashierAction(memberId: string): Promise<{ ok: boolean }> {
  const user = await requireRole("BUSINESS_OWNER");
  return { ok: await removeCashier(user.id, z.string().max(40).parse(memberId)) };
}

const NAME = /^[\p{L}][\p{L}'ʻʼ’` -]{1,39}$/u;
const acceptSchema = z.object({
  token: z.string().max(80),
  phone: z.string().max(32),
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  code: z.string().max(12).optional(),
});

export type AcceptField = "phone" | "firstName" | "lastName";
export type AcceptResult =
  | { ok: false; fields: AcceptField[] }
  | { ok: false; error: AuthError | AcceptError; retryInSeconds?: number }
  | { ok: true; step: "code"; phone: string; retryInSeconds?: number };

/** Kassir taklifini qabul qilish: ism, raqam → SMS kod → kassir hisobi va sessiya → skaner. */
export async function acceptInviteAction(raw: unknown): Promise<AcceptResult> {
  const input = acceptSchema.safeParse(raw);
  if (!input.success) return { ok: false, error: "invalid" };
  const phone = normalizePhone(input.data.phone);
  const firstName = input.data.firstName.trim();
  const lastName = input.data.lastName.trim();
  const fields: AcceptField[] = [];
  if (!phone) fields.push("phone");
  if (!NAME.test(firstName)) fields.push("firstName");
  if (!NAME.test(lastName)) fields.push("lastName");
  if (!phone || fields.length > 0) return { ok: false, fields };

  const check = await confirmPhone(phone, input.data.code);
  if (check.status === "code") return { ok: true, step: "code", phone, retryInSeconds: check.retryInSeconds };
  if (check.status === "error") return { ok: false, error: check.error, retryInSeconds: check.retryInSeconds };

  const accepted = await acceptInvite(input.data.token, phone, { firstName, lastName });
  if (!accepted.ok) return { ok: false, error: accepted.error };
  await forgetVerifiedPhone();
  await createSession(accepted.userId, (await headers()).get("user-agent"));
  return redirect({ href: "/biznes/skaner", locale: await getLocale() });
}
