import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { appApi } from "@/api/endpoints";

/**
 * Push (expo-notifications). Modul faqat kerak bo'lganda yuklanadi va hech qachon tashlamaydi: web'da, Expo Go Android'da
 * (SDK 53 dan masofaviy push yo'q — import'ning o'zi ogohlantiradi), emulyatorda yoki EAS `projectId` bo'lmasa
 * (`eas init` qilinmagan) — jimgina o'tkazib yuboriladi, sababi console'ga (`[push]`).
 *
 * - Ruxsat va Expo push tokeni → `POST /push/devices` (server `PushDevice` ni sessiyaga bog'laydi; chiqishda o'chadi).
 * - Android kanallari: `default` (Bildirishnomalar) va `orders` (Buyurtmalar — yuqori muhimlik, tovush). Server xabarida
 *   `channelId` (`server/notifications/expo-push.ts`).
 * - Ilova ochiq paytda: banner va ro'yxatda ko'rinadi, tovushsiz (ochiq ilova o'z signalini chaladi — skaner, buyurtmalar),
 *   ikonka raqami (badge) serverdan keladi (o'qilmaganlar soni); ilovada o'qilganda `syncBadge`.
 * - Bosilgan xabar: `data.url` (saytdagi yo'l) → `onPushOpen` → `pushRoute` (ilova ekrani).
 */

type NotificationsModule = typeof import("expo-notifications");

const unsupported = () => Platform.OS === "web" || (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === "android");

let loaded: Promise<NotificationsModule | null> | null = null;

/** Modul + bir martalik sozlash (handler, kanallar). Qo'llanmaydigan muhitda — null. */
function notifications(): Promise<NotificationsModule | null> {
  loaded ??= (async () => {
    if (unsupported()) return null;
    try {
      const N = await import("expo-notifications");
      N.setNotificationHandler({
        // Ochiq ilovada tepadan o'zimizning banner (`PushHandler`) tushadi — tizim banneri ikkilanmasin
        handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
      });
      if (Platform.OS === "android") {
        await N.setNotificationChannelAsync("default", { name: "Bildirishnomalar", importance: N.AndroidImportance.HIGH });
        await N.setNotificationChannelAsync("orders", {
          name: "Buyurtmalar",
          description: "Yangi buyurtma va uning holati",
          importance: N.AndroidImportance.HIGH,
          sound: "default",
          vibrationPattern: [0, 200, 120, 200],
        });
      }
      return N;
    } catch (e) {
      console.warn("[push] modul yuklanmadi:", e instanceof Error ? e.message : e);
      return null;
    }
  })();
  return loaded;
}

const projectIdOf = () => {
  const id = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
  // app.json dagi "REPLACE_WITH_EAS_PROJECT_ID" — hali `eas init` qilinmagan
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
};

/** Ruxsat so'rash va tokenni serverga yuborish (har kirishda — token o'zgargan bo'lsa yangilanadi). */
export async function registerPush(): Promise<void> {
  try {
    const N = await notifications();
    if (!N) return console.log("[push] bu muhitda push yo'q (web yoki Expo Go Android) — dev build kerak");
    const Device = await import("expo-device");
    if (!Device.isDevice) return console.log("[push] emulyator — push tokeni olinmaydi");
    let { status } = await N.getPermissionsAsync();
    if (status !== "granted") ({ status } = await N.requestPermissionsAsync());
    if (status !== "granted") return console.log("[push] ruxsat berilmadi");
    const projectId = projectIdOf();
    if (!projectId) return console.log("[push] EAS projectId yo'q (npx eas-cli init) — token olinmadi");
    const { data } = await N.getExpoPushTokenAsync({ projectId });
    await appApi.registerPush(data, Platform.OS === "ios" ? "IOS" : "ANDROID");
    console.log("[push] qurilma ro'yxatga olindi");
  } catch (e) {
    console.warn("[push] o'tkazib yuborildi:", e instanceof Error ? e.message : e);
  }
}

/** Ikonka raqami = o'qilmagan xabarlar (bildirishnomalar ekrani o'qiganda va ilova ochilganda) */
export async function syncBadge(unread: number): Promise<void> {
  try {
    const N = await notifications();
    await N?.setBadgeCountAsync(Math.max(0, unread));
  } catch {
    // badge muhim emas
  }
}

export type PushMessage = { title: string; body: string; url: string | null };

const urlOf = (data: unknown) => {
  const url = (data as { url?: unknown } | undefined)?.url;
  return typeof url === "string" ? url : null;
};

/**
 * Bosilgan push xabari: ilova yopiq turganda bosilgani ham (ishga tushgach bir marta) va ochiq paytda bosilganlari.
 * Qaytadi: obunani bekor qilish.
 */
export function onPushOpen(handler: (url: string | null) => void): () => void {
  let stopped = false;
  let sub: { remove(): void } | null = null;
  void notifications().then(async (N) => {
    if (!N || stopped) return;
    const last = await N.getLastNotificationResponseAsync().catch(() => null);
    if (last && !stopped) {
      handler(urlOf(last.notification.request.content.data));
      await N.clearLastNotificationResponseAsync?.().catch(() => undefined);
    }
    if (stopped) return;
    sub = N.addNotificationResponseReceivedListener((response) => handler(urlOf(response.notification.request.content.data)));
  });
  return () => {
    stopped = true;
    sub?.remove();
  };
}

/** Ilova ochiq paytda kelgan push (banner ko'rsatish uchun). Qaytadi: obunani bekor qilish. */
export function onPushReceived(handler: (message: PushMessage) => void): () => void {
  let stopped = false;
  let sub: { remove(): void } | null = null;
  void notifications().then((N) => {
    if (!N || stopped) return;
    sub = N.addNotificationReceivedListener((n) => {
      const c = n.request.content;
      handler({ title: c.title ?? "", body: c.body ?? "", url: urlOf(c.data) });
    });
  });
  return () => {
    stopped = true;
    sub?.remove();
  };
}
