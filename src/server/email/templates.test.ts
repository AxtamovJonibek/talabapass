import { describe, expect, it } from "vitest";
import { emailLocale, resetCodeEmail } from "./templates";

describe("resetCodeEmail", () => {
  it("uch tilda: mavzu, kod va muddat matnda ham, HTML'da ham", () => {
    for (const locale of ["uz", "ru", "en"] as const) {
      const mail = resetCodeEmail(locale, "482913", 10);
      expect(mail.subject).toContain("talabaPass");
      expect(mail.text).toContain("482 913");
      expect(mail.html).toContain("482 913");
      expect(mail.text).toContain("10");
      expect(mail.html).toContain(`lang="${locale}"`);
    }
    expect(resetCodeEmail("ru", "000000", 10).subject).toMatch(/пароля/);
  });

  it("noma'lum til — o'zbekcha", () => {
    expect(emailLocale("de")).toBe("uz");
    expect(emailLocale("RU")).toBe("ru");
    expect(emailLocale(null)).toBe("uz");
  });
});
