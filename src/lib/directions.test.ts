import { describe, expect, it } from "vitest";
import { defaultRouteMode, detectPlatform, directionsUrl, formatDistance, orderProviders } from "./directions";

const BODOM = { point: { lat: 41.2796, lng: 69.2064 }, address: "Bunyodkor ko'chasi 14, Chilonzor-9" };

describe("yo'nalish havolalari", () => {
  it("rasmiy formatlar, uch tur: Yandex rtt auto|mt|pd, Google travelmode driving|transit|walking", () => {
    expect(directionsUrl("yandex", BODOM, "ios", "car")).toBe("https://yandex.uz/maps/?rtext=~41.2796,69.2064&rtt=auto");
    expect(directionsUrl("yandex", BODOM, "android", "transit")).toBe("https://yandex.uz/maps/?rtext=~41.2796,69.2064&rtt=mt");
    expect(directionsUrl("yandex", BODOM, "desktop", "walk")).toBe("https://yandex.uz/maps/?rtext=~41.2796,69.2064&rtt=pd");
    expect(directionsUrl("google", BODOM, "android", "car")).toBe("https://www.google.com/maps/dir/?api=1&destination=41.2796%2C69.2064&travelmode=driving");
    expect(directionsUrl("google", BODOM, "ios", "transit")).toBe("https://www.google.com/maps/dir/?api=1&destination=41.2796%2C69.2064&travelmode=transit");
    expect(directionsUrl("google", BODOM, "desktop", "walk")).toBe("https://www.google.com/maps/dir/?api=1&destination=41.2796%2C69.2064&travelmode=walking");
  });

  it("Yandex Go: telefonda do'kon, kompyuterda sayt redirect'i", () => {
    const phone = directionsUrl("yandexGo", BODOM, "android")!;
    expect(phone).toBe("https://3.redirect.appmetrica.yandex.com/route?end-lat=41.2796&end-lon=69.2064&ref=talabapass&appmetrica_tracking_id=1178268795219780156");
    expect(directionsUrl("yandexGo", BODOM, "ios")).toBe(phone);
    expect(directionsUrl("yandexGo", BODOM, "desktop")).toContain("appmetrica_tracking_id=25395763362139037");
  });

  it("koordinata 6 xonagacha, ortiqcha nolsiz", () => {
    const url = directionsUrl("yandex", { point: { lat: 41.311081234567, lng: 69.2 }, address: "" }, "desktop");
    expect(url).toBe("https://yandex.uz/maps/?rtext=~41.311081,69.2&rtt=auto");
  });

  it("koordinatasiz — manzil bo'yicha qidiruv, Yandex Go yo'q", () => {
    const noPoint = { point: null, address: "Amir Temur 108" };
    expect(directionsUrl("yandex", noPoint, "ios")).toBe("https://yandex.uz/maps/?text=Amir%20Temur%20108");
    expect(directionsUrl("google", noPoint, "ios", "walk")).toBe("https://www.google.com/maps/dir/?api=1&destination=Amir%20Temur%20108&travelmode=walking");
    expect(directionsUrl("yandexGo", noPoint, "ios")).toBeNull();
  });
});

describe("platforma", () => {
  it("Android, iPhone, iPadOS (Macintosh + sensor), kompyuter", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; SM-A546E)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});

describe("tartib", () => {
  it("oxirgi ishlatilgani tepada, noma'lum qiymat e'tiborsiz", () => {
    expect(orderProviders("yandexGo")).toEqual(["yandexGo", "yandex", "google"]);
    expect(orderProviders(null)).toEqual(["yandex", "google", "yandexGo"]);
    // 2GIS olib tashlangan — eski saqlangan qiymat e'tiborsiz
    expect(orderProviders("dgis")).toEqual(["yandex", "google", "yandexGo"]);
  });
});

describe("marshrut turi va masofa", () => {
  it("standart: saqlangan tanlov, bo'lmasa 1 km dan yaqin — piyoda, aks holda jamoat transporti", () => {
    expect(defaultRouteMode(null, 0.6)).toBe("walk");
    expect(defaultRouteMode(null, 1)).toBe("transit");
    expect(defaultRouteMode(null, null)).toBe("transit");
    expect(defaultRouteMode("car", 0.3)).toBe("car");
    expect(defaultRouteMode("bike", 0.3)).toBe("walk");
  });

  it("masofa yaxlitlanadi, \"~\" yo'q", () => {
    expect([formatDistance(0.04), formatDistance(0.64), formatDistance(0.97)]).toEqual(["100 m", "600 m", "1 km"]);
    expect([formatDistance(1.24), formatDistance(6.04), formatDistance(12.6)]).toEqual(["1.2 km", "6 km", "13 km"]);
  });
});
