import { describe, expect, it } from "vitest";
import { classifyQuery, parseTxFilter, txQuery } from "./admin-transactions";

describe("parseTxFilter", () => {
  it("standart qiymatlar", () => {
    expect(parseTxFilter({})).toEqual({ status: "all", period: "7", q: "", page: 1 });
  });
  it("noto'g'ri qiymatlar standartga qaytadi", () => {
    expect(parseTxFilter({ holat: "xxx", davr: "999", sahifa: "-3" })).toEqual({ status: "all", period: "7", q: "", page: 1 });
    expect(parseTxFilter({ sahifa: "1.5" }).page).toBe(1);
    expect(parseTxFilter({ sahifa: "99999" }).page).toBe(400);
  });
  it("to'g'ri qiymatlar va qidiruv kesiladi", () => {
    expect(parseTxFilter({ holat: "no", davr: "all", q: "  Dilnoza  ", sahifa: "3" })).toEqual({ status: "no", period: "all", q: "Dilnoza", page: 3 });
    expect(parseTxFilter({ q: "x".repeat(200) }).q).toHaveLength(60);
  });
  it("massiv bo'lsa birinchisi olinadi", () => {
    expect(parseTxFilter({ holat: ["ok", "no"] }).status).toBe("ok");
  });
});

describe("txQuery", () => {
  it("standart qiymatlar yozilmaydi", () => {
    expect(txQuery({ status: "all", period: "7", q: "", page: 1 })).toBe("");
  });
  it("filtr aylanib keladi", () => {
    const filter = { status: "ok", period: "30", q: "Bodom", page: 2 } as const;
    expect(parseTxFilter(Object.fromEntries(new URLSearchParams(txQuery(filter))))).toEqual(filter);
  });
});

describe("classifyQuery", () => {
  it("chek raqami", () => expect(classifyQuery("004821")).toMatchObject({ receipt: 4821, tin: null }));
  it("STIR — 9 raqam", () => expect(classifyQuery("301 234 567")).toMatchObject({ receipt: null, tin: "301234567" }));
  it("telefon bo'laklari raqam sifatida", () => expect(classifyQuery("+99890").digits).toBe("99890"));
  it("matn", () => expect(classifyQuery("Bodom")).toEqual({ receipt: null, tin: null, digits: "" }));
});
