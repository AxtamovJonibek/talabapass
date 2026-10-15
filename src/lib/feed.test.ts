import { describe, expect, it } from "vitest";
import { categoryCounts, endingSoon, filterDeals, matchesQuery, sortDeals, urgencyOf, type FeedDeal } from "./feed";

const NOW = new Date("2026-10-13T09:20:00Z"); // 14:20 Toshkent
const min = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();

function deal(over: Partial<FeedDeal> & { id: string }): FeedDeal {
  return {
    title: "Osh 0.5 porsiya + ko'k choy",
    businessId: "b1",
    store: "Bodom Choyxonasi",
    typeLabel: "Choyxona",
    district: "Chilonzor",
    category: "taom",
    icon: "bowl",
    images: [],
    tile: "#F4DCCB",
    ink: "#8A3410",
    badge: "−30%",
    price: { now: 26600, old: 38000 },
    note: null,
    percent: 30,
    fromMinute: 720,
    toMinute: 900,
    live: true,
    closesAt: min(240),
    opensAt: null,
    lastDay: false,
    left: 40,
    total: 60,
    point: null,
    distanceKm: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("qidiruv", () => {
  it("bir nechta so'z, katta-kichik harf va tutuq belgisi farqsiz", () => {
    expect(matchesQuery(deal({ id: "a" }), "KO‘K choy")).toBe(true);
    expect(matchesQuery(deal({ id: "a" }), "bodom osh")).toBe(true);
    expect(matchesQuery(deal({ id: "a" }), "kofe")).toBe(false);
  });

  it("kategoriya nomi bo'yicha", () => {
    expect(matchesQuery(deal({ id: "a" }), "taomlar", "Taomlar")).toBe(true);
  });
});

describe("filtr", () => {
  const list = [deal({ id: "a" }), deal({ id: "b", category: "kofe", live: false, closesAt: null, opensAt: min(60) })];

  it("kategoriya va 'faqat hozir ochiq'", () => {
    expect(filterDeals(list, { q: "", category: "kofe", liveOnly: false }).map((d) => d.id)).toEqual(["b"]);
    expect(filterDeals(list, { q: "", category: "all", liveOnly: true }).map((d) => d.id)).toEqual(["a"]);
  });

  it("sanoq — barcha chegirmalar bo'yicha", () => {
    expect(categoryCounts(list)).toEqual({ all: 2, taom: 1, kofe: 1 });
  });
});

describe("saralash", () => {
  const near = deal({ id: "near", distanceKm: 0.3, percent: 20, createdAt: "2026-10-02T00:00:00Z" });
  const far = deal({ id: "far", distanceKm: 3, percent: 44, closesAt: min(30) });
  const unknown = deal({ id: "unknown", distanceKm: null, percent: 25, createdAt: "2026-10-05T00:00:00Z" });
  const later = deal({ id: "later", live: false, closesAt: null, opensAt: min(60), distanceKm: 0.1 });

  it("eng yaqin: masofasizlar oxirida", () => {
    expect(sortDeals([unknown, far, near, later], "near").map((d) => d.id)).toEqual(["later", "near", "far", "unknown"]);
  });

  it("eng katta chegirma", () => {
    expect(sortDeals([near, far, unknown], "biggest").map((d) => d.id)).toEqual(["far", "unknown", "near"]);
  });

  it("tez tugaydi: ochiqlar oldin, tezroq yopiladigani birinchi", () => {
    expect(sortDeals([later, near, far], "ending").map((d) => d.id)).toEqual(["far", "near", "later"]);
  });

  it("yangi", () => {
    expect(sortDeals([far, near, unknown], "new").map((d) => d.id)).toEqual(["unknown", "near", "far"]);
  });
});

describe("tez tugaydi", () => {
  it("yopilishiga 2 soatdan kam", () => {
    expect(urgencyOf(deal({ id: "a", closesAt: min(40) }), NOW)).toEqual({ kind: "closing", minutes: 40 });
  });

  it("qoldiq oz (10 ta yoki 15% dan kam)", () => {
    expect(urgencyOf(deal({ id: "a", left: 9, total: 40 }), NOW)).toEqual({ kind: "lowStock" });
    expect(urgencyOf(deal({ id: "a", left: 290, total: 2000 }), NOW)).toEqual({ kind: "lowStock" });
    expect(urgencyOf(deal({ id: "a", left: 400, total: 2000 }), NOW)).toBeNull();
  });

  it("oxirgi kun", () => {
    expect(urgencyOf(deal({ id: "a", lastDay: true }), NOW)).toEqual({ kind: "lastDay" });
  });

  it("yopiq yoki qoldig'i tugagan — yo'q", () => {
    expect(urgencyOf(deal({ id: "a", live: false, closesAt: null, opensAt: min(10), left: 1 }), NOW)).toBeNull();
    expect(urgencyOf(deal({ id: "a", left: 0, closesAt: min(10) }), NOW)).toBeNull();
  });

  it("ko'pi bilan 3 ta, tezroq yopiladigani oldin", () => {
    const list = [
      deal({ id: "a", closesAt: min(90) }),
      deal({ id: "b", closesAt: min(20) }),
      deal({ id: "c", left: 3, total: 50 }),
      deal({ id: "d", lastDay: true, closesAt: min(300) }),
      deal({ id: "e" }),
    ];
    expect(endingSoon(list, NOW).map((x) => x.deal.id)).toEqual(["b", "a", "c"]);
  });
});
