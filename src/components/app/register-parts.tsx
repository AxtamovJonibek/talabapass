"use client";

import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AppTitle, BackArrow, Eyebrow, RoleChip, StepBars, TopBar, TopBarSpacer } from "@/components/ui/app-kit";
import type { Link } from "@/i18n/navigation";

type Back = { href: ComponentProps<typeof Link>["href"] } | { onClick: () => void } | null;

/** Ro'yxat qadamlari sarlavhasi: ← | qadam chiziqlari | rol yorlig'i (RoyxatTalaba … BizTekshiruv). */
export function RegisterTop({ role, step, back }: { role: "student" | "business"; step: number; back: Back }) {
  const t = useTranslations("app");
  const total = role === "student" ? 3 : 4;
  return (
    <TopBar>
      {back === null ? <TopBarSpacer /> : "href" in back ? <BackArrow label={t("back")} href={back.href} /> : <BackArrow label={t("back")} onClick={back.onClick} />}
      <StepBars total={total} current={step} label={t(`register.${role}.steps`, { n: step })} />
      <RoleChip tone={role}>{t(`role.${role}`)}</RoleChip>
    </TopBar>
  );
}

/** "QADAM 1/3 · …" + sarlavha */
export function RegisterTitle({ eyebrow, size = 42, className = "mt-7", children }: { eyebrow: ReactNode; size?: 36 | 38 | 40 | 42; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <AppTitle size={size} loose={size < 40} className={size === 36 ? "mt-1.5" : "mt-2"}>
        {children}
      </AppTitle>
    </div>
  );
}
