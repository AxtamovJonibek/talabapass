import { Suspense } from "react";
import { AppLogin } from "@/components/app/app-login";
import { GuestOnly } from "@/components/auth/role-gate";
import { WebAuth } from "@/components/auth/web-auth";
import { resolveLocale } from "@/i18n/locale";
import { webSocialConfig } from "@/server/auth/social-config";
import { isAppRequest } from "@/server/app-mode";

/** Saytda — telefon/email + parol, Google/Apple; Capacitor ilovasida — design/app-flow kirishi (Auth, AuthBiznes, Auth2). */
async function LoginView({ searchParams }: Pick<PageProps<"/[locale]/kirish">, "searchParams">) {
  if (await isAppRequest()) return <AppLogin />;
  const role = (await searchParams).rol === "biznes" ? "business" : "student";
  return <WebAuth start="signin" role={role} universities={[]} social={webSocialConfig()} />;
}

// W2/W2m — kirish. `/kirish?rol=biznes` Biznes tabini ochadi.
export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/kirish">) {
  await resolveLocale(params);

  return (
    <>
      <Suspense fallback={null}>
        <GuestOnly />
      </Suspense>
      <Suspense fallback={null}>
        <LoginView searchParams={searchParams} />
      </Suspense>
    </>
  );
}
