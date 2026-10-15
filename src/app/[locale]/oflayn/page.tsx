import { getTranslations } from "next-intl/server";
import { RetryButton } from "@/components/state/retry-button";
import { StatePage } from "@/components/state/state-page";
import { resolveLocale } from "@/i18n/locale";

// Service worker shu sahifani oldindan keshlaydi (public/sw.js): tarmoq yo'q bo'lsa ko'rsatiladi.
export default async function OfflinePage({ params }: PageProps<"/[locale]/oflayn">) {
  await resolveLocale(params);
  const t = await getTranslations("state");
  return (
    <StatePage testId="offline-page" title={t("offlineTitle")} lead={t("offlineLead")}>
      <RetryButton label={t("retry")} />
    </StatePage>
  );
}
