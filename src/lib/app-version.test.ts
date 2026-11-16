import { describe, expect, it } from "vitest";
import { appConfigFromEnv, appConfigProblems, compareVersions } from "./app-version";

describe("ilova versiyalari", () => {
  it("raqamlar bo'yicha taqqoslanadi (matn emas)", () => {
    expect(compareVersions("1.2.10", "1.10.0")).toBe(-1);
    expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("buzuq", "0.0.0")).toBe(0);
  });

  it("env bo'sh — hech kim to'silmaydi, Play havolasi standart", () => {
    expect(appConfigFromEnv({})).toEqual({
      minVersion: { ios: "1.0.0", android: "1.0.0" },
      latestVersion: "1.0.0",
      storeUrls: { ios: null, android: "https://play.google.com/store/apps/details?id=uz.talabapass.app" },
    });
  });

  it("env qiymatlari; noto'g'risi standartga tushadi va env-check'da xato", () => {
    const env = { APP_MIN_VERSION_IOS: "1.2.0", APP_MIN_VERSION_ANDROID: "1.3", APP_LATEST_VERSION: "1.4.1", APP_STORE_URL_IOS: "https://apps.apple.com/app/id1", APP_STORE_URL_ANDROID: "http://x" };
    expect(appConfigFromEnv(env)).toMatchObject({ minVersion: { ios: "1.2.0", android: "1.0.0" }, latestVersion: "1.4.1", storeUrls: { ios: "https://apps.apple.com/app/id1" } });
    expect(appConfigProblems(env)).toHaveLength(2);
    expect(appConfigProblems({})).toEqual([]);
  });
});
