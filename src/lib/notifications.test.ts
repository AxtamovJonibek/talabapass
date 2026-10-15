import { describe, expect, it } from "vitest";
import messages from "../../messages/uz.json";
import { BODY_MAX, checkSchedule, clip, defaultSchedule, notificationHref, notificationInput, parseLocalDateTime, pushPayload, TITLE_MAX, toLocalDateTime } from "./notifications";

const base = { audience: "ALL_STUDENTS", title: "Sarlavha", body: "Matn", linkType: "HOME", when: "now" } as const;

describe("notificationInput", () => {
  it("to'g'ri forma", () => {
    expect(notificationInput.safeParse(base).success).toBe(true);
  });
  it("sarlavha 50, matn 150 belgidan oshmaydi; bo'sh bo'lmaydi", () => {
    expect(notificationInput.safeParse({ ...base, title: "x".repeat(TITLE_MAX) }).success).toBe(true);
    expect(notificationInput.safeParse({ ...base, title: "x".repeat(TITLE_MAX + 1) }).success).toBe(false);
    expect(notificationInput.safeParse({ ...base, body: "x".repeat(BODY_MAX + 1) }).success).toBe(false);
    expect(notificationInput.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(notificationInput.safeParse({ ...base, body: "" }).success).toBe(false);
  });
  it("universitet/hudud tanlanmasa rad etiladi", () => {
    for (const audience of ["UNIVERSITY", "DISTRICT"] as const) {
      expect(notificationInput.safeParse({ ...base, audience }).success).toBe(false);
      expect(notificationInput.safeParse({ ...base, audience, audienceIds: ["a1"] }).success).toBe(true);
    }
  });
  it("kategoriya/chegirma havolasi uchun linkId majburiy", () => {
    expect(notificationInput.safeParse({ ...base, linkType: "CATEGORY" }).success).toBe(false);
    expect(notificationInput.safeParse({ ...base, linkType: "DISCOUNT", linkId: "d1" }).success).toBe(true);
  });
  it("tizim auditoriyasi (USER) admin formasidan qabul qilinmaydi", () => {
    expect(notificationInput.safeParse({ ...base, audience: "USER" }).success).toBe(false);
  });
});

describe("rejalashtirish vaqti (Toshkent)", () => {
  // 2026-10-15 14:00 Toshkent = 09:00 UTC
  const now = new Date("2026-10-15T09:00:00Z");
  it("datetime-local ↔ UTC", () => {
    expect(parseLocalDateTime("2026-10-16T08:30")!.toISOString()).toBe("2026-10-16T03:30:00.000Z");
    expect(toLocalDateTime(new Date("2026-10-16T03:30:00Z"))).toBe("2026-10-16T08:30");
  });
  it("noto'g'ri qiymatlar", () => {
    for (const bad of ["", "2026-10-16", "2026-13-01T08:30", "2026-02-31T08:30", "2026-10-16T25:00", "abc"]) expect(parseLocalDateTime(bad), bad).toBeNull();
  });
  it("standart vaqt — ertaga 08:30", () => {
    expect(toLocalDateTime(defaultSchedule(now))).toBe("2026-10-16T08:30");
  });
  it("Toshkent yarim tunidan keyin 'ertaga' ham Toshkent bo'yicha", () => {
    // 2026-10-15 20:00 UTC = 16.10 01:00 Toshkent → ertaga 17.10
    expect(toLocalDateTime(defaultSchedule(new Date("2026-10-15T20:00:00Z")))).toBe("2026-10-17T08:30");
  });
  it("hozir — darhol", () => {
    expect(checkSchedule("now", undefined, now)).toEqual({ ok: true, at: now, immediate: true });
  });
  it("o'tgan, juda yaqin va juda uzoq vaqt rad etiladi", () => {
    expect(checkSchedule("later", "2026-10-15T10:00", now)).toEqual({ ok: false, error: "past" }); // 05:00 UTC — o'tgan
    expect(checkSchedule("later", "2026-10-15T14:01", now)).toEqual({ ok: false, error: "past" }); // 1 daqiqadan keyin
    expect(checkSchedule("later", "2027-03-01T08:30", now)).toEqual({ ok: false, error: "far" });
    expect(checkSchedule("later", undefined, now)).toEqual({ ok: false, error: "invalid" });
  });
  it("kelajakdagi vaqt qabul qilinadi", () => {
    const result = checkSchedule("later", "2026-10-16T08:30", now);
    expect(result).toMatchObject({ ok: true, immediate: false });
  });
});

describe("havola va push yuklamasi", () => {
  it("manzillar", () => {
    expect(notificationHref({ type: "HOME" }, "/chegirmalar")).toBe("/chegirmalar");
    expect(notificationHref({ type: "DISCOUNT", id: "d 1" }, "/chegirmalar")).toBe("/chegirmalar/d%201");
    expect(notificationHref({ type: "CATEGORY", id: "kofe" }, "/chegirmalar")).toBe("/chegirmalar?kategoriya=kofe");
    // id yo'q bo'lsa — bosh sahifa
    expect(notificationHref({ type: "DISCOUNT", id: null }, "/biznes")).toBe("/biznes");
  });
  it("yuklama kichik va to'liq", () => {
    const payload = pushPayload({ id: "n1", title: "A", body: "B" }, "/x");
    expect(JSON.parse(payload)).toEqual({ title: "A", body: "B", url: "/x", tag: "n1" });
    expect(Buffer.byteLength(pushPayload({ id: "n1", title: "ы".repeat(50), body: "ы".repeat(150) }, "/chegirmalar/x"))).toBeLessThan(4000);
  });
});

describe("clip", () => {
  it("qisqartiradi va '…' qo'shadi", () => {
    expect(clip("abcdef", 6)).toBe("abcdef");
    expect(clip("abcdefg", 6)).toBe("abcde…");
    expect(clip("  abc  ", 10)).toBe("abc");
    expect(clip("abc", 0)).toBe("");
  });
});

describe("tizim xabarlari matni (messages/uz.json)", () => {
  const direct = messages.notifications.direct;
  it("sarlavha 50, matn 150 belgidan oshmaydi (eng uzun sabab bilan ham qisqartiriladi)", () => {
    for (const key of ["studentApproved", "studentRejected", "businessApproved", "businessRejected"] as const) {
      expect(direct[key].title.length, key).toBeLessThanOrEqual(TITLE_MAX);
      // sabab bo'sh bo'lganda doimiy qism sig'ishi kerak — qolgani sabab uchun
      expect(direct[key].body.replace("{reason}", "").length, key).toBeLessThan(BODY_MAX - 20);
    }
  });
});
