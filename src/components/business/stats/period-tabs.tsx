"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/segmented";
import { usePathname, useRouter } from "@/i18n/navigation";
import { PERIODS, type Period } from "@/lib/stats";

/** B6 davr tanlovi (Bugun / 7 kun / 30 kun). Davr URL'da (`?davr=`) — sahifani yangilash va ulashish saqlanadi. */
export function PeriodTabs({ value }: { value: Period }) {
  const t = useTranslations("businessStats");
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  return (
    <Segmented
      label={t("periodLabel")}
      options={PERIODS.map((p) => ({ value: String(p), label: t(`period.${p}`) }))}
      value={String(value)}
      onChange={(next) => startTransition(() => router.replace(`${pathname}?davr=${next}`, { scroll: false }))}
    />
  );
}
