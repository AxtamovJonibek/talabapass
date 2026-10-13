import { Suspense } from "react";
import { PlaceholderRegister } from "@/components/auth/placeholder-register";
import { resolveLocale } from "@/i18n/locale";

// 4-bosqichda: T1–T3 / WT1 — talaba ro'yxati
export default async function StudentRegisterPage({ params }: PageProps<"/[locale]/talaba/royxat">) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <PlaceholderRegister kind="student" />
    </Suspense>
  );
}
