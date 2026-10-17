import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

export type NotFoundText = {
  eyebrow: string;
  title: string;
  leadWeb: string;
  leadPhone: string;
  back: string;
  primary: string;
  secondary: string;
};

/** Havola chizuvchi: `Link` tashqaridan beriladi (global-not-found `next/link`, `[locale]` ichida i18n `Link`) */
export type RenderLink = (href: string, className: string, label: string) => ReactNode;

// [web, telefon]: dizayndagi o'lchamlar (404 desktop va 404 telefon)
const ART = {
  web: {
    left: { l: 30, t: 110, w: 330, h: 300, r: "26px 6px 6px 26px", pr: 18, fs: 260, dash: 4, tagL: 26, tagT: 24, tagFs: 13 },
    right: { l: 392, t: 130, w: 220, h: 300, r: "6px 26px 26px 6px", pl: 18, fs: 260, off: 22, offFs: 13 },
    cuts: [[352, 70, 4, 26, -20], [372, 60, 4, 22, 15], [366, 450, 4, 24, 10]],
  },
  phone: {
    left: { l: 34, t: 40, w: 190, h: 210, r: "20px 5px 5px 20px", pr: 12, fs: 170, dash: 3, tagL: 18, tagT: 16, tagFs: 11 },
    right: { l: 236, t: 54, w: 124, h: 210, r: "5px 20px 20px 5px", pl: 12, fs: 170, off: 14, offFs: 11 },
    cuts: [[222, 14, 3, 20, -20], [238, 8, 3, 16, 15], [230, 282, 3, 18, 10]],
  },
} as const;

const NUM: CSSProperties = { fontWeight: 900, fontStretch: "62%", lineHeight: 0.8, letterSpacing: "-0.03em" };

/** Yirtilgan chipta: "40" + "4" (−100%). Ikki bo'lak sekin tebranadi. */
function TornTicket({ kind }: { kind: keyof typeof ART }) {
  const { left: a, right: b, cuts } = ART[kind];
  const mono = "font-mono tracking-[0.1em]";
  return (
    <>
      <div
        className="tear-l absolute box-border flex items-center justify-end bg-blue"
        style={{ left: a.l, top: a.t, width: a.w, height: a.h, borderRadius: a.r, paddingRight: a.pr }}
      >
        <span className="text-white" style={{ ...NUM, fontSize: a.fs }}>
          40
        </span>
        <div className="absolute top-0 right-[-2px] bottom-0 border-paper" style={{ borderRight: `${a.dash}px dashed` }} />
        <div className={`absolute text-tile-xizmat ${mono}`} style={{ left: a.tagL, top: a.tagT, fontSize: a.tagFs }}>
          TP-404-??
        </div>
      </div>
      <div
        className="tear-r absolute box-border flex items-center bg-orange"
        style={{ left: b.l, top: b.t, width: b.w, height: a.h, borderRadius: b.r, paddingLeft: b.pl }}
      >
        <span className="text-ink" style={{ ...NUM, fontSize: b.fs }}>
          4
        </span>
        <div className={`absolute text-ink ${mono}`} style={{ right: b.off, bottom: b.off, fontSize: b.offFs }}>
          −100%
        </div>
      </div>
      {cuts.map(([l, t, w, h, deg]) => (
        <div key={`${l}-${t}`} className="absolute bg-ink" style={{ left: l, top: t, width: w, height: h, transform: `rotate(${deg}deg)` }} />
      ))}
    </>
  );
}

/**
 * 404: desktop va telefon dizayni alohida; qaysi biri ko'rinishi sahifa kengligiga ko'ra (container query, 700px).
 * Matn va havolalar tashqaridan beriladi — bu ekran til provayderisiz (global-not-found) ham, `[locale]` ichida ham ishlaydi.
 */
export function NotFoundScreen({ text, renderLink }: { text: NotFoundText; renderLink: RenderLink }) {
  const btn = "box-border flex h-14 items-center rounded-16 text-17 no-underline";
  return (
    <main data-testid="not-found-page" className="@container min-h-dvh bg-paper text-ink">
      {/* Desktop */}
      <div className="hidden min-h-dvh flex-col @[700px]:flex">
        <header className="box-border flex h-22 shrink-0 items-center justify-between border-hair border-x-0 border-t-0 border-ink px-16">
          <Logo size="state-web" />
          {renderLink("/", "text-17 font-bold text-ink no-underline", text.back)}
        </header>
        <div className="mx-auto flex w-full max-w-[1312px] flex-1 items-center gap-16 px-16">
          <div className="flex w-[560px] shrink-0 flex-col gap-[22px]">
            <div className="font-mono text-14 tracking-[0.12em] text-muted">{text.eyebrow}</div>
            <h1 className="m-0 text-[72px] leading-[0.95] font-black tracking-[-0.04em] font-stretch-110%">{text.title}</h1>
            <p className="m-0 text-20 leading-[1.45] text-muted">{text.leadWeb}</p>
            <div className="mt-2.5 flex gap-3">
              {renderLink("/chegirmalar", `${btn} bg-blue px-7 font-extrabold text-white`, text.primary)}
              {renderLink("/#savollar", `${btn} border-hair border-ink px-6 font-bold text-ink`, text.secondary)}
            </div>
          </div>
          <div className="relative h-[560px] flex-1">
            <TornTicket kind="web" />
          </div>
        </div>
      </div>

      {/* Telefon */}
      <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col @[700px]:hidden">
        <header className="flex h-16 items-center px-6">
          <Logo size="state-phone" />
        </header>
        <div className="relative mt-6 h-[330px] shrink-0">
          <TornTicket kind="phone" />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-6">
          <div className="font-mono text-12 tracking-[0.12em] text-muted">{text.eyebrow}</div>
          <h1 className="m-0 text-38 leading-[0.98] font-black tracking-[-0.04em] font-stretch-110%">{text.title}</h1>
          <p className="m-0 text-16 leading-[1.45] text-muted">{text.leadPhone}</p>
        </div>
        <div className="flex flex-col gap-2.5 px-6 pt-6 pb-8">
          {renderLink("/chegirmalar", `${btn} justify-center bg-blue font-extrabold text-white`, text.primary)}
          {renderLink("/#savollar", `${btn} justify-center border-hair border-ink font-bold text-ink`, text.secondary)}
        </div>
      </div>
    </main>
  );
}
