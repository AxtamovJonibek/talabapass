import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "@/api/client";

/**
 * Majburiy yangilash: `GET /api/v1/app-config` (tokensiz). Ilova versiyasi platforma `minVersion` idan past bo'lsa —
 * do'kondan yangilash shart (OTA bilan tuzatib bo'lmaydigan native o'zgarish yoki API mosligi). Oxirgi javob qurilmada
 * saqlanadi: internetsiz ochilganda ham chegara amal qiladi. Taqqoslash saytdagi `src/lib/app-version.ts` bilan bir xil.
 */

export type AppConfig = {
  minVersion: { ios: string; android: string };
  latestVersion: string;
  storeUrls: { ios: string | null; android: string | null };
};

const KEY = "tp.appConfig";
const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => (VERSION_RE.test(v.trim()) ? v.trim().split(".").map(Number) : [0, 0, 0]);
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i]! !== y[i]!) return x[i]! < y[i]! ? -1 : 1;
  return 0;
}

/** O'rnatilgan ilova versiyasi (app.json `version`; runtimeVersion "appVersion" — OTA uni o'zgartirmaydi) */
export const appVersion = () => Constants.expoConfig?.version ?? "1.0.0";

const platform = () => (Platform.OS === "ios" ? "ios" : "android");

export function mustUpdate(config: AppConfig, version = appVersion()): boolean {
  if (Platform.OS === "web") return false;
  return compareVersions(version, config.minVersion[platform()]) < 0;
}

export const storeUrl = (config: AppConfig) => config.storeUrls[platform()];

export async function cachedAppConfig(): Promise<AppConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppConfig) : null;
  } catch {
    return null;
  }
}

/** Serverdan (muvaffaqiyatli bo'lsa saqlanadi); tarmoq xatosida — oxirgi saqlangani */
export async function loadAppConfig(): Promise<AppConfig | null> {
  try {
    const config = await api<AppConfig>("/app-config", { auth: false });
    void AsyncStorage.setItem(KEY, JSON.stringify(config)).catch(() => undefined);
    return config;
  } catch {
    return cachedAppConfig();
  }
}
