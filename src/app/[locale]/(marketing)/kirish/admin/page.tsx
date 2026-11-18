import { Suspense } from "react";
import { AdminPasswordScreen } from "@/components/auth/admin-password-screen";
import { AdminPasswordGate } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

// Admin ikkinchi qadami (dizaynda yo'q): SMS koddan keyin parol. Parolsiz admin sahifalari va admin API ochilmaydi.
export default async function AdminPasswordPage({ params }: PageProps<"/[locale]/kirish/admin">) {
  await resolveLocale(params);

  return (
    <>
      <Suspense fallback={null}>
        <AdminPasswordGate />
      </Suspense>
      <AdminPasswordScreen />
    </>
  );
}
