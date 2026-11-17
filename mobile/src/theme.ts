import type { TextStyle } from "react-native";

/**
 * Dizayn qiymatlari: design/app-flow/*.dc.html (390×844). Ranglar aynan shu fayllardagi hex'lar,
 * o'lchamlar px → dp (1:1). Yangi rang/radius qo'shishdan oldin dizaynga qarang.
 */
export const colors = {
  paper: "#F3F1EE",
  ink: "#111111",
  white: "#FFFFFF",
  blue: "#2432D6",
  orange: "#FF5A1F",
  /** havola va ikkinchi darajali matn ("O'tkazib yuborish", ko'z belgisi) */
  muted: "#55524D",
  /** izohlar, eyebrow, karta osti matni */
  muted2: "#6B6760",
  /** lead paragraflar */
  ink5: "#3A3834",
  /** nofaol chegara, qadam chizig'i, uzuq doira */
  line: "#D6D2CB",
  /** telefon maydonidagi ajratgich */
  lineSoft: "#E3DFD8",
  /** karusel nofaol nuqtasi */
  dot: "#CFCBC4",
  blueTint: "#DDE1FA",
  green: "#3BD16F",
  greenOk: "#1F8A47",
  greenTint: "#DFF7E7",
  peach: "#FFE3D6",
  /** o'chiq maydon / bo'sh holat doirasi */
  track: "#E9E6E0",
  /** kamera ramkasi */
  frame: "#26241F",
  /** Xato (dizaynda chizilmagan holat — sayt tokeni danger) */
  danger: "#B4230C",
  dangerBg: "#FBE3DC",
  /** Ilova kartochkalaridagi plitkalar (sayt kategoriya juftlari: kofe, sport, 1+1) */
  tileKofe: "#E8DDCC",
  tileSport: "#D7EEDF",
  tileBogo: "#F3E6C4",
  /** Lenta/Chegirma (Lenta.dc.html, Chegirma.dc.html): kam qoldiq va "tez orada ochiladi" matni */
  rust: "#B23A0C",
  /** Yopiq holat nuqtasi */
  idle: "#8A877F",
  /** Chegirma sahifasidagi xarita tugmasi foni */
  mapTile: "#E9F0E4",
} as const;

/**
 * Archivo statik nusxalari (`assets/fonts`, variable shriftdan fontTools bilan): React Native `font-variation-settings`
 * ni bilmaydi, shuning uchun dizayndagi har bir og'irlik/kenglik juftligi — alohida oila.
 * 100 — oddiy, 112 — sarlavha va logo, 62 — katta siqiq raqamlar (−25%, 1+1).
 */
export const fontFiles = {
  "Archivo-400": require("../assets/fonts/Archivo-400-100.ttf"),
  "Archivo-500": require("../assets/fonts/Archivo-500-100.ttf"),
  "Archivo-600": require("../assets/fonts/Archivo-600-100.ttf"),
  "Archivo-700": require("../assets/fonts/Archivo-700-100.ttf"),
  "Archivo-800": require("../assets/fonts/Archivo-800-100.ttf"),
  "Archivo-900": require("../assets/fonts/Archivo-900-100.ttf"),
  "Archivo-800-112": require("../assets/fonts/Archivo-800-112.ttf"),
  "Archivo-900-112": require("../assets/fonts/Archivo-900-112.ttf"),
  "Archivo-900-62": require("../assets/fonts/Archivo-900-62.ttf"),
} as const;

type Weight = 400 | 500 | 600 | 700 | 800 | 900;

/** `font(900, 112)` → shu nusxaning oilasi. Mavjud bo'lmagan juftlik — oddiy kenglik. */
export function font(weight: Weight, width: 100 | 112 | 62 = 100): TextStyle {
  const wide = `Archivo-${weight}-${width}`;
  const family = width !== 100 && wide in fontFiles ? wide : `Archivo-${weight}`;
  return { fontFamily: family };
}

/** CSS `letter-spacing: Nem` → dp */
export const em = (size: number, value: number) => size * value;
