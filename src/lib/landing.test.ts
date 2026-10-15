import { describe, expect, it } from "vitest";
import { STATS_MIN, statsVisible } from "./landing";

describe("landing raqamlari", () => {
  it("hammasi chegaradan yuqori — ko'rinadi", () => {
    expect(statsVisible({ students: 161, businesses: 8, discounts: 9, savedTotal: 2_000_000 })).toBe(true);
  });

  it("bittasi past bo'lsa — butun bo'lim yashiriladi", () => {
    expect(statsVisible({ ...STATS_MIN, students: STATS_MIN.students - 1 })).toBe(false);
    expect(statsVisible({ ...STATS_MIN, savedTotal: 0 })).toBe(false);
  });

  it("aynan chegarada — ko'rinadi", () => {
    expect(statsVisible(STATS_MIN)).toBe(true);
  });
});
