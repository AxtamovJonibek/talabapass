import * as Updates from "expo-updates";

/**
 * OTA (expo-updates): yangi JS to'plami fonda yuklanadi va **keyingi ochilishda** qo'llanadi — ishlayotgan ekran
 * to'satdan qayta yuklanmaydi. Ishga tushganda expo-updates o'zi tekshiradi (`checkAutomatically: ON_LOAD`,
 * kutish 0 ms); bu yerda — ilova uzoq ochiq turib, oldingi planga qaytganda ham (30 daqiqada ko'pi bilan bir marta).
 * Expo Go, dev rejim va web'da `Updates.isEnabled` false — hech narsa qilinmaydi.
 */

const MIN_INTERVAL_MS = 30 * 60_000;
let lastCheck = 0;
let running = false;

export async function fetchUpdateInBackground(): Promise<void> {
  if (!Updates.isEnabled || __DEV__ || running || Date.now() - lastCheck < MIN_INTERVAL_MS) return;
  running = true;
  lastCheck = Date.now();
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) {
      await Updates.fetchUpdateAsync();
      console.log("[updates] yangi versiya yuklandi — keyingi ochilishda qo'llanadi");
    }
  } catch (e) {
    console.warn("[updates] tekshirib bo'lmadi:", e instanceof Error ? e.message : e);
  } finally {
    running = false;
  }
}
