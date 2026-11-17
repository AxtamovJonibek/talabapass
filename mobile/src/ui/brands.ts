import type { ImageSourcePropType } from "react-native";

/**
 * Xizmatlarning rasmiy belgilari — asl fayllar, o'zgartirilmagan (manbalari `assets/brands/SOURCE.md`). Kichik o'lchamda
 * ko'rsatiladi: Android'da `resizeMethod="resize"` bilan (Instagram glifi 5000px — xotiraga to'liq o'qilmasin).
 */
export const BRAND_LOGOS = {
  yandexMaps: require("../../assets/brands/yandex-maps.png"),
  googleMaps: require("../../assets/brands/google-maps.png"),
  yandexGo: require("../../assets/brands/yandex-go.png"),
  telegram: require("../../assets/brands/telegram.png"),
  instagram: require("../../assets/brands/instagram.png"),
  /** Android'dagi "Apple bilan davom etish" tugmasi uchun Apple bergan logo-tugma (qora fon, oq belgi) */
  appleButton: require("../../assets/brands/apple-logo-button.png"),
} satisfies Record<string, ImageSourcePropType>;
