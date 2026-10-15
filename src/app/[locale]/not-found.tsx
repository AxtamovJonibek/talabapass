import { getTranslations } from "next-intl/server";
import { StatePage } from "@/components/state/state-page";
import { ButtonLink } from "@/components/ui/button";

export default async function NotFoundPage() {
  const t = await getTranslations("state");
  return (
    <StatePage testId="not-found-page" title={t("notFoundTitle")} lead={t("notFoundLead")}>
      <ButtonLink href="/" variant="blue">
        {t("home")}
      </ButtonLink>
    </StatePage>
  );
}
