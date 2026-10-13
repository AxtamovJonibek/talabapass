import { Suspense } from "react";
import { PlaceholderRegister } from "@/components/auth/placeholder-register";
import { resolveLocale } from "@/i18n/locale";

// 6-bosqichda: B1 / WB1 — biznes ro'yxati
export default async function BusinessRegisterPage({ params }: PageProps<"/[locale]/biznes/royxat">) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <PlaceholderRegister kind="business" />
    </Suspense>
  );
}
