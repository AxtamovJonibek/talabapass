import { Suspense } from "react";
import { Intro } from "@/components/app/intro";
import { GuestOnly } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

// Ilova: "Biznes egasimisiz?" — Biz1, Biz2, keyin biznes kirishi.
export default async function AppBusinessIntroPage({ params }: PageProps<"/[locale]/ilova/biznes">) {
  await resolveLocale(params);
  return (
    <>
      <Suspense fallback={null}>
        <GuestOnly />
      </Suspense>
      <Intro kind="business" />
    </>
  );
}
