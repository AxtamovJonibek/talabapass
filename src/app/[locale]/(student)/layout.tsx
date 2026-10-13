import { Suspense } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

export default async function StudentLayout({ children, params }: LayoutProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <RoleGate roles={["STUDENT"]}>{children}</RoleGate>
    </Suspense>
  );
}
