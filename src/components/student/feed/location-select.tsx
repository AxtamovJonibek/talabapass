"use client";

import { useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { setLocationAction } from "@/server/actions/student-feed";

export type LocationProps = {
  /** "" — tanlanmagan, "gps" — geolokatsiya, aks holda tuman id'si */
  value: string;
  districts: { id: string; name: string }[];
};

/**
 * Joy tanlash (T4 / WT2 dagi "Chilonzor" tugmasi). Ko'rinish — dizayndagi tugma, ustida shaffof tizim `<select>`:
 * telefonda o'z ro'yxati ochiladi. "Mening joylashuvim" — brauzer geolokatsiyasi.
 */
export function LocationSelect({ value, districts, className, children }: LocationProps & { className?: string; children: ReactNode }) {
  const t = useTranslations("feed.location");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const save = (input: { districtId: string } | { lat: number; lng: number }) =>
    startTransition(async () => {
      const result = await setLocationAction(input);
      if (result.ok) router.refresh();
    });

  const onChange = (next: string) => {
    if (next !== "gps") return save({ districtId: next });
    if (!("geolocation" in navigator)) return window.alert(t("failed"));
    navigator.geolocation.getCurrentPosition(
      (pos) => save({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => window.alert(t("failed")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  return (
    <div className={cn("relative", pending && "opacity-60", className)}>
      {children}
      <select
        aria-label={t("label")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
      >
        {value === "" ? <option value="">{t("city")}</option> : null}
        <option value="gps">{t("gps")}</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </div>
  );
}
