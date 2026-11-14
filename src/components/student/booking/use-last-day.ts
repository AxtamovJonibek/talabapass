"use client";

import { useTranslations } from "next-intl";
import { toTashkent } from "@/lib/time";

/** To'lab olib ketish muddatining oxirgi kuni (`validUntil` — keyingi kunning yarim tuni): "21-noyabr". */
export function useLastDay() {
  const tt = useTranslations();
  return (validUntil: string) => {
    const last = new Date(toTashkent(new Date(validUntil)).date.getTime() - 86_400_000);
    return `${last.getUTCDate()}-${tt(`month.name.${last.getUTCMonth() + 1}` as "month.name.1")}`;
  };
}
