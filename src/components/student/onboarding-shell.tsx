import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Props = {
  /** Joriy qadam: 1 — ma'lumotlar, 2 — guvohnoma, 3 — tekshiruv */
  step: 1 | 2 | 3;
  /** Kirmagan foydalanuvchiga "Hisobing bormi? Kirish" ko'rsatiladi */
  showLogin?: boolean;
  children: ReactNode;
  /** Karta pastidagi tugmalar qatori */
  footer: ReactNode;
};

const STEPS = [1, 2, 3] as const;

/**
 * WT1 — talaba ro'yxatining veb qobig'i: sarlavha, chapda uch qadam, o'ngda oq karta.
 * Ota element `@container` bo'lishi kerak (cqw o'lchamlari uchun).
 */
export function OnboardingShell({ step, showLogin = false, children, footer }: Props) {
  const t = useTranslations("onboarding.web");

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="border-b-[1.5px] border-solid border-ink">
        <div className="mx-auto box-content flex h-[72px] max-w-[1280px] items-center gap-3 px-[clamp(16px,4cqw,48px)]">
          <Link href="/" className="text-ink no-underline">
            <Logo size={20} />
          </Link>
          {showLogin ? (
            <>
              <span className="ml-auto max-w-[clamp(0px,calc((100cqw-560px)*999),400px)] overflow-hidden text-14 whitespace-nowrap text-muted">
                {t("haveAccount")}
              </span>
              <Link href="/kirish" className="box-content flex h-11 items-center rounded-12 border-hair border-ink px-4 text-15 font-bold text-ink no-underline">
                {t("login")}
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <div className="mx-auto box-border flex w-full max-w-[1280px] flex-1 flex-wrap items-start gap-[clamp(24px,5cqw,64px)] px-[clamp(16px,4cqw,48px)] py-[clamp(28px,5cqw,64px)]">
        <aside className="min-w-0 flex-[1_1_300px]">
          <div className="text-13 font-extrabold tracking-[0.1em] text-blue">{t("eyebrow")}</div>
          <h1 className="mt-2.5 mb-0 text-[clamp(36px,4.4cqw,60px)] leading-[0.95] font-black tracking-[-0.04em] font-stretch-112%">
            {t("title")}
          </h1>
          <ol className="mt-[30px] mb-0 flex list-none flex-col gap-2 p-0">
            {STEPS.map((n) => {
              const done = n < step;
              const current = n === step;
              return (
                <li
                  key={n}
                  aria-current={current ? "step" : undefined}
                  className={cn("flex items-center gap-3.5 rounded-16 border-hair px-4 py-3.5", current ? "border-ink bg-white" : "border-line")}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-15 font-black",
                      done ? "bg-green text-white" : current ? "bg-blue text-white" : "bg-track text-muted",
                    )}
                  >
                    {done ? "✓" : n}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <b className="text-16">{t(`steps.${n}.title`)}</b>
                    <span className="text-13 text-muted">{t(`steps.${n}.hint`)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-[22px] flex items-start gap-2.5 text-14 leading-[1.5] text-muted">
            <Icon name="shieldCheck" size={20} className="shrink-0 text-green" />
            <span>{t("privacy")}</span>
          </div>
        </aside>

        <main className="box-content min-w-0 flex-[2_1_560px] rounded-24 border-hair border-ink bg-white p-[clamp(20px,3.5cqw,40px)]">
          {children}
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-solid border-surface pt-5">{footer}</div>
        </main>
      </div>
    </div>
  );
}

/** Karta sarlavhasi (har uch qadamda bir xil) */
export function OnboardingHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("m-0 text-28 font-black tracking-[-0.02em] font-stretch-110%", className)}>{children}</h2>;
}
