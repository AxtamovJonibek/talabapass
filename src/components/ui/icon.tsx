import { ICONS, iconSize, type IconName } from "./icons";

type IconProps = {
  name: IconName;
  size?: number;
  /** Eski chiziqli ikonkalardan qolgan — Phosphor "bold" vaznida e'tiborga olinmaydi (qalinlik bitta) */
  strokeWidth?: number;
  /** Faol navigatsiya ikonkasi kabi to'ldirilgan ko'rinish */
  filled?: boolean;
  className?: string;
};

/** Phosphor Icons, "bold" vazn (to'ldirilgani — "fill"); o'lcham 16/20/24 shkalasiga yaxlitlanadi (docs/ikonkalar.md). */
export function Icon({ name, size = 20, filled = false, className }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" size={iconSize(size)} weight={filled ? "fill" : "bold"} className={className} />;
}
