"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RetryButton } from "@/components/state/retry-button";
import { StatePage } from "@/components/state/state-page";
import { ButtonLink } from "@/components/ui/button";

/** Kutilmagan xato: barcha rol guruhlari uchun umumiy. Matnda texnik tafsilot yo'q; `digest` server log'ida. */
export default function ErrorPage({ error }: { error: Error & { digest?: string } }) {
  const t = useTranslations("state");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatePage testId="error-page" title={t("errorTitle")} lead={t("errorLead")}>
      <RetryButton label={t("retry")} />
      <ButtonLink href="/" variant="outline-soft">
        {t("home")}
      </ButtonLink>
    </StatePage>
  );
}
