import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { appApi } from "@/api/endpoints";

/**
 * Push: ruxsat so'rash va Expo push tokenini `POST /push/devices` ga yuborish (server `PushDevice` ni joriy sessiyaga
 * bog'laydi; chiqishda o'zi o'chadi). Har ishga tushishda chaqiriladi — token o'zgargan bo'lsa yangilanadi (upsert).
 *
 * Hech qachon tashlamaydi: Expo Go'da (Android'da SDK 53 dan push yo'q), web'da, emulyatorda yoki EAS `projectId`
 * bo'lmasa (`eas init` qilinmagan) — jimgina o'tkazib yuboriladi, sababi console'ga. `expo-notifications` faqat kerak
 * bo'lganda yuklanadi: Expo Go Android'da import'ning o'zi ham ogohlantirish beradi.
 */
export async function registerPush(): Promise<void> {
  try {
    if (Platform.OS === "web") return;
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === "android") {
      console.log("[push] Expo Go (Android) — push yo'q, dev build kerak");
      return;
    }
    const Device = await import("expo-device");
    if (!Device.isDevice) {
      console.log("[push] emulyator — push tokeni olinmaydi");
      return;
    }
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", { name: "Bildirishnomalar", importance: Notifications.AndroidImportance.DEFAULT });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") {
      console.log("[push] ruxsat berilmadi");
      return;
    }
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
    // app.json dagi "REPLACE_WITH_EAS_PROJECT_ID" — hali `eas init` qilinmagan
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) {
      console.log("[push] EAS projectId yo'q (npx eas-cli init) — token olinmadi");
      return;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await appApi.registerPush(data, Platform.OS === "ios" ? "IOS" : "ANDROID");
    console.log("[push] qurilma ro'yxatga olindi");
  } catch (e) {
    console.warn("[push] o'tkazib yuborildi:", e instanceof Error ? e.message : e);
  }
}

/** Push yo'q muhit (registerPush bilan bir xil shartlar) */
const noPush = () => Platform.OS === "web" || (Constants.executionEnvironment === ExecutionEnvironment.StoreClient && Platform.OS === "android");

/**
 * Bosilgan push xabari: server `data.url` ga saytdagi yo'lni qo'yadi (`/biznes/buyurtmalar`, …) — ilova shu bo'yicha
 * ekran ochadi. Qaytadi: obunani bekor qilish.
 */
export function onPushOpen(handler: (url: string | null) => void): () => void {
  if (noPush()) return () => undefined;
  let stopped = false;
  let sub: { remove(): void } | null = null;
  void import("expo-notifications")
    .then((Notifications) => {
      if (stopped) return;
      sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.url;
        handler(typeof url === "string" ? url : null);
      });
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    sub?.remove();
  };
}
