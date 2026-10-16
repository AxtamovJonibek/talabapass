import { PageSkeleton } from "@/components/state/page-skeleton";
import { Suspense } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { Toaster } from "@/components/ui/toast";
import { resolveLocale } from "@/i18n/locale";

export default async function StudentLayout({ children, params }: LayoutProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <RoleGate roles={["STUDENT"]}>{children}</RoleGate>
      </Suspense>
      {/* Sahifalar o'rtasida saqlanadi: bekor qilingan kupon xabari feed'ga o'tgach ham ko'rinadi */}
      <Toaster />
    </>
  );
}
