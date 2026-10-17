import { getTranslations } from "next-intl/server";
import { OfflineScreen } from "@/components/state/offline-screen";
import { resolveLocale } from "@/i18n/locale";

// Service worker shu sahifani oldindan keshlaydi (public/sw.js): tarmoq yo'q bo'lsa ko'rsatiladi.
export default async function OfflinePage({ params }: PageProps<"/[locale]/oflayn">) {
  await resolveLocale(params);
  const t = await getTranslations("state");
  return (
    <OfflineScreen
      eyebrow={t("offlineEyebrow")}
      title={t("offlineTitle")}
      lead={t("offlineLead")}
      retry={t("retry")}
      coupons={t("myCoupons")}
    />
  );
}
