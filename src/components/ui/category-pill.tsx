import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { isIconName } from "./icons";

type CategoryPillProps = Omit<ComponentProps<"button">, "children"> & {
  selected?: boolean;
  label: string;
  /** Kategoriya ikonkasi (DB'dagi Category.icon) */
  icon: string;
  /** Doiracha rangi (tanlanmaganda): Category.tileColor / inkColor */
  tileColor: string;
  inkColor: string;
};

/** Kategoriya chipi — "Lenta B · Jurnal": chapda rangli doira ichida ikonka, 42px. */
export function CategoryPill({ selected = false, label, icon, tileColor, inkColor, className, type = "button", ...props }: CategoryPillProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "box-border flex h-[42px] shrink-0 items-center gap-2 rounded-21 border-hair py-0 pr-3.5 pl-1.5 font-sans text-14 font-bold whitespace-nowrap transition-[translate,scale,box-shadow,background-color,color] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-chip-hover active:scale-[0.96]",
        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
        className,
      )}
      {...props}
    >
      <span
        className={cn("flex size-[30px] items-center justify-center rounded-15 transition-[background-color,color] duration-200 ease-out", selected && "bg-orange text-ink")}
        style={selected ? undefined : { background: tileColor, color: inkColor }}
      >
        <Icon name={isIconName(icon) ? icon : "all"} size={17} strokeWidth={1.9} />
      </span>
      {label}
    </button>
  );
}
