import { describe, expect, it } from "vitest";
import { detectPlatform, directionsUrl, orderProviders } from "./directions";

const BODOM = { point: { lat: 41.2796, lng: 69.2064 }, address: "Bunyodkor ko'chasi 14, Chilonzor-9" };

describe("yo'nalish havolalari", () => {
  it("rasmiy formatlar: Yandex lat,lng; 2GIS lng,lat", () => {
    expect(directionsUrl("yandex", BODOM, "ios")).toBe("https://yandex.uz/maps/?rtext=~41.2796,69.2064&rtt=auto");
    expect(directionsUrl("google", BODOM, "android")).toBe("https://www.google.com/maps/dir/?api=1&destination=41.2796%2C69.2064");
    expect(directionsUrl("dgis", BODOM, "android")).toBe("https://2gis.uz/routeSearch/rsType/car/to/69.2064,41.2796");
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
    expect(directionsUrl("google", noPoint, "ios")).toBe("https://www.google.com/maps/dir/?api=1&destination=Amir%20Temur%20108");
    expect(directionsUrl("dgis", noPoint, "ios")).toBe("https://2gis.uz/search/Amir%20Temur%20108");
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
    expect(orderProviders("dgis")).toEqual(["dgis", "yandex", "google", "yandexGo"]);
    expect(orderProviders(null)).toEqual(["yandex", "google", "dgis", "yandexGo"]);
    expect(orderProviders("waze")).toEqual(["yandex", "google", "dgis", "yandexGo"]);
  });
});
