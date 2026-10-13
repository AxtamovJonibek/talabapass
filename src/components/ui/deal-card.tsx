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
