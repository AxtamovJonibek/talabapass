import { Suspense } from "react";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { CaptureScreen } from "@/components/student/capture-screen";
import { resolveLocale } from "@/i18n/locale";
import { authSecret } from "@/server/env";
import { readUploadToken } from "@/server/student/upload-token";

type Props = PageProps<"/[locale]/talaba/guvohnoma/telefon">;

/**
 * Kompyuterdagi QR kod orqali ochiladigan sahifa: telefonda kirish talab qilinmaydi,
 * ruxsat — havoladagi 15 daqiqalik token (faqat shu talaba nomidan guvohnoma yuklash).
 */
async function Handoff({ searchParams }: Pick<Props, "searchParams">) {
  const { t: token } = await searchParams;
  // Token muddati joriy vaqt bilan solishtiriladi — faqat so'rov vaqtida (prerender'da emas).
  await connection();
  const valid = typeof token === "string" && readUploadToken(token, authSecret()) !== null;
  if (valid) return <CaptureScreen backHref="/" uploadToken={token} />;

  const t = await getTranslations("onboarding.handoff");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-0 px-6 text-center text-paper">
      <h1 className="m-0 text-28 leading-[1.05] font-extrabold tracking-[-0.03em] font-stretch-110%">{t("expiredTitle")}</h1>
      <p className="m-0 text-14 leading-[1.45] text-fog-3">{t("expiredLead")}</p>
    </div>
  );
}

export default async function CardHandoffPage({ params, searchParams }: Props) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <Handoff searchParams={searchParams} />
    </Suspense>
  );
}
