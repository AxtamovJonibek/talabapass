import { describe, expect, it } from "vitest";
import { UNIVERSITY_LIST } from "@/server/universities/data";
import { cleanRequestedName, normalizeName, searchUniversities, shortNameFor } from "./universities";

describe("universitetlar", () => {
  it("tutuq belgilari va registr farqi nomni o'zgartirmaydi", () => {
    expect(normalizeName("O‘zbekiston  Milliy universiteti")).toBe(normalizeName("O'zbekiston milliy universiteti"));
    expect(normalizeName("Qoraqalpog’iston")).toBe("qoraqalpog'iston");
  });

  it("ro'yxat: 204 ta, nomlar takrorlanmaydi, hamma viloyat va tur bor", () => {
    expect(UNIVERSITY_LIST).toHaveLength(204);
    const names = UNIVERSITY_LIST.map((u) => normalizeName(u[2]));
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(UNIVERSITY_LIST.map((u) => u[0])).size).toBe(14);
    expect(UNIVERSITY_LIST.every((u) => ["STATE", "PRIVATE", "FOREIGN"].includes(u[1]))).toBe(true);
  });

  it("qisqa nom: bosh harflar", () => {
    expect(shortNameFor("Toshkent davlat sharqshunoslik universiteti")).toBe("TDSU");
    expect(shortNameFor("Sharq University")).toBe("SU");
    expect(shortNameFor("IMPULS")).toBe("IMPULS");
  });

  it("qidiruv: so'zlar tartibsiz, qisqa nom va viloyat bo'yicha", () => {
    const list = UNIVERSITY_LIST.map(([region, kind, name, short]) => ({ region, kind, name, shortName: short ?? shortNameFor(name) }));
    expect(searchUniversities(list, "tatu")[0]?.shortName).toBe("TATU");
    expect(searchUniversities(list, "samarqand tibbiyot").map((u) => u.name)).toContain("Samarqand davlat tibbiyot universiteti");
    expect(searchUniversities(list, "o‘zbekiston milliy")[0]?.name).toBe("O'zbekiston milliy pedagogika universiteti");
    expect(searchUniversities(list, "")).toHaveLength(204);
    expect(searchUniversities(list, "yo'q-bunday-oliygoh")).toEqual([]);
  });

  it("'Ro'yxatda yo'q' matni 3–120 belgi va harfli bo'lishi kerak", () => {
    expect(cleanRequestedName("  Yangi   Texnologiyalar Instituti ")).toBe("Yangi Texnologiyalar Instituti");
    expect(cleanRequestedName("ab")).toBeNull();
    expect(cleanRequestedName("12345")).toBeNull();
    expect(cleanRequestedName("x".repeat(121))).toBeNull();
  });
});
