import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

/*
 * Tanishtiruv karuseli rasmlari (design/app-flow: Main, Biz1, Biz2; Slide2–4 shu uslubda — dizayn fayllari yo'q).
 * Hammasi bezak: o'qish vositalaridan yashirin, matni messages/uz.json da.
 */

/** Rasm maydoni: markazda uzuq-uzuq doira (360px). */
export function ArtStage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative flex min-h-[360px] flex-1 flex-col items-center justify-center", className)}>
      <div className="absolute top-1/2 left-1/2 size-[360px] -translate-x-1/2 -translate-y-[52%] rounded-full border-2 border-dashed border-line" />
      {children}
    </div>
  );
}

/** Yashil "tasdiq" stikeri: qora doirada belgi + matn (Biz2, Slide2). */
function GreenSticker({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div className={cn("absolute flex items-center gap-2 rounded-full bg-green-bright py-2.5 pr-[18px] pl-3 text-16 font-extrabold -rotate-5 shadow-sticker-green", className)}>
      <span className="flex size-7 items-center justify-center rounded-full bg-ink text-white">
        <Icon name="tick" size={16} strokeWidth={3.2} />
      </span>
      {children}
    </div>
  );
}

/** QR belgisi (21×21 katak). */
function QrGlyph({ className }: { className?: string }) {
  return (
    <svg width="130" height="130" viewBox="0 0 21 21" shapeRendering="crispEdges" className={className}>
      <rect width="21" height="21" rx="1" className="fill-white" />
      <path
        d="M0 0h7v7H0z M1 1v5h5V1z M2 2h3v3H2z M14 0h7v7h-7z M15 1v5h5V1z M16 2h3v3h-3z M0 14h7v7H0z M1 15v5h5v-5z M2 16h3v3H2z"
        fillRule="evenodd"
        className="fill-ink"
      />
      <path
        d="M9 1h1v3H9z M11 2h2v1h-2z M8 5h2v1H8z M0 9h3v1H0z M5 9h2v2H5z M9 9h2v1H9z M13 9h2v1h-2z M17 9h3v1h-3z M2 11h2v1H2z M8 11h1v3H8z M11 11h2v1h-2z M15 11h1v2h-1z M18 11h2v1h-2z M10 14h2v1h-2z M14 14h1v2h-1z M17 14h3v1h-3z M9 16h1v2H9z M12 16h2v1h-2z M16 17h2v1h-2z M10 19h3v1h-3z M15 19h1v2h-1z M19 19h2v1h-2z"
        className="fill-ink"
      />
    </svg>
  );
}

const card = "relative w-[min(312px,100%)]";

/** 1 · Arzonroq (Main) */
export function MainArt() {
  const t = useTranslations("app.intro.art");
  return (
    <ArtStage className="gap-3.5">
      <div className={cn(card, "-rotate-4")}>
        <div className="rounded-30 bg-blue px-[22px] pt-[22px] pb-6 text-white shadow-float-blue">
          <div className="text-14 font-medium opacity-85">{t("bookstore")}</div>
          <div className="mt-1.5 mb-0.5 text-84 leading-none font-black tracking-[-0.01em] font-stretch-62%">−25%</div>
          <div className="text-19 font-bold">{t("books")}</div>
        </div>
        <div className="absolute -top-[26px] -right-[22px] rotate-9 rounded-22 bg-orange px-5 pt-1 pb-2 text-52 leading-none font-black font-stretch-62% shadow-sticker-orange">
          1+1
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        {(["all", "coffee", "book", "sport"] as const).map((chip, i) => (
          <span key={chip} className={cn("rounded-full px-[18px] py-2.5 text-14 font-bold", i === 0 ? "bg-ink text-white" : "bg-white")}>
            {t(`chips.${chip}`)}
          </span>
        ))}
      </div>
      <DealRow tile="bg-blue-tint" badge="−40%" place={t("printPlace")} title={t("printTitle")} />
    </ArtStage>
  );
}

/** Oq qator: rangli plitka ichida foiz + joy va nom (Main pastki kartasi, Slide4). */
function DealRow({ tile, badge, place, title, className }: { tile: string; badge: string; place: string; title: string; className?: string }) {
  return (
    <div className={cn("box-content flex w-[min(312px,calc(100%-28px))] items-center gap-3.5 rounded-22 bg-white p-3.5", className)}>
      <div className={cn("flex size-[52px] shrink-0 items-center justify-center rounded-14", tile)}>
        <span className="rounded-8 bg-orange px-[7px] py-0.5 text-15 font-black">{badge}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-12 font-medium text-muted-2">{place}</span>
        <span className="text-17 font-extrabold">{title}</span>
      </div>
    </div>
  );
}

/** 2 · Guvohnoma */
export function CardArt() {
  const t = useTranslations("app.intro.art");
  return (
    <ArtStage>
      <div className={cn(card, "rotate-3")}>
        <div className="rounded-30 bg-white p-[22px] shadow-float-ink-soft">
          <div className="text-12 font-bold tracking-[0.1em] text-muted-2">{t("cardTitle")}</div>
          <div className="mt-3.5 flex gap-3.5">
            <div className="flex h-24 w-[74px] shrink-0 items-center justify-center rounded-14 bg-blue-tint text-blue">
              <Icon name="user" size={34} strokeWidth={2} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
              <span className="text-19 font-extrabold">{t("cardName")}</span>
              <span className="text-14 font-medium text-muted-2">{t("cardMeta")}</span>
              <span className="mt-1.5 h-2 w-[80%] rounded-full bg-track" />
              <span className="h-2 w-[55%] rounded-full bg-track" />
            </div>
          </div>
        </div>
        <GreenSticker className="-bottom-7 -left-4">{t("approved")}</GreenSticker>
      </div>
    </ArtStage>
  );
}

/** 3 · QR kupon */
export function QrArt() {
  const t = useTranslations("app.intro.art");
  return (
    <ArtStage>
      <div className="relative w-[min(300px,100%)] -rotate-3">
        <div className="rounded-32 bg-ink p-[22px] shadow-float-ink-lg">
          <div className="flex h-[210px] items-center justify-center rounded-20 bg-ink-2">
            <QrGlyph />
          </div>
          <div className="mt-4 flex items-center justify-between text-white">
            <span className="text-18 font-extrabold">{t("couponPlace")}</span>
            <span className="text-14 font-medium opacity-80">{t("couponCode")}</span>
          </div>
        </div>
        <div className="absolute -top-6 -right-5 flex size-24 rotate-10 items-center justify-center rounded-full bg-orange">
          <span className="text-40 leading-none font-black font-stretch-62%">−25%</span>
        </div>
      </div>
    </ArtStage>
  );
}

/** 4 · Yaqin joylar */
export function NearArt() {
  const t = useTranslations("app.intro.art");
  const tiles = ["bg-tile-kofe", "bg-tile-sport", "bg-tile-bogo"] as const;
  const tilt = ["-rotate-2", "rotate-1", "-rotate-1"] as const;
  return (
    <ArtStage className="gap-3">
      {([1, 2, 3] as const).map((n, i) => (
        <DealRow key={n} tile={tiles[i]} badge={t(`near.${n}.badge`)} place={t(`near.${n}.place`)} title={t(`near.${n}.title`)} className={tilt[i]} />
      ))}
      <div className="absolute top-[calc(50%-178px)] right-0 flex size-[72px] rotate-10 items-center justify-center rounded-full bg-blue text-white">
        <Icon name="pin" size={34} strokeWidth={2.2} />
      </div>
    </ArtStage>
  );
}

const BARS = ["h-[30%]", "h-[44%]", "h-[38%]", "h-[62%]", "h-[52%]"] as const;

/** B1 · Yangi mijozlar */
export function GrowthArt() {
  const t = useTranslations("app.bizIntro.art");
  return (
    <ArtStage>
      <div className={cn(card, "-rotate-3")}>
        <div className="rounded-30 bg-ink p-[22px] text-white shadow-float-ink">
          <div className="text-14 font-medium opacity-80">{t("weekNew")}</div>
          <div className="mt-1 flex items-end gap-3">
            <span className="text-76 leading-none font-black font-stretch-62%">{t("weekCount")}</span>
            <span className="mb-2.5 rounded-8 bg-green-bright px-[9px] py-0.5 text-14 font-extrabold text-ink">{t("weekGrowth")}</span>
          </div>
          <div className="mt-3.5 flex h-[84px] items-end gap-2">
            {BARS.map((h, i) => (
              <span key={i} className={cn("flex-1 rounded-6 bg-ink-5", h)} />
            ))}
            <span className="h-[78%] flex-1 rounded-6 bg-blue" />
            <span className="h-full flex-1 rounded-6 bg-orange" />
          </div>
        </div>
        <div className="absolute -right-4 -bottom-[34px] flex rotate-5 items-center gap-2.5 rounded-20 border-2 border-solid border-ink bg-white py-2.5 pr-4 pl-3 shadow-sticker-ink">
          <span className="flex size-[34px] items-center justify-center rounded-10 bg-blue-tint text-13 font-black text-blue">{t("slotBadge")}</span>
          <span className="text-14 leading-[1.2] font-extrabold">
            {t("slotTime")}
            <br />
            <span className="font-medium text-muted-2">{t("slotNote")}</span>
          </span>
        </div>
      </div>
    </ArtStage>
  );
}

const corner = "absolute size-[34px] border-orange";

/** B2 · Skaner va statistika */
export function ScannerArt() {
  const t = useTranslations("app.bizIntro.art");
  return (
    <ArtStage>
      <div className="relative w-[min(300px,100%)] rotate-3">
        <div className="rounded-32 bg-ink p-[22px] shadow-float-ink-lg">
          <div className="relative flex h-[210px] items-center justify-center rounded-20 bg-ink-2">
            <QrGlyph className="opacity-90" />
            <span className={cn(corner, "top-3.5 left-3.5 rounded-tl-10 border-t-4 border-l-4")} />
            <span className={cn(corner, "top-3.5 right-3.5 rounded-tr-10 border-t-4 border-r-4")} />
            <span className={cn(corner, "bottom-3.5 left-3.5 rounded-bl-10 border-b-4 border-l-4")} />
            <span className={cn(corner, "right-3.5 bottom-3.5 rounded-br-10 border-r-4 border-b-4")} />
            <span className="absolute inset-x-5 top-1/2 h-[3px] rounded-full bg-orange shadow-glow-orange" />
          </div>
          <div className="mt-4 flex items-center justify-between text-white">
            <span className="text-14 font-medium opacity-80">{t("today")}</span>
            <span className="text-18 font-extrabold">{t("todayTotal")}</span>
          </div>
        </div>
        <GreenSticker className="-bottom-7 -left-[22px]">{t("applied")}</GreenSticker>
      </div>
    </ArtStage>
  );
}
