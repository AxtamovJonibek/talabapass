import { Suspense } from "react";
import { resolveLocale } from "@/i18n/locale";
import { DiscountEditorPage } from "@/server/business/editor-page";

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiscountEditorPage discountId={id} />;
}

// B2 / WB2 — chegirmani tahrirlash
export default async function EditDiscountPage({ params }: PageProps<"/[locale]/biznes/chegirma/[id]">) {
  await resolveLocale(params);
  return (
    <Suspense fallback={null}>
      <Editor params={params} />
    </Suspense>
  );
}
