import { Capacitor } from "@capacitor/core";

/**
 * Sayt Capacitor ilovasi (Android/iOS qobig'i) ichida ochilganmi. Faqat klientda ma'noli — serverda doim false.
 * Ilovada: service worker yo'q (kesh va push qobiqda emas), "ilovani o'rnat" takliflari ko'rsatilmaydi.
 */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}
