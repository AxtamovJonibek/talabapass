import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Props = {
  /** 1 — biznes haqida, 2 — hujjatlar, 3 — tekshiruv */
  step: 1 | 2 | 3;
  /** Kirmagan foydalanuvchiga "Hisobim bor — kirish" */
  showLogin?: boolean;
  children: ReactNode;
  /** Pastdagi tugmalar qatori */
  footer: ReactNode;
};

const STEPS = [1, 2, 3] as const;
const PROMISES = [1, 2, 3] as const;

/** WB1 — biznes ro'yxatining veb qobig'i: chapda qora panel (qadamlar, va'dalar), o'ngda forma. */
export function BusinessOnboardingShell({ step, showLogin = false, children, footer }: Props) {
  const t = useTranslations("businessOnboarding");
  const brand = useTranslations("brand");

  return (
    <div className="@container flex min-h-screen flex-wrap bg-paper text-ink">
      <aside className="box-border flex min-w-0 flex-[1_1_380px] flex-col gap-7 bg-ink p-[clamp(20px,3.5cqw,44px)] text-paper">
        <Link href="/" className="text-paper no-underline">
          <Logo size={20} chip="white" tag={brand("business")} />
        </Link>
        <div>
          <h1 className="m-0 text-[clamp(34px,4cqw,54px)] leading-[0.95] font-black tracking-[-0.04em] font-stretch-112%">{t("webTitle")}</h1>
          <p className="mt-3.5 mb-0 text-16 leading-[1.5] text-fog-0">{t("webLead")}</p>
        </div>
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {STEPS.map((n) => {
            const done = n < step;
            const current = n === step;
            return (
              <li key={n} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-3.5 rounded-14 px-3.5 py-3", current && "bg-ink-2")}>
                <span
                  className={cn(
                    "flex size-[34px] shrink-0 items-center justify-center rounded-17 font-black",
                    done ? "bg-green-live text-white" : current ? "bg-orange text-ink" : "bg-ink-4 text-white",
                  )}
                >
                  {done ? "✓" : n}
                </span>
                <span className="flex flex-col">
                  <b className="text-15">{t(`steps.${n}.title`)}</b>
                  <span className="text-13 text-fog-3">{t(`steps.${n}.hint`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto flex flex-col gap-2.5 border-t border-solid border-ink-4 pt-[18px] text-14 text-fog-1">
          {PROMISES.map((n) => (
            <span key={n} className="flex gap-2.5">
              <b className="text-orange">✓</b>
              {t(`promises.${n}`)}
            </span>
          ))}
        </div>
      </aside>

      <main className="box-border min-w-0 flex-[2_1_560px] px-[clamp(16px,4cqw,56px)] py-[clamp(24px,4cqw,56px)]">
        <div className="flex max-w-[760px] flex-col gap-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-13 text-muted">{t("stepWeb", { n: step })}</span>
            {showLogin ? (
              <Link href="/kirish?rol=biznes" className="text-14 font-bold text-ink underline">
                {t("haveAccount")}
              </Link>
            ) : null}
          </div>
          {children}
          <div className="flex flex-wrap justify-between gap-3 border-t border-solid border-line-soft pt-[18px]">{footer}</div>
        </div>
      </main>
    </div>
  );
}

/** Forma sarlavhasi (WB1 har uch qadamda) */
export function BusinessHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("m-0 text-32 font-black tracking-[-0.03em] font-stretch-110%", className)}>{children}</h2>;
}
