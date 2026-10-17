import { RetryButton } from "@/components/state/retry-button";
import { ButtonLink } from "@/components/ui/button";

// 5×5 QR belgisi: 1 — to'ldirilgan katak (dizayndagi tartib)
const QR = "11011 10101 01110 10101 11011".replace(/ /g, "");

type Props = { eyebrow: string; title: string; lead: string; retry: string; coupons: string };

/** Oflayn ekrani (dizayn: "Oflayn — telefon"). Keng ekranda ham shu ustun markazda turadi. */
export function OfflineScreen({ eyebrow, title, lead, retry, coupons }: Props) {
  return (
    <main data-testid="offline-page" className="mx-auto box-border flex min-h-dvh max-w-[440px] flex-col bg-paper px-6 pt-16 pb-8 text-ink">
      <div className="flex flex-1 flex-col items-center justify-center gap-7">
        <div className="relative h-[250px] w-[240px]" aria-hidden>
          <div className="absolute top-10 left-[30px] flex h-[200px] w-[180px] -rotate-4 flex-col items-center justify-center gap-3 rounded-22 bg-white">
            <div className="grid h-28 w-28 grid-cols-5 gap-1.5 opacity-30">
              {[...QR].map((c, i) => (
                <div key={i} className={c === "1" ? "rounded-3 bg-ink" : undefined} />
              ))}
            </div>
            <div className="font-mono text-12 tracking-[0.1em] text-placeholder">TP-····-····</div>
          </div>
          <div className="absolute top-0 right-1.5 box-border flex h-[76px] w-[76px] items-end justify-center gap-1.5 rounded-full bg-blue pb-[22px]">
            <div className="h-3 w-2 rounded-2 bg-white" />
            <div className="pulse-bar h-[22px] w-2 rounded-2 bg-white" />
            <div className="pulse-bar h-8 w-2 rounded-2 bg-white [animation-delay:300ms]" />
          </div>
          <div className="absolute top-[34px] right-0.5 h-[5px] w-[84px] -rotate-40 rounded-3 bg-orange" />
        </div>
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="font-mono text-12 tracking-[0.12em] text-muted">{eyebrow}</div>
          <h1 className="m-0 text-34 leading-none font-black tracking-[-0.04em] font-stretch-110%">{title}</h1>
          <p className="m-0 w-[300px] max-w-full text-16 leading-[1.45] text-muted">{lead}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <RetryButton label={retry} size="state" strong />
        <ButtonLink href="/kuponlar" variant="outline-clear" size="state" block>
          {coupons}
        </ButtonLink>
      </div>
    </main>
  );
}
