import { describe, expect, it } from "vitest";
import { profileSchema } from "./profile";

const ok = { firstName: "Dilnoza", lastName: "Karimova", course: "C2", faculty: "Dasturiy injiniring", districtId: "" };

describe("profileSchema", () => {
  it("to'g'ri ma'lumotni qabul qiladi; bo'sh tuman va fakultet — null", () => {
    expect(profileSchema.parse(ok)).toMatchObject({ districtId: null, faculty: "Dasturiy injiniring" });
    expect(profileSchema.parse({ ...ok, faculty: "  " }).faculty).toBeNull();
  });
  it("ismni tozalaydi va noto'g'ri belgilarni rad etadi", () => {
    expect(profileSchema.parse({ ...ok, firstName: "  Oʻktam " }).firstName).toBe("Oʻktam");
    for (const firstName of ["", "A", "1abc", "Ali<script>", "x".repeat(41)]) {
      expect(profileSchema.safeParse({ ...ok, firstName }).success).toBe(false);
    }
  });
  it("kurs va fakultet uzunligini tekshiradi", () => {
    expect(profileSchema.safeParse({ ...ok, course: "C9" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...ok, faculty: "x".repeat(81) }).success).toBe(false);
  });
});
