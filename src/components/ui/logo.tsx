import { cn } from "@/lib/cn";

// Dizayndagi o'lchamlar: [so'z, "Pass" chipi]. 14 — T8 karta, 17 — sidebar/B1, 18 — T1, 20 — W1 header, 22 — W1 footer.
const SIZES = {
  14: { root: "gap-[5px] text-14", chip: "rounded-4 px-[6px] pt-px pb-[2px] text-12" },
  17: { root: "gap-1.5 text-17 tracking-[-0.02em]", chip: "rounded-5 px-[7px] pt-0.5 pb-[3px] text-14" },
  18: { root: "gap-1.5 text-18 tracking-[-0.02em]", chip: "rounded-5 px-[7px] pt-0.5 pb-[3px] text-15" },
  20: { root: "gap-1.5 text-20 tracking-[-0.02em]", chip: "rounded-6 px-2 pt-0.5 pb-[3px] text-17" },
  22: { root: "gap-1.5 text-22", chip: "rounded-6 px-2 pt-0.5 pb-[3px] text-18" },
} as const;

const CHIPS = {
  blue: "bg-blue text-white",
  ink: "bg-ink text-white",
  white: "bg-white text-ink",
  "white-blue": "bg-white text-blue",
} as const;

const TAGS = {
  orange: "bg-orange text-ink",
  paper: "bg-paper text-ink",
} as const;

// "BIZNES" yorlig'i: sm — sidebar/WB1 (11px), md — B1 telefon sarlavhasi (12px, kengroq)
const TAG_SIZES = {
  sm: "px-1.5 text-11",
  md: "px-[7px] text-12 tracking-[0.04em]",
} as const;

type LogoProps = {
  size?: keyof typeof SIZES;
  chip?: keyof typeof CHIPS;
  /** "BIZNES" / "ADMIN" yorlig'i */
  tag?: string;
  tagTone?: keyof typeof TAGS;
  tagSize?: keyof typeof TAG_SIZES;
  className?: string;
};

/** "talaba[Pass]" belgisi. So'z rangi ota elementdan olinadi. */
export function Logo({ size = 18, chip = "blue", tag, tagTone = "orange", tagSize = "sm", className }: LogoProps) {
  return (
    <div className={cn("flex items-center font-extrabold font-stretch-125%", SIZES[size].root, className)}>
      talaba
      <span className={cn(SIZES[size].chip, CHIPS[chip])}>Pass</span>
      {tag ? (
        <span className={cn("rounded-5 py-[3px] font-bold font-stretch-100%", TAG_SIZES[tagSize], TAGS[tagTone])}>
          {tag}
        </span>
      ) : null}
    </div>
  );
}
