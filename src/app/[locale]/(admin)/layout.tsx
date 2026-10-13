import { Suspense } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <RoleGate roles={["ADMIN"]}>{children}</RoleGate>
    </Suspense>
  );
}
