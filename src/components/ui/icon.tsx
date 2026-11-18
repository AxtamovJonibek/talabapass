import { ICONS, type IconName } from "./icons";

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Faol navigatsiya ikonkasi kabi to'ldirilgan ko'rinish */
  filled?: boolean;
  className?: string;
};

export function Icon({ name, size = 18, strokeWidth = 2, filled = false, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
