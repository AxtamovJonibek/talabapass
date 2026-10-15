import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "@/i18n/navigation";
import { DealBadge, LiveDot } from "./badge";
import { Icon } from "./icon";
import type { IconName } from "./icons";

export type DealCardProps = {
  href: string;
  badge: string;
  store: ReactNode;
  distance?: ReactNode;
  title: ReactNode;
  /** Narxli chegirma: yangi narx + (ixtiyoriy) eski narx */
  price?: { now: string; old?: string; currency: string };
  /** Narxsiz chegirma matni: "Ikkinchi lavash bepul" */
  note?: ReactNode;
  live: boolean;
  status: ReactNode;
  when: ReactNode;
  left: number;
  total: number;
  icon: IconName;
  /** Kategoriya ranglari DB'dan keladi (Category.tileColor / inkColor) */
  tileColor: string;
  inkColor: string;
};

/** Chegirma kartasi — "chipta" ko'rinishi (T4 lentasi). Ota fon: paper. */
export function DealCard(props: DealCardProps) {
  const pct = props.total > 0 ? Math.round((props.left / props.total) * 100) : 0;
  return (
    <Link href={props.href} className="relative block rounded-16 bg-white text-ink no-underline">
      <div className="flex gap-3 p-3">
        <div
          className="relative flex size-[92px] shrink-0 items-center justify-center rounded-12"
          style={{ background: props.tileColor, color: props.inkColor }}
        >
          <Icon name={props.icon} size={46} strokeWidth={1.3} />
          <DealBadge className="absolute -top-[7px] -left-[5px]">{props.badge}</DealBadge>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <div className="flex justify-between gap-2 text-12 text-muted">
            <span className="truncate">{props.store}</span>
            {props.distance ? <span className="shrink-0 font-mono">{props.distance}</span> : null}
          </div>
          <div className="text-16 leading-[1.2] font-bold">{props.title}</div>
          {props.price ? (
            <div className="mt-auto flex items-baseline gap-2">
              <span className="text-19 font-extrabold tracking-[-0.01em]">
                {props.price.now}
                <span className="text-12 font-semibold"> {props.price.currency}</span>
              </span>
              {props.price.old ? <s className="font-mono text-12 text-muted-2">{props.price.old}</s> : null}
            </div>
          ) : (
            <div className="mt-auto text-14 font-bold text-blue">{props.note}</div>
          )}
        </div>
      </div>
      <div className="border-t-hair-dashed mx-3.5" />
      <div className="absolute top-[108px] -left-2 size-4 rounded-8 bg-paper" />
      <div className="absolute top-[108px] -right-2 size-4 rounded-8 bg-paper" />
      <div className="flex items-center justify-between gap-2.5 px-3.5 pt-2.5 pb-3">
        <div className="flex min-w-0 items-center gap-1.5 text-12">
          <LiveDot live={props.live} />
          <span className={cn("font-bold whitespace-nowrap", props.live ? "text-green-text" : "text-muted")}>
            {props.status}
          </span>
          <span className="truncate text-muted">{props.when}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="h-1 w-11 overflow-hidden rounded-2 bg-bar">
            <div className="h-1 bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-11 text-muted">
            {props.left}/{props.total}
          </span>
        </div>
      </div>
    </Link>
  );
}

type DealTileProps = Omit<DealCardProps, "price" | "note" | "when"> & {
  /** "26 600 so'm" yoki narxsiz matn ("Ikkinchisi bepul") */
  price: ReactNode;
  old?: string | null;
};

/** WT2 panjarasidagi chegirma kartasi: tepada katta rasm, pastda "chipta" qatori. Ota fon: paper. */
export function DealTile(props: DealTileProps) {
  const pct = props.total > 0 ? Math.round((props.left / props.total) * 100) : 0;
  return (
    <Link href={props.href} className="relative flex flex-col rounded-18 bg-white text-ink no-underline">
      <div
        className="relative mx-2.5 mt-2.5 flex h-[150px] items-center justify-center rounded-12"
        style={{ background: props.tileColor, color: props.inkColor }}
      >
        <Icon name={props.icon} size={70} strokeWidth={1.1} />
        <DealBadge size="lg" className="absolute -top-1.5 -left-1">
          {props.badge}
        </DealBadge>
      </div>
      <div className="flex flex-1 flex-col gap-[3px] px-4 pt-3 pb-3.5">
        <span className="flex justify-between gap-2 text-13 text-muted">
          <span>{props.store}</span>
          {props.distance ? <span className="font-mono">{props.distance}</span> : null}
        </span>
        <b className="text-17 leading-[1.25]">{props.title}</b>
        <span className="mt-auto pt-1.5 text-18 font-extrabold">
          {props.price}
          {props.old ? (
            <>
              {" "}
              <s className="font-mono text-13 font-normal text-muted-2">{props.old}</s>
            </>
          ) : null}
        </span>
      </div>
      <div className="border-t-hair-dashed mx-3.5" />
      <div className="flex items-center justify-between gap-2 px-4 pt-2.5 pb-3.5 text-13">
        <span className={cn("flex items-center gap-1.5 font-bold", props.live ? "text-green-text" : "text-muted")}>
          <LiveDot live={props.live} />
          {props.status}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-11 overflow-hidden rounded-2 bg-bar">
            <span className="block h-1 bg-ink" style={{ width: `${pct}%` }} />
          </span>
          <span className="font-mono text-11 text-muted">
            {props.left}/{props.total}
          </span>
        </span>
      </div>
    </Link>
  );
}

const HOT_TONES = {
  blue: { card: "bg-blue text-white", store: "opacity-85", big: "", foot: "", icon: "text-white opacity-[0.18]" },
  orange: { card: "bg-orange text-ink", store: "font-semibold", big: "", foot: "", icon: "text-ink opacity-[0.16]" },
  ink: { card: "bg-ink text-paper", store: "text-fog-2", big: "text-orange", foot: "text-fog-2", icon: "" },
} as const;

const HOT_SIZES = {
  /** T4: gorizontal qator, 246×150 */
  phone: {
    card: "h-[150px] flex-[0_0_246px] rounded-18 px-4 py-3.5",
    store: "text-12 font-semibold",
    big: "mt-1.5 text-64 leading-[0.9] tracking-[-0.02em]",
    title: "mt-1 text-15 font-bold",
    foot: "text-12",
    dot: "size-[7px] rounded-4",
    icon: { size: 120, className: "absolute top-[18px] -right-[18px]" },
  },
  /** WT2: panjara, kamida 170px */
  web: {
    card: "min-h-[170px] rounded-22 px-[22px] py-5",
    store: "text-13",
    big: "mt-2 text-76 leading-[0.88]",
    title: "mt-1.5 text-17 font-bold",
    foot: "pt-2.5 text-13",
    dot: "size-2 rounded-4",
    icon: { size: 150, className: "absolute top-3.5 -right-5" },
  },
} as const;

type HotDealCardProps = {
  href: string;
  tone: keyof typeof HOT_TONES;
  size: keyof typeof HOT_SIZES;
  /** "Bodom Choyxonasi · 0.6 km" */
  store: ReactNode;
  big: ReactNode;
  title: ReactNode;
  foot: ReactNode;
  /** Pastki qatordagi to'q sariq nuqta (vaqt tugayapti) */
  dot?: boolean;
  /** Qora kartada ikonka yo'q (dizayndagidek) */
  icon: IconName;
};

/** "Tez tugaydi" kartasi (T4 qatori, WT2 tepasidagi uchta karta). */
export function HotDealCard({ href, tone, size, store, big, title, foot, dot = false, icon }: HotDealCardProps) {
  const s = HOT_SIZES[size];
  const c = HOT_TONES[tone];
  return (
    <Link href={href} className={cn("relative box-border flex flex-col overflow-hidden no-underline", s.card, c.card)}>
      <span className={cn(s.store, c.store)}>{store}</span>
      <span className={cn("font-black font-stretch-62%", s.big, c.big)}>{big}</span>
      <b className={s.title}>{title}</b>
      <span className={cn("mt-auto flex items-center gap-1.5 font-mono", s.foot, c.foot)}>
        {dot ? <span className={cn("shrink-0 bg-orange", s.dot)} /> : null}
        {foot}
      </span>
      {tone !== "ink" ? <Icon name={icon} size={s.icon.size} strokeWidth={1} className={cn(s.icon.className, c.icon)} /> : null}
    </Link>
  );
}
