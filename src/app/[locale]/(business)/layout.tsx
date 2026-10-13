import { Suspense } from "react";
import { RoleGate } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

export default async function BusinessLayout({ children, params }: LayoutProps<"/[locale]">) {
  await resolveLocale(params);

  return (
    <Suspense fallback={null}>
      <RoleGate roles={["BUSINESS_OWNER", "CASHIER"]}>{children}</RoleGate>
    </Suspense>
  );
}
