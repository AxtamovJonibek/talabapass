import { getTranslations } from "next-intl/server";
import { NotFoundScreen } from "@/components/state/not-found-screen";
import { notFoundText } from "@/components/state/not-found-text";
import { Link } from "@/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("state");
  return (
    <NotFoundScreen
      text={notFoundText({
        notFoundEyebrow: t("notFoundEyebrow"),
        notFoundTitle: t("notFoundTitle"),
        notFoundLead: t("notFoundLead"),
        notFoundLeadPhone: t("notFoundLeadPhone"),
        notFoundBack: t("notFoundBack"),
        notFoundPrimary: t("notFoundPrimary"),
        notFoundSecondary: t("notFoundSecondary"),
      })}
      renderLink={(href, className, label) => (
        <Link href={href} className={className}>
          {label}
        </Link>
      )}
    />
  );
}
