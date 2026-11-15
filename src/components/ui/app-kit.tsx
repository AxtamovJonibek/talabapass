import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import type { IconName } from "./icons";

/*
 * Ilova oqimi primitivlari (design/app-flow/*.dc.html, 390×844): faqat Capacitor ilovasidagi ekranlar.
 * Dizayn ramkasidagi yuqori 56px status bar joyini ham o'z ichiga oladi — bu yerda xavfsiz hudud (body padding)
 * hisobga olinadi: status bar ostidan kamida 12px, jami esa dizayndagidek 56px.
 */

/** Ekran: paper fon, yon padding 24, tepada/pastda xavfsiz hududga moslangan bo'shliq. */
export function AppScreen({ children, className, bleed = false }: { children: ReactNode; className?: string; bleed?: boolean }) {
  return (
    <main
      className={cn(
        "flex min-h-dvh flex-col overflow-x-hidden bg-paper pt-[max(12px,calc(56px-var(--safe-top)))] pb-[max(16px,calc(36px-var(--safe-bottom)))] text-ink",
        !bleed && "px-6",
        className,
      )}
    >
      {children}
    </main>
  );
}

const LOGO = {
  md: { word: "text-24", chip: "rounded-8 px-2.5 pt-px pb-[3px] text-20" },
  lg: { word: "text-[27px]", chip: "rounded-9 px-[11px] pt-px pb-[3px] text-22" },
} as const;

/** "talaba[Pass]" — ilova ko'rinishi (900 / 112%, karuselda kattaroq). */
export function AppLogo({ size = "md" }: { size?: keyof typeof LOGO }) {
  return (
    <div className="flex items-center gap-2 font-stretch-112%">
      <span className={cn("font-black tracking-[-0.02em]", LOGO[size].word)}>talaba</span>
      <span className={cn("bg-blue font-extrabold text-white", LOGO[size].chip)}>Pass</span>
    </div>
  );
}

/** Yuqori qator: chapda orqaga/logo, o'rtada qadam, o'ngda yorliq yoki havola. */
export function TopBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-11 items-center justify-between", className)}>{children}</div>;
}

const backFace = "-ml-2.5 flex size-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ink no-underline transition-[scale] duration-150 ease-out active:scale-[0.94]";

/** ← (44×44): havola yoki tugma. */
export function BackArrow({ label, href, onClick }: { label: string; href?: ComponentProps<typeof Link>["href"]; onClick?: () => void }) {
  const icon = <Icon name="arrowLeft" size={24} strokeWidth={2.4} />;
  return href ? (
    <Link href={href} aria-label={label} className={backFace}>
      {icon}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={backFace}>
      {icon}
    </button>
  );
}

/** Bo'sh joy egallovchi (orqaga tugmasi yo'q ekranlarda qator muvozanati uchun). */
export const TopBarSpacer = () => <span aria-hidden="true" className="size-11" />;

/** "O'tkazib yuborish" */
export function SkipLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className="tp-link flex min-h-11 items-center px-0.5 text-15 font-semibold text-muted no-underline">
      {children}
    </Link>
  );
}

const CHIP = {
  student: "bg-blue-tint text-blue",
  business: "bg-orange text-ink",
} as const;

/** Rol yorlig'i: "Talaba" (ko'k) / "Biznes" (to'q sariq). */
export function RoleChip({ tone, children }: { tone: keyof typeof CHIP; children: ReactNode }) {
  return <span className={cn("rounded-full px-3.5 pt-1.5 pb-[7px] text-14 font-extrabold", CHIP[tone])}>{children}</span>;
}

/** Qadam chiziqlari: o'tilganlari ko'k, joriysi qora, keyingilari kulrang (3 qadam — 26px, 4 — 20px). */
export function StepBars({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("h-1.5 rounded-full", total > 3 ? "w-5" : "w-[26px]", i + 1 < current ? "bg-blue" : i + 1 === current ? "bg-ink" : "bg-line")}
        />
      ))}
    </div>
  );
}

/** Karusel nuqtalari: joriysi cho'zilgan qora. */
export function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn("h-2 rounded-full transition-[width,background-color] duration-200 ease-out", i === current ? "w-[30px] bg-ink" : "w-2 bg-fog-0")}
        />
      ))}
    </div>
  );
}

const HIGHLIGHT = {
  orange: "bg-orange text-ink",
  blue: "bg-blue text-white",
  green: "bg-green-bright text-ink",
} as const;

/** Sarlavhadagi qiya "stiker" so'z: "arzonroq.", "haqida." */
export function Highlight({ tone, tight = false, children }: { tone: keyof typeof HIGHLIGHT; tight?: boolean; children: ReactNode }) {
  return <span className={cn("inline-block -rotate-[1.5deg] rounded-10", tight ? "px-2.5 pb-[3px]" : "px-3 pb-1", HIGHLIGHT[tone])}>{children}</span>;
}

const TITLE = { 36: "text-36", 38: "text-38", 40: "text-40", 42: "text-42", 44: "text-44", 46: "text-46" } as const;

/** Katta sarlavha (900, wdth 112). `loose` — 1.04 qator oralig'i (karusel, uzun sarlavhalar). */
export function AppTitle({ size, loose = false, className, children }: { size: keyof typeof TITLE; loose?: boolean; className?: string; children: ReactNode }) {
  return (
    <h1 className={cn("m-0 font-black tracking-[-0.02em] font-stretch-112%", loose ? "leading-[1.04]" : "leading-[1.02]", TITLE[size], className)}>{children}</h1>
  );
}

const LEAD = { 15: "text-15 leading-[1.45]", 16: "text-16 leading-[1.5]", 17: "text-17 leading-[1.5]" } as const;

export function AppLead({ size = 17, className, children }: { size?: keyof typeof LEAD; className?: string; children: ReactNode }) {
  return <p className={cn("m-0 text-ink-5", LEAD[size], className)}>{children}</p>;
}

/** "QADAM 1/3 · MA'LUMOTLAR" */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-13 font-bold tracking-[0.06em] text-muted-2">{children}</div>;
}

/** Qiya to'q sariq kvadrat ikonka (Kod, Parol ekranlari). */
export function IconTile({ icon }: { icon: IconName }) {
  return (
    <div className="flex size-16 -rotate-6 items-center justify-center rounded-20 bg-orange text-ink">
      <Icon name={icon} size={32} strokeWidth={2.2} />
    </div>
  );
}

const footerLink = "tp-link flex min-h-11 items-center justify-center gap-1.5 self-center border-0 bg-transparent px-3.5 font-sans text-15 font-semibold text-muted no-underline";

/** Pastdagi markaziy havola: "Biznes egasimisiz? <b>Bu yerdan</b>" (`action` siz — oddiy kulrang havola). */
export function FooterLink({ lead, action, ...props }: ComponentProps<typeof Link> & { lead: ReactNode; action?: ReactNode }) {
  return (
    <Link {...props} className={footerLink}>
      {lead}
      {action ? <span className="font-extrabold text-blue underline">{action}</span> : null}
    </Link>
  );
}

/** Xuddi shu ko'rinishdagi tugma: "Boshqa raqam bilan? <b>Almashtirish</b>" */
export function FooterButton({ lead, action, ...props }: ComponentProps<"button"> & { lead: ReactNode; action?: ReactNode }) {
  return (
    <button type="button" {...props} className={footerLink}>
      {lead}
      {action ? <span className="font-extrabold text-blue underline">{action}</span> : null}
    </button>
  );
}

/** Ko'k qalin matnli tugma/havola: "Raqamni o'zgartirish", "Parolni unutdim" */
export const textAction = "tp-link flex min-h-11 items-center border-0 bg-transparent p-0 font-sans text-15 font-bold text-blue no-underline";

/** Yorliq (14px, 700) */
export function AppLabel({ htmlFor, children, className }: { htmlFor?: string; children: ReactNode; className?: string }) {
  const look = cn("mb-2 block text-14 font-bold", className);
  return htmlFor ? (
    <label htmlFor={htmlFor} className={look}>
      {children}
    </label>
  ) : (
    <span className={look}>{children}</span>
  );
}

const BOX = {
  /** BizHujjat */
  54: "h-[54px] rounded-16 px-4",
  /** Ro'yxat maydonlari */
  58: "h-[58px] rounded-18 px-4",
  /** Parol */
  60: "h-15 rounded-18 pr-1.5 pl-[18px]",
  /** Telefon, kirish paroli */
  64: "h-16 rounded-20 pr-1.5 pl-[18px]",
} as const;

/**
 * Maydon qutisi: 2px qora chegara; fokusda ko'k (3px) va yengil halqa — dizayndagi "faol" holat.
 * Dizayndagidek content-box (balandlik chegarasiz). Qalinlashuv tashqariga (soya) — matn siljimaydi.
 */
export function FieldBox({ height = 58, invalid = false, muted = false, className, children }: { height?: keyof typeof BOX; invalid?: boolean; muted?: boolean; className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "box-content flex items-center gap-2.5 border-2 border-solid",
        BOX[height],
        muted ? "border-line bg-track" : "bg-white focus-within:border-blue focus-within:shadow-focus-blue",
        invalid ? "border-danger" : muted ? null : "border-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

const INPUT = {
  17: "text-17 font-bold",
  18: "text-18 font-extrabold",
  19: "text-19 font-extrabold",
  22: "text-22 font-extrabold",
} as const;

/** Qutidagi matn maydoni: shaffof, chegarasiz. */
export function BoxInput({ text = 19, className, ...props }: ComponentProps<"input"> & { text?: keyof typeof INPUT }) {
  return (
    <input
      className={cn("min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-ink outline-none placeholder:font-semibold placeholder:text-placeholder", INPUT[text], className)}
      {...props}
    />
  );
}

/** Telefon: bayroq + "+998" | raqam (Auth, Auth2, AuthBiznes). */
export function PhoneBox({ invalid, ...props }: Omit<ComponentProps<"input">, "type"> & { invalid?: boolean }) {
  return (
    <FieldBox height={64} invalid={invalid} className="gap-3 pr-[18px]">
      <span className="flex h-8 items-center gap-2 border-0 border-r-2 border-solid border-line-soft pr-3 text-20 font-extrabold">
        {/* eslint-disable-next-line @next/next/no-img-element -- 26×18 statik bayroq */}
        <img src="/flags/uz.svg" width={26} height={18} alt="" />
        +998
      </span>
      <BoxInput type="tel" inputMode="numeric" autoComplete="tel-national" text={22} className="tracking-[0.01em]" {...props} />
    </FieldBox>
  );
}

/** Maydon ostidagi izoh yoki xato (13px). */
export function FieldNote({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return <p className={cn("mx-0.5 mt-2.5 mb-0 text-13 leading-[1.5]", error ? "font-semibold text-danger" : "text-muted-2")}>{children}</p>;
}

/** Oq maslahat kartasi, chapda ko'k fonli belgi (Kod ekrani). */
export function TipCard({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-20 bg-white px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-10 bg-blue-tint text-blue">
        <Icon name={icon} size={18} strokeWidth={2.4} />
      </span>
      <span className="text-14 leading-[1.45] text-ink-5">{children}</span>
    </div>
  );
}

/** Yashil doiradagi tasdiq belgisi (parol talablari, "tasdiqlangan"). */
export function TickDot({ size = 20, tone = "green" }: { size?: 18 | 20 | 22 | 26 | 32; tone?: "green" | "peach" | "idle" }) {
  const box = { 18: "size-[18px]", 20: "size-5", 22: "size-[22px]", 26: "size-[26px]", 32: "size-8" }[size];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full text-ink", box, tone === "green" ? "bg-green-bright" : tone === "peach" ? "bg-peach" : "bg-track")}>
      {tone === "idle" ? null : <Icon name="tick" size={Math.round(size * 0.55)} strokeWidth={3.6} />}
    </span>
  );
}
