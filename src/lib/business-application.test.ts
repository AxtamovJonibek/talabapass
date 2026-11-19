import { describe, expect, it } from "vitest";
import { validateQuickApplication } from "./business-application";

const ok = { name: "Kofe Bar", address: "Toshkent, Chilonzor 9", tin: "307 482 915", phone: "+998901112233", telegram: "@kofe_bar" };

describe("validateQuickApplication", () => {
  it("to'g'ri ariza tozalanadi", () => {
    expect(validateQuickApplication(ok)).toEqual({ ok: true, value: { name: "Kofe Bar", address: "Toshkent, Chilonzor 9", tin: "307482915", phone: "+998901112233", telegram: "kofe_bar" } });
  });

  it("hamma maydon majburiy: bo'sh telefon va Telegram rad etiladi", () => {
    const bad = validateQuickApplication({ ...ok, name: "A", tin: "123", phone: "", telegram: "" });
    expect(bad).toEqual({ ok: false, fields: ["name", "tin", "phone", "telegram"] });
  });
});
