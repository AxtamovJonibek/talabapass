import { z } from "zod";

/**
 * Biznesga admin bergan ruxsatlar (`BusinessPermissions`). Qator yo'q bo'lsa — standart: hammasi ruxsat, cheklovsiz,
 * moderatsiya bilan. Forma (admin) va server bitta sxemadan.
 */
export type BusinessPermissionSet = {
  canCreateDiscounts: boolean;
  autoApproveDiscounts: boolean;
  canPreorder: boolean;
  canAddCashiers: boolean;
  /** null — cheklanmagan */
  maxActiveDiscounts: number | null;
  canEditProfile: boolean;
  canEditContacts: boolean;
};

export const DEFAULT_PERMISSIONS: BusinessPermissionSet = {
  canCreateDiscounts: true,
  autoApproveDiscounts: false,
  canPreorder: true,
  canAddCashiers: true,
  maxActiveDiscounts: null,
  canEditProfile: true,
  canEditContacts: true,
};

export const PERMISSION_FLAGS = ["canCreateDiscounts", "autoApproveDiscounts", "canPreorder", "canAddCashiers", "canEditProfile", "canEditContacts"] as const;
export type PermissionFlag = (typeof PERMISSION_FLAGS)[number];

export const ACTIVE_DISCOUNTS_MAX = 1000;

export const permissionsInput = z.object({
  canCreateDiscounts: z.boolean(),
  autoApproveDiscounts: z.boolean(),
  canPreorder: z.boolean(),
  canAddCashiers: z.boolean(),
  maxActiveDiscounts: z.number().int().min(0).max(ACTIVE_DISCOUNTS_MAX).nullable(),
  canEditProfile: z.boolean(),
  canEditContacts: z.boolean(),
});

/** Yana bitta chegirmani faollashtirib bo'ladimi (hozir faollari `active` ta). */
export const canActivateMore = (p: Pick<BusinessPermissionSet, "maxActiveDiscounts">, active: number) => p.maxActiveDiscounts === null || active < p.maxActiveDiscounts;

/** Bazadagi qator (yoki null) → to'liq to'plam */
export function permissionsFrom(row: Partial<BusinessPermissionSet> | null | undefined): BusinessPermissionSet {
  if (!row) return { ...DEFAULT_PERMISSIONS };
  return {
    canCreateDiscounts: row.canCreateDiscounts ?? DEFAULT_PERMISSIONS.canCreateDiscounts,
    autoApproveDiscounts: row.autoApproveDiscounts ?? DEFAULT_PERMISSIONS.autoApproveDiscounts,
    canPreorder: row.canPreorder ?? DEFAULT_PERMISSIONS.canPreorder,
    canAddCashiers: row.canAddCashiers ?? DEFAULT_PERMISSIONS.canAddCashiers,
    maxActiveDiscounts: row.maxActiveDiscounts ?? null,
    canEditProfile: row.canEditProfile ?? DEFAULT_PERMISSIONS.canEditProfile,
    canEditContacts: row.canEditContacts ?? DEFAULT_PERMISSIONS.canEditContacts,
  };
}

/** Biznes paneliga ko'rinadigan cheklov (avtomatik tasdiq — cheklov emas) */
export type RestrictionKey = Exclude<PermissionFlag, "autoApproveDiscounts"> | "maxActiveDiscounts";

/** O'chirilgan (standartdan farq qiladigan, cheklovchi) ruxsatlar — panelda ogohlantirish uchun */
export function restrictions(p: BusinessPermissionSet): RestrictionKey[] {
  const off = (["canCreateDiscounts", "canPreorder", "canAddCashiers", "canEditProfile", "canEditContacts"] as const).filter((k) => !p[k]);
  return p.maxActiveDiscounts === null ? off : [...off, "maxActiveDiscounts"];
}
