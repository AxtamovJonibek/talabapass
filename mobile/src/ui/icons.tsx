import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/theme";

/** Chiziqli ikonkalar — design/app-flow va saytdagi `icons.ts` bilan bir xil yo'llar (24×24). */
const PATHS = {
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  sms: "M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5",
  lock: "M7.5 10.5h9a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3zM8 10.5V8a4 4 0 0 1 8 0v2.5",
  shieldCheck: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5L15.5 10",
  homeIn: "M7 11.5l5-4.5 5 4.5M6.5 10v9h11v-9",
  search: "M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13zM16 16l4 4",
  chevronDown: "M6 9l6 6 6-6",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21zM14.5 9.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z",
  clock: "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM12 7.5V12l3 2",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  bolt: "M13 3L5 13h6l-1 8 8-10h-6z",
  plus: "M12 5v14M5 12h14",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z",
  eyeOff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  refresh: "M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6",
  idCard: "M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM11 11a2 2 0 1 1-4 0a2 2 0 1 1 4 0zM14 10h4M14 14h4M6 16c.6-1.4 1.8-2 3-2s2.4.6 3 2",
  x: "M6 6l12 12M18 6L6 18",
  // talaba ilovasi (saytdagi src/components/ui/icons.ts bilan bir xil)
  ticket: "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8.5h.01",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  navigate: "M3 11l19-8-8 19-2-9z",
  locate: "M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM12 2v4M12 18v4M2 12h4M18 12h4",
  chevronRight: "M9 6l6 6-6 6",
  logout: "M14 4h5v16h-5M10 8l-4 4 4 4M6 12h11",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  send: "M21 3L3 10.5l7 2.5 2.5 7zM21 3L10 13",
  camera: "M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0z",
  info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 8v5M12 16h.01",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4",
  sliders: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4",
  checkCircle: "M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM7.5 12.5l3 3 6-7",
  // kategoriya ikonkalari (Category.icon)
  all: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  bowl: "M3 11h18a9 9 0 0 1-18 0zM8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4M5 20h14",
  cup: "M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8zM16 10h2a2 2 0 0 1 0 4h-2M8 2.5v3M12 2.5v3",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 21a2 2 0 0 1 2-2h13M9 7h6",
  print: "M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6zM9 17h6",
  gym: "M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12",
  cut: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4",
  film: "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10",
  wrap: "M5 6l14 3-2 11-14-3zM8 10l7 1.5M7.4 13.5l7 1.5",
  store: "M3 9l1.5-5h15L21 9M3 9h18v11H3zM3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0",
  student: "M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5",
  // biznes ilovasi (saytdagi biznes menyusi uslubida)
  chart: "M4 20V11M10 20V5M16 20v-6M2 20h20",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  users: "M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM2 21c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5M16 3.5a4 4 0 0 1 0 7.5M18.5 15.5c1.8.7 3 2.4 3.5 5.5",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  torch: "M8 2h8v5l-2 3v12h-4V10L8 7zM12 13v3",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
} as const;

export const isIconName = (name: string): name is IconName => name in PATHS;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 2.2,
  fill = "none",
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Bo'yalgan ko'rinish (saqlangan ♡/bookmark) */
  fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={PATHS[name]} />
    </Svg>
  );
}

/** O'zbekiston bayrog'i 26×18 (telefon maydoni). */
export function UzFlag() {
  return (
    <Svg width={26} height={18} viewBox="0 0 26 18">
      <Rect width={26} height={6} fill="#1EB4E6" />
      <Rect y={6} width={26} height={6} fill="#fff" />
      <Rect y={12} width={26} height={6} fill="#1EB53A" />
      <Rect y={5.5} width={26} height={1} fill="#CE1126" />
      <Rect y={11.5} width={26} height={1} fill="#CE1126" />
    </Svg>
  );
}

/** QR belgisi 21×21 katak (Biz2 / Slide3 bezagi). */
export function QrGlyph({ size = 130, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21" opacity={opacity}>
      <Rect width={21} height={21} fill="#fff" rx={1} />
      <Path
        d="M0 0h7v7H0z M1 1v5h5V1z M2 2h3v3H2z M14 0h7v7h-7z M15 1v5h5V1z M16 2h3v3h-3z M0 14h7v7H0z M1 15v5h5v-5z M2 16h3v3H2z"
        fill={colors.ink}
        fillRule="evenodd"
      />
      <Path
        d="M9 1h1v3H9z M11 2h2v1h-2z M8 5h2v1H8z M0 9h3v1H0z M5 9h2v2H5z M9 9h2v1H9z M13 9h2v1h-2z M17 9h3v1h-3z M2 11h2v1H2z M8 11h1v3H8z M11 11h2v1h-2z M15 11h1v2h-1z M18 11h2v1h-2z M10 14h2v1h-2z M14 14h1v2h-1z M17 14h3v1h-3z M9 16h1v2H9z M12 16h2v1h-2z M16 17h2v1h-2z M10 19h3v1h-3z M15 19h1v2h-1z M19 19h2v1h-2z"
        fill={colors.ink}
      />
    </Svg>
  );
}
