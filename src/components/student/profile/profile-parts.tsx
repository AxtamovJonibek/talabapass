import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { formatSom } from "@/lib/format";

/** Profil ekranlari (T8, WT4, tahrirlash, guvohnoma) uchun umumiy ma'lumot — serverdan tayyor holda keladi. */
export type ProfileData = {
  name: string;
  initials: string;
  /** "TATU · Dasturiy injiniring · 2-kurs" */
  meta: string;
  publicId: string;
  /** ISO sana yoki null */
  cardExpiresAt: string | null;
  cardNumber: string | null;
  notify: boolean;
  firstName: string;
  lastName: string;
  faculty: string;
  course: string;
  districtId: string;
};

export type ProfileTotals = { totalSaved: number; totalCount: number; places: number };

export const formatDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;

/** T8 (telefon) va WT4 (veb) yuqoridagi ko'k karta. Ota element `relative` bo'lishi shart emas. */
export function StudentIdCard({ profile, size }: { profile: ProfileData; size: "phone" | "web" }) {
  const t = useTranslations();
  const web = size === "web";
  const expires = profile.cardExpiresAt ? new Date(profile.cardExpiresAt) : null;
  return (
    <div className={cn("relative overflow-hidden bg-blue text-white", web ? "rounded-22 p-[22px]" : "rounded-20 p-[18px]")}>
      <div aria-hidden="true" className={cn("absolute rounded-full border-solid border-blue-2", web ? "-top-[50px] -right-[50px] size-[170px] border-[26px]" : "-top-10 -right-10 size-[140px] border-[22px]")} />
      <div className="relative flex items-center justify-between">
        <Logo size={14} chip="white-blue" />
        <span className="flex items-center gap-[5px] rounded-20 bg-white px-[9px] py-[5px] text-12 font-bold text-green">
          {web ? null : <Icon name="check" size={12} strokeWidth={3.4} />}
          {t("status.verified")}
        </span>
      </div>
      <div className={cn("relative flex items-center gap-3.5", web ? "mt-[22px]" : "mt-[18px]")}>
        <div className={cn("flex items-center justify-center bg-white font-black text-blue", web ? "size-[70px] rounded-16 text-26" : "size-16 rounded-14 text-24 font-stretch-110%")}>{profile.initials}</div>
        <div className={cn("flex min-w-0 flex-col", web ? "" : "gap-[3px]")}>
          <div className={cn("font-extrabold tracking-[-0.02em]", web ? "text-24" : "text-22 leading-[1.05]")}>{profile.name}</div>
          <div className={cn("text-blue-tint", web ? "text-14" : "text-13")}>{profile.meta}</div>
        </div>
      </div>
      <div className={cn("relative flex justify-between border-0 border-t-[1.5px] border-dashed border-blue-dash pt-3 font-mono text-blue-tint", web ? "mt-5 text-13" : "mt-[18px] text-12")}>
        <span>ID {profile.publicId}</span>
        {expires ? <span>{t("history.validUntil", { date: formatDate(expires) })}</span> : null}
      </div>
    </div>
  );
}

/** "Jami tejaldi" va "Xaridlar" kartalari. */
export function TotalsGrid({ totals, size }: { totals: ProfileTotals; size: "phone" | "web" }) {
  const t = useTranslations();
  if (size === "web") {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-18 bg-white p-4">
          <div className="text-13 text-muted">{t("history.totalSaved")}</div>
          <div className="mt-1 text-28 font-black font-stretch-85%">{formatSom(totals.totalSaved)}</div>
          <div className="text-12 text-muted">{t("common.currency")}</div>
        </div>
        <div className="rounded-18 bg-white p-4">
          <div className="text-13 text-muted">{t("history.purchases")}</div>
          <div className="mt-1 text-28 font-black font-stretch-85%">{totals.totalCount}</div>
          <div className="text-12 text-muted">{t("history.places", { count: totals.places })}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2">
      <div className="rounded-16 bg-white p-3.5">
        <div className="text-12 text-muted">{t("history.totalSaved")}</div>
        <div className="mt-1 text-22 font-black font-stretch-90%">
          {formatSom(totals.totalSaved)} <span className="text-12 font-bold">{t("common.currency")}</span>
        </div>
      </div>
      <div className="rounded-16 bg-white p-3.5">
        <div className="text-12 text-muted">{t("history.purchases")}</div>
        <div className="mt-1 text-22 font-black font-stretch-90%">
          {totals.totalCount} <span className="text-12 font-bold">{t("profile.countPlaces", { count: totals.places })}</span>
        </div>
      </div>
    </div>
  );
}
