import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Bag,
  Barbell,
  Bell,
  BookmarkSimple,
  BookOpen,
  BowlFood,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChatText,
  Check,
  CheckCircle,
  Clock,
  Coffee,
  Copy,
  Crosshair,
  DeviceMobile,
  DownloadSimple,
  Eye,
  EyeSlash,
  File,
  FileText,
  FilmSlate,
  Flashlight,
  Gear,
  GlobeSimple,
  GridFour,
  Hamburger,
  House,
  HouseLine,
  IdentificationCard,
  Image,
  Info,
  Keyboard,
  Lightning,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  Minus,
  NavigationArrow,
  PaperPlaneTilt,
  PencilSimple,
  Phone,
  Plus,
  Printer,
  Prohibit,
  QrCode,
  Receipt,
  Scan,
  Scissors,
  ShareNetwork,
  Shield,
  SealCheck,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  SquaresFour,
  Storefront,
  Student,
  Sun,
  Tag,
  Ticket,
  Timer,
  Trash,
  UploadSimple,
  User,
  Users,
  X,
  XLogo,
  YoutubeLogo,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors } from "@/theme";

/**
 * Ikonkalar — Phosphor Icons (bold): saytdagi `src/components/ui/icons.ts` bilan AYNAN bir xil nomlar va xarita
 * (birini o'zgartirsangiz ikkinchisini ham — docs/ikonkalar.md). O'lcham shkalasi 16/20/24 (`iconSize`).
 * Brend belgilari — rasmiy fayllar (`assets/brands`, `ui/brands.ts`), Google "G" — pastda (rasmiy ranglar).
 */
const ICONS = {
  // kategoriya / chegirma
  all: SquaresFour,
  bowl: BowlFood,
  cup: Coffee,
  book: BookOpen,
  print: Printer,
  gym: Barbell,
  cut: Scissors,
  film: FilmSlate,
  wrap: Hamburger,
  // navigatsiya
  home: House,
  house: HouseLine,
  ticket: Ticket,
  clock: Clock,
  time: Timer,
  user: User,
  users: Users,
  scan: Scan,
  chart: ChartBar,
  receipt: Receipt,
  store: Storefront,
  student: Student,
  bell: Bell,
  gear: Gear,
  grid: GridFour,
  menu: List,
  // harakat
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  chevronRight: CaretRight,
  chevronLeft: CaretLeft,
  chevronDown: CaretDown,
  close: X,
  plus: Plus,
  minus: Minus,
  check: Check,
  tick: Check,
  checkCircle: CheckCircle,
  edit: PencilSimple,
  copy: Copy,
  share: ShareNetwork,
  search: MagnifyingGlass,
  refresh: ArrowClockwise,
  upload: UploadSimple,
  download: DownloadSimple,
  logout: SignOut,
  trash: Trash,
  send: PaperPlaneTilt,
  sliders: SlidersHorizontal,
  // joy
  pin: MapPin,
  map: MapTrifold,
  locate: Crosshair,
  navigate: NavigationArrow,
  globe: GlobeSimple,
  // holat va ma'lumot
  bolt: Lightning,
  info: Info,
  ban: Prohibit,
  lock: Lock,
  shield: Shield,
  shieldCheck: ShieldCheck,
  eye: Eye,
  eyeOff: EyeSlash,
  sun: Sun,
  torch: Flashlight,
  tag: Tag,
  bag: Bag,
  bookmark: BookmarkSimple,
  verified: SealCheck,
  // hujjat va qurilma
  idCard: IdentificationCard,
  file: File,
  doc: FileText,
  image: Image,
  camera: Camera,
  qr: QrCode,
  keyboard: Keyboard,
  message: ChatText,
  phone: Phone,
  mobile: DeviceMobile,
  // ijtimoiy tarmoqlar (rasmiy fayli yo'qlari; Telegram va Instagram — public/brands)
  youtube: YoutubeLogo,
  xBrand: XLogo,
} as const satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof ICONS;
export const isIconName = (name: string): name is IconName => name in ICONS;

const ICON_SCALE = [16, 20, 24] as const;
/** Saytdagi `iconSize` bilan bir xil: 32 dan kichigi 16/20/24 ga yaxlitlanadi, kattasi — bezak */
export function iconSize(size: number): number {
  if (size >= 32) return size;
  return ICON_SCALE.reduce<number>((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), ICON_SCALE[0]);
}

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  fill = "none",
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Eski chiziqli ikonkalardan — Phosphor "bold" da e'tiborga olinmaydi */
  strokeWidth?: number;
  /** Bo'yalgan ko'rinish (saqlangan bookmark) — "none" dan boshqa qiymat "fill" vaznini yoqadi */
  fill?: string;
}) {
  const Glyph = ICONS[name];
  return <Glyph size={iconSize(size)} color={fill !== "none" ? fill : color} weight={fill !== "none" ? "fill" : "bold"} />;
}

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

/**
 * Google "G" belgisi — rasmiy ko'rinish (Google Sign-In branding qoidasi: rang va shakl o'zgartirilmaydi, oq fonda).
 * Ranglar dizayn tokenlari emas, Google brendi.
 */
export function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}
