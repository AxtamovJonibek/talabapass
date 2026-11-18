import { describe, expect, it } from "vitest";
import { canActivateMore, DEFAULT_PERMISSIONS, permissionsFrom, permissionsInput, restrictions } from "./permissions";

describe("biznes ruxsatlari", () => {
  it("qator yo'q — standart: hammasi ruxsat, cheklovsiz, moderatsiya bilan", () => {
    expect(permissionsFrom(null)).toEqual(DEFAULT_PERMISSIONS);
    expect(DEFAULT_PERMISSIONS.autoApproveDiscounts).toBe(false);
    expect(restrictions(DEFAULT_PERMISSIONS)).toEqual([]);
  });

  it("faollar chegarasi", () => {
    expect(canActivateMore({ maxActiveDiscounts: null }, 500)).toBe(true);
    expect(canActivateMore({ maxActiveDiscounts: 2 }, 1)).toBe(true);
    expect(canActivateMore({ maxActiveDiscounts: 2 }, 2)).toBe(false);
    expect(canActivateMore({ maxActiveDiscounts: 0 }, 0)).toBe(false);
  });

  it("panel ogohlantirishi faqat cheklovlar uchun (avtomatik tasdiq — cheklov emas)", () => {
    const p = { ...DEFAULT_PERMISSIONS, autoApproveDiscounts: true, canAddCashiers: false, maxActiveDiscounts: 3 };
    expect(restrictions(p)).toEqual(["canAddCashiers", "maxActiveDiscounts"]);
  });

  it("kirish sxemasi: manfiy yoki kasr chegara rad etiladi", () => {
    expect(permissionsInput.safeParse({ ...DEFAULT_PERMISSIONS, maxActiveDiscounts: -1 }).success).toBe(false);
    expect(permissionsInput.safeParse({ ...DEFAULT_PERMISSIONS, maxActiveDiscounts: 1.5 }).success).toBe(false);
    expect(permissionsInput.safeParse({ ...DEFAULT_PERMISSIONS, maxActiveDiscounts: 5 }).success).toBe(true);
  });
});
