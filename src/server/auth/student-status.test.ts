import { describe, expect, it } from "vitest";
import { fromTashkent } from "@/lib/time";
import { canUploadCard, effectiveStudentStatus, studentPathFor } from "./student-status";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const tashkent = (date: string, minute: number) => fromTashkent(day(date), minute);

describe("effectiveStudentStatus — tasdiq muddatli", () => {
  const expires = day("2027-06-30");

  it("muddat ichida APPROVED", () => {
    expect(effectiveStudentStatus("APPROVED", expires, tashkent("2026-10-14", 600))).toBe("APPROVED");
  });

  it("oxirgi kun (Toshkent vaqti bilan) tugaguncha amal qiladi", () => {
    expect(effectiveStudentStatus("APPROVED", expires, tashkent("2027-06-30", 0))).toBe("APPROVED");
    expect(effectiveStudentStatus("APPROVED", expires, tashkent("2027-06-30", 23 * 60 + 59))).toBe("APPROVED");
  });

  it("keyingi kundan boshlab EXPIRED", () => {
    expect(effectiveStudentStatus("APPROVED", expires, tashkent("2027-07-01", 0))).toBe("EXPIRED");
    expect(effectiveStudentStatus("APPROVED", expires, tashkent("2028-01-01", 0))).toBe("EXPIRED");
  });

  it("UTC bo'yicha hali kechagi kun bo'lsa ham Toshkent sanasi hisobga olinadi", () => {
    // 2027-06-30 20:00 UTC = 2027-07-01 01:00 Toshkent
    expect(effectiveStudentStatus("APPROVED", expires, new Date("2027-06-30T20:00:00Z"))).toBe("EXPIRED");
    // 2027-06-30 18:00 UTC = 2027-06-30 23:00 Toshkent
    expect(effectiveStudentStatus("APPROVED", expires, new Date("2027-06-30T18:00:00Z"))).toBe("APPROVED");
  });

  it("boshqa holatlarga ta'sir qilmaydi", () => {
    const later = tashkent("2030-01-01", 0);
    for (const status of ["DRAFT", "PENDING", "REJECTED", "EXPIRED", "BLOCKED"] as const) {
      expect(effectiveStudentStatus(status, expires, later)).toBe(status);
    }
    expect(effectiveStudentStatus("APPROVED", null, later)).toBe("APPROVED");
  });
});

describe("studentPathFor", () => {
  it("har bir holat o'z sahifasiga", () => {
    expect(studentPathFor("APPROVED")).toBe("/chegirmalar");
    expect(studentPathFor("PENDING")).toBe("/talaba/tekshiruv");
    expect(studentPathFor("REJECTED")).toBe("/talaba/tekshiruv");
    expect(studentPathFor("DRAFT")).toBe("/talaba/guvohnoma");
    expect(studentPathFor("EXPIRED")).toBe("/talaba/guvohnoma");
  });
});

describe("canUploadCard", () => {
  it("tasdiqlangan va bloklangan talaba yuklay olmaydi", () => {
    expect(canUploadCard("APPROVED")).toBe(false);
    expect(canUploadCard("BLOCKED")).toBe(false);
    for (const status of ["DRAFT", "PENDING", "REJECTED", "EXPIRED"] as const) expect(canUploadCard(status)).toBe(true);
  });
});
