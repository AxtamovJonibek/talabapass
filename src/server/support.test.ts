import { describe, expect, it } from "vitest";

import { supportContacts } from "./support";

describe("supportContacts", () => {
  it("telegram nomini @ va havoladan tozalaydi", () => {
    expect(supportContacts({ SUPPORT_TELEGRAM: "@talaba_help" } as never).telegram).toBe("talaba_help");
    expect(supportContacts({ SUPPORT_TELEGRAM: "https://t.me/talaba_help" } as never).telegram).toBe("talaba_help");
  });
  it("yaroqsiz yoki yo'q qiymat — null", () => {
    expect(supportContacts({ SUPPORT_TELEGRAM: "a b", SUPPORT_PHONE: "12345" } as never)).toEqual({ telegram: null, phone: null });
    expect(supportContacts({} as never)).toEqual({ telegram: null, phone: null });
  });
  it("telefonni probellardan tozalaydi", () => {
    expect(supportContacts({ SUPPORT_PHONE: "+998 90 123-45-67" } as never).phone).toBe("+998901234567");
  });
});
