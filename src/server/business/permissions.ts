import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { permissionsFrom, type BusinessPermissionSet } from "@/lib/permissions";
import { db } from "../db";

type Client = Prisma.TransactionClient | typeof db;

/** Biznes ruxsatlari (qator yo'q — standart). Panel, server action va API shu funksiya orqali tekshiradi. */
export async function permissionsOf(businessId: string, client: Client = db): Promise<BusinessPermissionSet> {
  return permissionsFrom(await client.businessPermissions.findUnique({ where: { businessId } }));
}

/** Egasining (birinchi) biznesi ruxsatlari — panel sahifalari uchun */
export async function ownerPermissions(ownerId: string): Promise<BusinessPermissionSet & { businessId: string | null }> {
  const business = await db.business.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" }, select: { id: true, permissions: true } });
  return { ...permissionsFrom(business?.permissions), businessId: business?.id ?? null };
}

/** Hozir faol chegirmalar soni (`maxActiveDiscounts` uchun); `except` — tahrirlanayotgani */
export const activeDiscountCount = (businessId: string, except: string | null = null, client: Client = db) =>
  client.discount.count({ where: { businessId, status: "ACTIVE", ...(except ? { id: { not: except } } : {}) } });

/** Talabaga band qilish ochiqmi (admin `canPreorder` ni o'chirmagan) — Prisma filtri */
export const PREORDER_ALLOWED: Prisma.BusinessWhereInput = { OR: [{ permissions: null }, { permissions: { canPreorder: true } }] };
