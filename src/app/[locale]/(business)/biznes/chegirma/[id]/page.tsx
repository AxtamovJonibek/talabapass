import { Suspense } from "react";
import { resolveLocale } from "@/i18n/locale";
import { DiscountEditorPage } from "@/server/business/editor-page";

async function Editor({ params }: { params: Promise<{ locale: string; id: string }> }) {
  // [id] — ish vaqtidagi qiymat: params faqat Suspense ichida o'qiladi
  await resolveLocale(params);
  const { id } = await params;
  return <DiscountEditorPage discountId={id} />;
}

// B2 / WB2 — chegirmani tahrirlash
export default function EditDiscountPage({ params }: PageProps<"/[locale]/biznes/chegirma/[id]">) {
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  );
}
