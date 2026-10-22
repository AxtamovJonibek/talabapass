import { useTranslations } from "next-intl";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/cn";
import { instagramUrl, telegramUrl } from "@/lib/business";

const PILL = "tp-lift flex h-11 items-center gap-1.5 rounded-12 px-3.5 text-14 font-bold no-underline";
const QUIET = "border-hair border-line bg-white text-ink";

/**
 * Biznesning talabaga ko'rinadigan aloqasi: qo'ng'iroq (tel:), Telegram, Instagram. Hammasi ixtiyoriy —
 * hech biri kiritilmagan bo'lsa blok chiqmaydi. Manzil va ish vaqti yuqoridagi blokda.
 */
export function BusinessContact({ business, className }: { business: { phone: string | null; telegram: string | null; instagram: string | null }; className?: string }) {
  const t = useTranslations("dealPage");
  if (!business.phone && !business.telegram && !business.instagram) return null;
  return (
    <div role="group" aria-label={t("contactLabel")} className={cn("flex flex-wrap gap-2", className)}>
      {business.phone ? (
        <a href={`tel:${business.phone}`} className={cn(PILL, "border-0 bg-ink text-white")}>
          {t("contactCall")}
          <span className="font-mono text-13 font-medium">{formatPhone(business.phone)}</span>
        </a>
      ) : null}
      {business.telegram ? (
        <a href={telegramUrl(business.telegram)} target="_blank" rel="noopener noreferrer" className={cn(PILL, QUIET)}>
          {t("contactTelegram")}
        </a>
      ) : null}
      {business.instagram ? (
        <a href={instagramUrl(business.instagram)} target="_blank" rel="noopener noreferrer" className={cn(PILL, QUIET)}>
          {t("contactInstagram")}
        </a>
      ) : null}
    </div>
  );
}
