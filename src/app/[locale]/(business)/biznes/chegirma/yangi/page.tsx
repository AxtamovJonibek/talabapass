import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { resolveLocale } from "@/i18n/locale";
import { DiscountEditorPage } from "@/server/business/editor-page";

// B2 / WB2 — yangi chegirma
export default async function NewDiscountPage({ params }: PageProps<"/[locale]/biznes/chegirma/yangi">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DiscountEditorPage discountId={null} />
    </Suspense>
  );
}
