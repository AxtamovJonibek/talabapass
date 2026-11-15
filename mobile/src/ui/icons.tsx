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
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2.2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
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
