import type { TextStyle } from "react-native";

/**
 * Dizayn qiymatlari: design/app-flow/*.dc.html (390×844). Ranglar aynan shu fayllardagi hex'lar,
 * o'lchamlar px → dp (1:1). Yangi rang/radius qo'shishdan oldin dizaynga qarang.
 */
export const colors = {
  // ───── saytdagi tokenlar (src/app/globals.css @theme) — ilova = saytning telefon ko'rinishi ─────
  surface: "#EEECE6",
  surface2: "#E4E2DB",
  placeholder: "#8A877F",
  blue2: "#3646E4",
  infoBg: "#E6E8FB",
  greenSite: "#0F5F37",
  greenLive: "#1E9E5A",
  greenBg: "#E3F4EA",
  warn: "#9A3A0E",
  warnBg: "#FFF0E6",
  ink2: "#232321",
  ink3: "#2A2A27",
  fog0: "#CFCCC4",
  fog1: "#D8D5CD",
  fog2: "#BDBAB2",
  fog3: "#A9A69E",
  ink4: "#2F2F2C",
  /** skaner foni va kamera maydoni */
  ink0: "#0E0E0D",
  ink1: "#1B1B19",
  /** B4 yashil sarlavha: tugma foni, kod matni, belgi */
  green2: "#1B7448",
  mint2: "#3FBF7F",
  mint3: "#C9EBD7",
  /** grafik yo'lagi, "qayta kelganlar" chizig'i foni */
  bar: "#E7E5DE",
  /** qora KPI kartadagi o'sish izohi */
  mint: "#6FD39C",
  /** issiqlik shkalasi */
  heat0: "#EFEDE7",
  heat1: "#FBD5C2",
  heat2: "#FCA57D",
  heat3: "#FF6A2E",
  heat4: "#B83A0A",
  dash: "#DAD7CE",
  lineStrong: "#B9B6AD",
  // ───── ilovaning avvalgi (app-flow) qiymatlari ─────
  paper: "#F3F2EE",
  ink: "#141414",
  white: "#FFFFFF",
  blue: "#2433D6",
  orange: "#FF5B1F",
  /** havola va ikkinchi darajali matn ("O'tkazib yuborish", ko'z belgisi) */
  muted: "#5F5D57",
  /** izohlar, eyebrow, karta osti matni */
  muted2: "#6E6B64",
  /** lead paragraflar */
  ink5: "#3A3834",
  /** nofaol chegara, qadam chizig'i, uzuq doira */
  line: "#D6D3CA",
  /** telefon maydonidagi ajratgich */
  lineSoft: "#E2E0D8",
  /** karusel nofaol nuqtasi */
  dot: "#CFCBC4",
  blueTint: "#DDE1FA",
  green: "#3BD16F",
  greenOk: "#1F8A47",
  greenTint: "#DFF7E7",
  peach: "#FFE3D6",
  /** o'chiq maydon / bo'sh holat doirasi */
  track: "#E6E4DD",
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
  // Sayt bilan bir xil kengliklar (font-stretch): sarlavha 110/125, karta nomi 108, narx 75, raqamlar 65–90
  "Archivo-800-108": require("../assets/fonts/Archivo-800-108.ttf"),
  "Archivo-800-110": require("../assets/fonts/Archivo-800-110.ttf"),
  "Archivo-900-65": require("../assets/fonts/Archivo-900-65.ttf"),
  "Archivo-900-70": require("../assets/fonts/Archivo-900-70.ttf"),
  "Archivo-900-75": require("../assets/fonts/Archivo-900-75.ttf"),
  "Archivo-900-85": require("../assets/fonts/Archivo-900-85.ttf"),
  "Archivo-900-90": require("../assets/fonts/Archivo-900-90.ttf"),
  "Archivo-900-110": require("../assets/fonts/Archivo-900-110.ttf"),
  "Archivo-900-125": require("../assets/fonts/Archivo-900-125.ttf"),
} as const;

type Weight = 400 | 500 | 600 | 700 | 800 | 900;

/** `font(900, 112)` → shu nusxaning oilasi. Mavjud bo'lmagan juftlik — oddiy kenglik. */
export type Width = 62 | 65 | 70 | 75 | 85 | 90 | 100 | 108 | 110 | 112 | 125;

export function font(weight: Weight, width: Width = 100): TextStyle {
  const wide = `Archivo-${weight}-${width}`;
  const family = width !== 100 && wide in fontFiles ? wide : `Archivo-${weight}`;
  return { fontFamily: family };
}

/** CSS `letter-spacing: Nem` → dp */
export const em = (size: number, value: number) => size * value;
