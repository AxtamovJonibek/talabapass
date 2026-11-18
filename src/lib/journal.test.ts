import { describe, expect, it } from "vitest";
import { journalDetails, tashkentStamp } from "./journal";

describe("jurnal tafsiloti", () => {
  it("oldin → keyin qatorlari va qolgan kalitlar", () => {
    expect(journalDetails({ changed: { canPreorder: [true, false], maxActiveDiscounts: [null, 3] }, reason: "test" })).toEqual([
      "canPreorder: true → false",
      "maxActiveDiscounts: — → 3",
      "reason: test",
    ]);
  });

  it("parol, kod, token, xesh nomli kalitlar hech qachon ko'rsatilmaydi", () => {
    const lines = journalDetails({ changed: { passwordHash: ["a", "b"], name: ["x", "y"] }, code: "123456", resetToken: "t", secret: "s", via: "web" });
    expect(lines).toEqual(["name: x → y", "via: web"]);
    expect(lines.join(" ")).not.toMatch(/123456|passwordHash/);
  });

  it("massivli `changed`, bo'sh va uzun qiymatlar", () => {
    expect(journalDetails({ changed: ["name", "address"] })).toEqual(["changed: name, address"]);
    expect(journalDetails(null)).toEqual([]);
    expect(journalDetails({ note: "a".repeat(200) })[0]!.length).toBeLessThanOrEqual(86);
  });

  it("Toshkent vaqti", () => {
    expect(tashkentStamp(new Date("2026-11-19T09:05:00Z"))).toBe("2026-11-19 14:05");
  });
});
