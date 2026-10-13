import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/login-screen";
import { GuestOnly } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

// W2 / W2m — kirish
export default async function LoginPage({ params }: PageProps<"/[locale]/kirish">) {
  await resolveLocale(params);

  return (
    <>
      <Suspense fallback={null}>
        <GuestOnly />
      </Suspense>
      <LoginScreen />
    </>
  );
}
