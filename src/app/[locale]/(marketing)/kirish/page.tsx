import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/login-screen";
import { GuestOnly } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";

// W2 / W2m — kirish. `/kirish?rol=biznes` Biznes tabini ochadi (LoginScreen manzilni brauzerda o'qiydi).
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
