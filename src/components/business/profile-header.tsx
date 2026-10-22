import { useTranslations } from "next-intl";
import { PhotoOr } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/i18n/navigation";
import { formatMln } from "@/lib/format";
import type { OwnerProfile } from "@/server/business/profile";

/** B5 — qora sarlavha: belgi, nom, tur · tuman · ish vaqti, holat va bugungi uch ko'rsatkich. */
export function ProfileHeader({ p }: { p: OwnerProfile }) {
  const t = useTranslations("businessProfile");
  const kind = useTranslations("businessKind");
  const live = p.status === "APPROVED" || p.status === "WARNED";
  const stats = [
    { value: String(p.salesToday), label: t("salesToday") },
    { value: formatMln(p.revenueToday), label: t("revenueToday") },
    { value: String(p.activeDiscounts), label: t("activeDiscounts") },
  ];
  return (
    <div className="bg-ink px-5 pt-14 pb-5 text-paper">
      <div className="flex items-center gap-3.5">
        <div className="flex size-15 shrink-0 items-center justify-center overflow-hidden rounded-16 bg-orange text-26 font-black text-ink font-stretch-125%">
          <PhotoOr src={p.logoUrl}>{p.name.trim().charAt(0).toUpperCase()}</PhotoOr>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="text-20 font-extrabold tracking-[-0.01em]">{p.name}</div>
          <div className="text-13 text-fog-2">{[p.typeLabel ?? kind(p.kind), p.district?.name, p.workingHours].filter(Boolean).join(" · ")}</div>
          <div className={live ? "flex items-center gap-[5px] text-12 font-bold text-mint" : "flex items-center gap-[5px] text-12 font-bold text-orange"}>
            {live ? <Icon name="check" size={12} strokeWidth={3.4} /> : null}
            {p.status === "WARNED" ? t("warned") : live ? t("approved") : t("pending")}
          </div>
        </div>
        <Link href="/biznes/profil/tahrir" aria-label={t("edit")} className="tp-lift flex size-11 shrink-0 items-center justify-center rounded-22 bg-ink-3 text-paper no-underline">
          <Icon name="edit" size={18} />
        </Link>
      </div>
      <div className="mt-[18px] grid grid-cols-3 border-t border-solid border-ink-4 pt-3.5">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-mono text-20 font-semibold">{s.value}</div>
            <div className="text-11 text-fog-3">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
