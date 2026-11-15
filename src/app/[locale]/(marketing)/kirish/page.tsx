import { Suspense } from "react";
import { AppLogin } from "@/components/app/app-login";
import { LoginScreen } from "@/components/auth/login-screen";
import { GuestOnly } from "@/components/auth/role-gate";
import { resolveLocale } from "@/i18n/locale";
import { isAppRequest } from "@/server/app-mode";

/** Saytda — W2/W2m; Capacitor ilovasida — design/app-flow kirishi (Auth, AuthBiznes, Auth2). */
async function LoginView() {
  return (await isAppRequest()) ? <AppLogin /> : <LoginScreen />;
}

// W2 / W2m — kirish. `/kirish?rol=biznes` Biznes tabini ochadi (LoginScreen manzilni brauzerda o'qiydi).
export default async function LoginPage({ params }: PageProps<"/[locale]/kirish">) {
  await resolveLocale(params);

  return (
    <>
      <Suspense fallback={null}>
        <GuestOnly />
      </Suspense>
      <Suspense fallback={null}>
        <LoginView />
      </Suspense>
    </>
  );
}
